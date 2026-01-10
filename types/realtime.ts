export type RealtimeEventType =
  | 'GAME_STARTED'
  | 'MOVE_EXECUTED'
  | 'GAME_STATE_UPDATED'
  | 'GAME_COMPLETED'
  | 'LEADERBOARD_UPDATED'
  | 'PLAYER_JOINED'
  | 'PLAYER_LEFT'
  | 'TOURNAMENT_UPDATED';

export type RealtimeChannel =
  | `game:${string}`
  | 'leaderboard'
  | `tournaments:${string}`;

export interface RealtimeMessage<T = any> {
  type: RealtimeEventType;
  gameId?: string;
  tournamentId?: string;
  timestamp: string; // ISO8601
  data: T;
}

export interface ClientMessage {
  type: 'SUBSCRIBE' | 'UNSUBSCRIBE' | 'PING';
  channels?: RealtimeChannel[];
}

export interface ServerMessage {
  type: 'WELCOME' | 'ERROR' | 'PONG';
  timestamp: string;
  data?: any;
  error?: { code: string; message: string };
}
