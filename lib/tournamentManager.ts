import { redis } from '@/lib/redis';
import {
  Tournament,
  TournamentMatch,
  TournamentRound,
  TournamentFormat,
} from '@/types/tournament';
import { createInitialState } from '@/lib/game';
import { initReplay } from '@/lib/replay';
import { getSSEManager } from '@/lib/sse';
import { queueGameMove } from '@/lib/queue';
import { v4 as uuidv4 } from 'uuid';

/**
 * Start a tournament and automatically create and queue games for all matches
 */
export async function startTournament(tournamentId: string): Promise<void> {
  const tournament = await redis.get<Tournament>(`tournament:${tournamentId}`);
  if (!tournament) {
    throw new Error('Tournament not found');
  }

  if (tournament.status !== 'pending') {
    throw new Error('Tournament is not in pending state');
  }

  // Generate matches based on format
  const { generateRoundRobinMatches, generateKnockoutMatches, generateBestOfNMatches } = await import('./tournaments');

  let rounds: TournamentRound[] = [];

  switch (tournament.format) {
    case 'round-robin':
      rounds = generateRoundRobinMatches(tournament.participants);
      break;
    case 'knockout':
      rounds = generateKnockoutMatches(tournament.participants);
      break;
    case 'best-of-n':
      rounds = generateBestOfNMatches(
        tournament.participants,
        tournament.settings.gamesPerMatch || 3
      );
      break;
    default:
      throw new Error(`Unsupported tournament format: ${tournament.format}`);
  }

  tournament.rounds = rounds;
  tournament.currentRound = 1;
  tournament.status = 'active';
  tournament.startedAt = Date.now();

  await redis.set(`tournament:${tournamentId}`, tournament);

  // Start games for the first round
  await startRoundGames(tournamentId, tournament);

  // Emit SSE event
  try {
    const sseManager = getSSEManager();
    await sseManager.initialize();
    await sseManager.broadcastToTournament(tournamentId, {
      type: 'TOURNAMENT_STARTED',
      tournamentId,
      timestamp: new Date().toISOString(),
      data: { tournament },
    });
  } catch (sseError) {
    console.log('SSE error:', sseError);
  }
}

/**
 * Create and queue games for all matches in a round
 */
export async function startRoundGames(
  tournamentId: string,
  tournament: Tournament
): Promise<void> {
  const round = tournament.rounds.find(r => r.roundNumber === tournament.currentRound);
  if (!round) {
    return;
  }

  for (const match of round.matches) {
    if (match.status === 'pending') {
      await startMatchGame(tournamentId, match, tournament);
    }
  }
}

/**
 * Create a game for a match and queue it for auto-play
 */
export async function startMatchGame(
  tournamentId: string,
  match: TournamentMatch,
  tournament: Tournament
): Promise<string> {
  const gameId = uuidv4();

  // Create game state with match participants
  // For 2-player matches, we need to add 2 AI models
  // For 4-player matches, use all 4
  let models: string[];

  if (match.participants.length === 2) {
    // For 1v1, we can use the two participants directly
    // But we need 4 players for Ludo, so duplicate them or add placeholders
    // For now, let's use the two participants and add two from the list
    const otherParticipants = tournament.participants.filter(p => !match.participants.includes(p));
    models = [
      match.participants[0],
      match.participants[1],
      otherParticipants[0] || match.participants[0],
      otherParticipants[1] || match.participants[1],
    ];
  } else {
    models = match.participants;
  }

  const initialState = createInitialState(gameId, models);

  // Store game
  await redis.set(`games:${gameId}`, initialState, { ex: 86400 });
  await redis.zadd('games:active:list', { score: Date.now(), member: gameId });

  // Link game to tournament match
  await redis.set(`tournament:${tournamentId}:match:${match.matchId}:game`, gameId);
  await redis.sadd(`tournament:${tournamentId}:games`, gameId);

  // Initialize replay
  await initReplay(initialState);

  // Update match status
  match.status = 'in-progress';
  match.games.push(gameId);
  await redis.set(`tournament:${tournamentId}`, tournament);

  // Queue game for auto-play
  await queueGameMove(gameId, 1000);

  // Emit SSE event
  try {
    const sseManager = getSSEManager();
    await sseManager.initialize();
    await sseManager.broadcastToTournament(tournamentId, {
      type: 'MATCH_STARTED',
      tournamentId,
      matchId: match.matchId,
      timestamp: new Date().toISOString(),
      data: { match, gameId },
    });
  } catch (sseError) {
    console.log('SSE error:', sseError);
  }

  return gameId;
}

/**
 * Get all game IDs for a tournament
 */
export async function getTournamentGames(tournamentId: string): Promise<string[]> {
  const games = await redis.smembers<string[]>(`tournament:${tournamentId}:games`);
  return games || [];
}

/**
 * Pause a tournament and all its active games
 */
