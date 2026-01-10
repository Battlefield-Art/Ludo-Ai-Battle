import { NextRequest } from 'next/server';
import { ok, fail, handleApiError } from '@/lib/api';
import { redis } from '@/lib/redis';
import { GameState } from '@/types/game';

export async function GET(req: NextRequest, { params }: { params: { gameId: string } }) {
  try {
    const state = await redis.get<GameState>(`history:${params.gameId}`);
    if (!state) return fail('NOT_FOUND', 'Game history not found', 404);
    return ok({ game: state });
  } catch (error) {
    return handleApiError(error);
  }
}
