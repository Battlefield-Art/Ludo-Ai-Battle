import { redis } from '@/lib/redis';
import {
  Tournament,
  TournamentFormat,
  TournamentRound,
  TournamentMatch,
  TournamentStanding,
  TournamentBracket,
  BracketRound,
  BracketMatch,
} from '@/types/tournament';
import { v4 as uuidv4 } from 'uuid';

export async function createTournament(
  name: string,
  format: TournamentFormat,
  participants: string[],
  settings: Tournament['settings'] = {}
): Promise<Tournament> {
  const tournament: Tournament = {
    id: uuidv4(),
    name,
    format,
    status: 'pending',
    participants,
    rounds: [],
    currentRound: 0,
    settings: {
      gamesPerMatch: settings.gamesPerMatch || 1,
      ...settings,
    },
    createdAt: Date.now(),
  };

  await redis.set(`tournament:${tournament.id}`, tournament);
  await redis.zadd('tournaments:list', { score: Date.now(), member: tournament.id });

  return tournament;
}

export async function getTournament(tournamentId: string): Promise<Tournament | null> {
  return await redis.get<Tournament>(`tournament:${tournamentId}`);
}

export async function updateTournament(tournament: Tournament): Promise<void> {
  await redis.set(`tournament:${tournament.id}`, tournament);
}

export function generateRoundRobinMatches(participants: string[]): TournamentRound[] {
  const rounds: TournamentRound[] = [];
  const n = participants.length;

  // For round-robin, each participant plays every other participant
  // If we have 4 players, we can do 4-player matches
  // Otherwise, we do 1v1 matches

  if (n === 4) {
    // Single 4-player match
    rounds.push({
      roundNumber: 1,
      matches: [
        {
          matchId: uuidv4(),
          roundNumber: 1,
          participants,
          games: [],
          status: 'pending',
          scores: participants.reduce((acc, p) => ({ ...acc, [p]: 0 }), {}),
        },
      ],
      status: 'pending',
    });
  } else {
    // Generate round-robin pairings (1v1)
    let roundNumber = 1;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const match: TournamentMatch = {
          matchId: uuidv4(),
          roundNumber,
          participants: [participants[i], participants[j]],
          games: [],
          status: 'pending',
          scores: {
            [participants[i]]: 0,
            [participants[j]]: 0,
          },
        };

        let round = rounds.find((r) => r.roundNumber === roundNumber);
        if (!round) {
          round = {
            roundNumber,
            matches: [],
            status: 'pending',
          };
          rounds.push(round);
        }
        round.matches.push(match);

        // Limit matches per round (e.g., 2 matches per round)
        if (round.matches.length >= 2) {
          roundNumber++;
        }
      }
    }
  }

  return rounds;
}

export function generateKnockoutMatches(
  participants: string[],
  knockoutType: 'single' | 'double' = 'single'
): TournamentRound[] {
  const rounds: TournamentRound[] = [];
  let currentParticipants = [...participants];
  let roundNumber = 1;

  while (currentParticipants.length > 1) {
    const matches: TournamentMatch[] = [];
    const nextRoundParticipants: string[] = [];

    // Pair up participants
    for (let i = 0; i < currentParticipants.length; i += 2) {
      if (i + 1 < currentParticipants.length) {
        const match: TournamentMatch = {
          matchId: uuidv4(),
          roundNumber,
          participants: [currentParticipants[i], currentParticipants[i + 1]],
          games: [],
          status: 'pending',
          scores: {
            [currentParticipants[i]]: 0,
            [currentParticipants[i + 1]]: 0,
          },
        };
        matches.push(match);
      } else {
        // Bye - participant advances automatically
        nextRoundParticipants.push(currentParticipants[i]);
      }
    }

    rounds.push({
      roundNumber,
      matches,
      status: 'pending',
    });

    currentParticipants = nextRoundParticipants;
    roundNumber++;

    // For simplicity, we assume winners advance (will be determined by game results)
    if (matches.length > 0) {
      matches.forEach(() => currentParticipants.push('TBD'));
    }
  }

  return rounds;
}

export function generateBestOfNMatches(
  participants: string[],
  bestOfN: number = 3
): TournamentRound[] {
  // Best-of-N is essentially one round with a series of games
  const rounds: TournamentRound[] = [];

  for (let i = 0; i < participants.length; i++) {
    for (let j = i + 1; j < participants.length; j++) {
      const match: TournamentMatch = {
        matchId: uuidv4(),
        roundNumber: 1,
        participants: [participants[i], participants[j]],
        games: [],
        status: 'pending',
        scores: {
          [participants[i]]: 0,
          [participants[j]]: 0,
        },
      };

      let round = rounds.find((r) => r.roundNumber === 1);
      if (!round) {
        round = {
          roundNumber: 1,
          matches: [],
          status: 'pending',
        };
        rounds.push(round);
      }
      round.matches.push(match);
    }
  }

  return rounds;
}

export function calculateStandings(tournament: Tournament): TournamentStanding[] {
  const standings: Record<string, TournamentStanding> = {};

  // Initialize standings
  tournament.participants.forEach((modelName, index) => {
    standings[modelName] = {
      position: index + 1,
      modelName,
      wins: 0,
      losses: 0,
      draws: 0,
      points: 0,
      gamesPlayed: 0,
    };
  });

  // Calculate from matches
  tournament.rounds.forEach((round) => {
    round.matches.forEach((match) => {
      if (match.status !== 'completed') return;

      match.participants.forEach((participant) => {
        const standing = standings[participant];
        if (!standing) return;

        standing.gamesPlayed += match.games.length;

        const score = match.scores[participant] || 0;
        const opponentScore = Object.entries(match.scores)
          .filter(([p]) => p !== participant)
          .reduce((sum, [, s]) => sum + s, 0);

        if (score > opponentScore) {
          standing.wins++;
          standing.points += 3; // 3 points for win
        } else if (score < opponentScore) {
          standing.losses++;
        } else {
          standing.draws++;
          standing.points += 1; // 1 point for draw
        }
      });
    });
  });

  // Sort by points, then wins, then name
  const sortedStandings = Object.values(standings).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.modelName.localeCompare(b.modelName);
  });

  // Assign positions
  sortedStandings.forEach((standing, index) => {
    standing.position = index + 1;
  });

  return sortedStandings;
}

export function generateBracketVisualization(tournament: Tournament): TournamentBracket {
  const roundNames: Record<number, string> = {
    1: tournament.rounds.length === 1 ? 'Final' : 'Round 1',
    2: tournament.rounds.length === 2 ? 'Final' : 'Semi Finals',
    3: tournament.rounds.length === 3 ? 'Final' : 'Quarter Finals',
  };

  // Reverse mapping for finals
  const lastRound = tournament.rounds.length;
  if (lastRound > 3) {
    roundNames[lastRound] = 'Final';
    roundNames[lastRound - 1] = 'Semi Finals';
    roundNames[lastRound - 2] = 'Quarter Finals';
  }

  const bracketRounds: BracketRound[] = tournament.rounds.map((round) => ({
    roundNumber: round.roundNumber,
    roundName: roundNames[round.roundNumber] || `Round ${round.roundNumber}`,
    matches: round.matches.map((match) => ({
      matchId: match.matchId,
      participants: match.participants.map((p) => ({
        modelName: p,
        score: match.scores[p] || 0,
      })),
      winnerId: match.winnerId,
      status: match.status,
    })),
  }));

  return {
    tournamentId: tournament.id,
    format: tournament.format,
    rounds: bracketRounds,
    standings: calculateStandings(tournament),
  };
}
