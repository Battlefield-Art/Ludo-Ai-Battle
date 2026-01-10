import { redis } from '@/lib/redis';
import { GameState, PlayerColor } from '@/types/game';
import { GameReplay, ReplayMove } from '@/types/replay';

export async function getReplay(gameId: string): Promise<GameReplay | null> {
  return await redis.get<GameReplay>(`replay:${gameId}`);
}

export async function initReplay(state: GameState): Promise<GameReplay> {
  const models = state.players.reduce((acc, p) => {
    acc[p.color] = p.model;
    return acc;
  }, {} as Record<PlayerColor, string>);

  const replay: GameReplay = {
    gameId: state.gameId,
    createdAt: state.createdAt,
    models,
    moves: [],
  };

  await redis.set(`replay:${state.gameId}`, replay, { ex: 31536000 });
  return replay;
}

export async function appendReplayMove(
  gameId: string,
  move: Omit<ReplayMove, 'moveNumber'>
): Promise<ReplayMove> {
  const replay = await getReplay(gameId);
  if (!replay) {
    throw new Error('Replay not initialized');
  }

  const replayMove: ReplayMove = {
    ...move,
    moveNumber: replay.moves.length + 1,
  };

  replay.moves.push(replayMove);
  await redis.set(`replay:${gameId}`, replay, { ex: 31536000 });
  return replayMove;
}

export async function completeReplay(gameId: string, completedAt: number): Promise<void> {
  const replay = await getReplay(gameId);
  if (!replay) return;
  replay.completedAt = completedAt;
  await redis.set(`replay:${gameId}`, replay, { ex: 31536000 });
}

export function createReplayEngine(replay: GameReplay) {
  return {
    getCurrentBoardState(moveNumber: number) {
      if (moveNumber <= 0) return null;
      const move = replay.moves[moveNumber - 1];
      return move?.boardState ?? null;
    },

    getMove(moveNumber: number) {
      if (moveNumber <= 0) return null;
      return replay.moves[moveNumber - 1] ?? null;
    },

    getMoveRange(start: number, end: number) {
      const s = Math.max(1, start);
      const e = Math.min(replay.moves.length, end);
      if (e < s) return [];
      return replay.moves.slice(s - 1, e);
    },
  };
}
