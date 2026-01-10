import { NextRequest } from 'next/server';
import { ok, fail, handleApiError } from '@/lib/api';
import { requireAdmin } from '@/lib/adminMiddleware';
import { redis } from '@/lib/redis';
import { GameState } from '@/types/game';
import { logAdminAction } from '@/lib/audit';

export async function POST(req: NextRequest, { params }: { params: { gameId: string } }) {
  try {
    const { admin, error } = requireAdmin(req);
    if (error) return error;

    const state = await redis.get<GameState>(`games:${params.gameId}`);
    if (!state) return fail('NOT_FOUND', 'Game not found', 404);

    state.status = 'cancelled' as any;
    state.completedAt = Date.now();
    await redis.set(`games:${params.gameId}`, state, { ex: 86400 });
    await redis.zrem('games:active:list', params.gameId);
    await redis.set(`history:${params.gameId}`, state, { ex: 31536000 });

    await logAdminAction(admin!.adminId, admin!.username, 'CANCEL_GAME', 'game', params.gameId, {}, req.ip || undefined);

    return ok({ gameId: params.gameId, status: state.status });
  } catch (error) {
    return handleApiError(error);
  }
}
