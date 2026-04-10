export type PlayerColor = 'red' | 'blue' | 'yellow' | 'green';
export type GameStatus = 'waiting' | 'active' | 'paused' | 'completed' | 'cancelled';

export interface Piece {
  pieceId: number;
  color: PlayerColor;
  position: number; // -1=home, 0-51=board, 52=finished
  captured?: boolean;
}

export interface Player {
  color: PlayerColor;
  model: string;
  agentName?: string;
  agentRole?: string;
  piecesState: Piece[];
}

export interface Move {
  playerColor: PlayerColor;
  pieceId: number;
  diceRoll: number;
  fromPosition: number;
  toPosition: number;
  action: 'start' | 'move' | 'capture';
  reasoning?: string;
  timestamp: number;
}

export interface GameState {
  gameId: string;
  status: GameStatus;
  players: Player[];
  currentPlayerIndex: number;
  moveHistory: Move[];
  diceRoll: number | null;
  createdAt: number;
  completedAt?: number;
  finalRanking?: PlayerColor[];
}

export interface ModelStats {
  modelName: string;
  wins: number;
  losses: number;
  draws: number;
  gamesPlayed: number;
  winRate: number;
  elo: number;
  totalCaptures: number;
  avgGameLength: number;
}

export interface AIResponse {
  pieceId: number;
  action: 'start' | 'move' | 'capture';
  targetPosition: number;
  reasoning: string;
}
