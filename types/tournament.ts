export type TournamentFormat = 'round-robin' | 'knockout' | 'best-of-n';
export type TournamentStatus = 'pending' | 'active' | 'paused' | 'completed';
export type MatchStatus = 'pending' | 'in-progress' | 'completed';

export interface Tournament {
  id: string;
  name: string;
  format: TournamentFormat;
  status: TournamentStatus;
  participants: string[]; // model names
  rounds: TournamentRound[];
  currentRound: number;
  settings: TournamentSettings;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  winnerId?: string;
}

export interface TournamentSettings {
  bestOfN?: number; // For best-of-N format (1, 3, 5, 7)
  knockoutType?: 'single' | 'double'; // For knockout format
  gamesPerMatch?: number; // Number of games per match
}

export interface TournamentRound {
  roundNumber: number;
  matches: TournamentMatch[];
  status: 'pending' | 'in-progress' | 'completed';
  startedAt?: number;
  completedAt?: number;
}

export interface TournamentMatch {
  matchId: string;
  roundNumber: number;
  participants: string[]; // model names (2 or 4 depending on format)
  games: string[]; // game IDs
  status: MatchStatus;
  winnerId?: string;
  scores: Record<string, number>; // modelName -> wins
  startedAt?: number;
  completedAt?: number;
}

export interface TournamentStanding {
  position: number;
  modelName: string;
  wins: number;
  losses: number;
  draws: number;
  points: number;
  gamesPlayed: number;
  goalsFor?: number;
  goalsAgainst?: number;
  goalDifference?: number;
}

export interface TournamentBracket {
  tournamentId: string;
  format: TournamentFormat;
  rounds: BracketRound[];
  standings: TournamentStanding[];
}

export interface BracketRound {
  roundNumber: number;
  roundName: string; // e.g., "Quarter Finals", "Semi Finals", "Final"
  matches: BracketMatch[];
}

export interface BracketMatch {
  matchId: string;
  participants: BracketParticipant[];
  winnerId?: string;
  status: MatchStatus;
}

export interface BracketParticipant {
  modelName: string;
  score: number;
  seed?: number;
}