export async function pauseTournament(tournamentId: string): Promise<void> {
  const tournament = await redis.get<Tournament>(`tournament:${tournamentId}`);
  if (!tournament) {
    throw new Error('Tournament not found');
  }

  if (tournament.status !== 'active') {
    throw new Error('Tournament is not active');
  }

  // Pause all games
  const games = await getTournamentGames(tournamentId);
  for (const gameId of games) {
    const state = await redis.get<any>(`games:${gameId}`);
    if (state && state.status === 'active') {
      state.status = 'paused';
      await redis.set(`games:${gameId}`, state, { ex: 86400 });
    }
  }

  // Update tournament status
  tournament.status = 'paused';
  await redis.set(`tournament:${tournamentId}`, tournament);

  // Emit SSE event
  try {
    const sseManager = getSSEManager();
    await sseManager.initialize();
    await sseManager.broadcastToTournament(tournamentId, {
      type: 'TOURNAMENT_PAUSED',
      tournamentId,
      timestamp: new Date().toISOString(),
      data: { tournament },
    });
  } catch (sseError) {
    console.log('SSE error:', sseError);
  }
}

/**
 * Resume a paused tournament and its games
 */
export async function resumeTournament(tournamentId: string): Promise<void> {
  const tournament = await redis.get<Tournament>(`tournament:${tournamentId}`);
  if (!tournament) {
    throw new Error('Tournament not found');
  }

  if (tournament.status !== 'paused') {
    throw new Error('Tournament is not paused');
  }

  // Resume all games
  const games = await getTournamentGames(tournamentId);
  for (const gameId of games) {
    const state = await redis.get<any>(`games:${gameId}`);
    if (state && state.status === 'paused') {
      state.status = 'active';
      await redis.set(`games:${gameId}`, state, { ex: 86400 });
      // Re-queue the game
      await queueGameMove(gameId, 1000);
    }
  }

  // Update tournament status
  tournament.status = 'active';
  await redis.set(`tournament:${tournamentId}`, tournament);

  // Emit SSE event
  try {
    const sseManager = getSSEManager();
    await sseManager.initialize();
    await sseManager.broadcastToTournament(tournamentId, {
      type: 'TOURNAMENT_RESUMED',
      tournamentId,
      timestamp: new Date().toISOString(),
      data: { tournament },
    });
  } catch (sseError) {
    console.log('SSE error:', sseError);
  }
}

/**
 * End a tournament and finalize standings
 */
export async function endTournament(tournamentId: string): Promise<void> {
  const tournament = await redis.get<Tournament>(`tournament:${tournamentId}`);
  if (!tournament) {
    throw new Error('Tournament not found');
  }

  if (tournament.status === 'completed') {
    throw new Error('Tournament is already completed');
  }

  // Cancel all active games
  const games = await getTournamentGames(tournamentId);
  for (const gameId of games) {
    const state = await redis.get<any>(`games:${gameId}`);
    if (state && (state.status === 'active' || state.status === 'paused')) {
      state.status = 'cancelled';
      await redis.set(`games:${gameId}`, state, { ex: 86400 });
      await redis.zrem('games:active:list', gameId);
    }
  }

  // Update tournament status
  tournament.status = 'completed';
  tournament.completedAt = Date.now();

  // Calculate and set winner
  const { calculateStandings } = await import('./tournaments');
  const standings = calculateStandings(tournament);
  tournament.winnerId = standings[0]?.modelName;

  await redis.set(`tournament:${tournamentId}`, tournament);

  // Emit SSE event
  try {
    const sseManager = getSSEManager();
    await sseManager.initialize();
    await sseManager.broadcastToTournament(tournamentId, {
      type: 'TOURNAMENT_ENDED',
      tournamentId,
      timestamp: new Date().toISOString(),
      data: { tournament, standings },
    });
  } catch (sseError) {
    console.log('SSE error:', sseError);
  }
}

/**
 * Check if all matches in current round are completed and advance to next round
 */
export async function checkRoundCompletion(tournamentId: string): Promise<void> {
  const tournament = await redis.get<Tournament>(`tournament:${tournamentId}`);
  if (!tournament || tournament.status !== 'active') {
    return;
  }

  const currentRound = tournament.rounds.find(r => r.roundNumber === tournament.currentRound);
  if (!currentRound) {
    return;
  }

  // Check if all matches are completed
  const allMatchesCompleted = currentRound.matches.every(
    m => m.status === 'completed'
  );

  if (allMatchesCompleted) {
    // Mark round as completed
    currentRound.status = 'completed';

    // Check if there's a next round
    const nextRound = tournament.rounds.find(r => r.roundNumber === tournament.currentRound + 1);

    if (nextRound) {
      // Advance to next round
      tournament.currentRound++;
      await redis.set(`tournament:${tournamentId}`, tournament);

      // Start games for next round
      await startRoundGames(tournamentId, tournament);

      // Emit SSE event
      try {
        const sseManager = getSSEManager();
        await sseManager.initialize();
        await sseManager.broadcastToTournament(tournamentId, {
          type: 'ROUND_COMPLETED',
          tournamentId,
          roundNumber: tournament.currentRound - 1,
          timestamp: new Date().toISOString(),
          data: { round: currentRound },
        });
      } catch (sseError) {
        console.log('SSE error:', sseError);
      }
    } else {
      // All rounds completed, end tournament
      await endTournament(tournamentId);
    }
  }
}

/**
 * Get games for a specific match
 */
export async function getMatchGames(tournamentId: string, matchId: string): Promise<string[]> {
  const matchGame = await redis.get<string>(`tournament:${tournamentId}:match:${matchId}:game`);
  return matchGame ? [matchGame] : [];
}
