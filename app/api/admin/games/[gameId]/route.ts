import { NextRequest } from 'next/server';
import { ok, fail, handleApiError } from '@/lib/api';
import { requireAdmin } from '@/lib/adminMiddleware';
import { redis } from '@/lib/redis';
import { GameState } from '@/types/game';

export async function GET(
  req: NextRequest,
  { params }: { params: { gameId: string } }
) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    const gameId = params.gameId;
    const state = await redis.get<GameState>(`games:${gameId}`);
    
    if (!state) {
      return fail('NOT_FOUND', 'Game not found', 404);
    }

    // Get replay if exists
    const replay = await redis.get(`replay:${gameId}`);

    return ok({
      state,
      replay,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
