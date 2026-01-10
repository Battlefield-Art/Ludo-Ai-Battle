import { PlayerColor } from '@/types/game';

export interface GameReplay {
  gameId: string;
  createdAt: number;
  completedAt?: number;
  models: Record<PlayerColor, string>;
  moves: ReplayMove[];
}

export interface ReplayMove {
  moveNumber: number;
  playerColor: PlayerColor;
  diceRoll: number;
  piece: number;
  action: 'start' | 'move' | 'capture';
  position: number;
  boardState: any;
  timestamp: number;
  reasoning?: string;
}

export interface ReplayEngine {
  getCurrentBoardState(moveNumber: number): any;
  getMove(moveNumber: number): ReplayMove | null;
  getMoveRange(start: number, end: number): ReplayMove[];
}
