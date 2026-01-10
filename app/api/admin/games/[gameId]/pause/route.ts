import { NextRequest } from 'next/server';
import { ok, fail, handleApiError } from '@/lib/api';
import { requireAdmin } from '@/lib/adminMiddleware';
import { redis } from '@/lib/redis';
import { GameState } from '@/types/game';
import { logAdminAction } from '@/lib/audit';

export async function POST(
  req: NextRequest,
  { params }: { params: { gameId: string } }
) {
  try {
    const { admin, error } = requireAdmin(req);
    if (error) return error;

    const state = await redis.get<GameState>(`games:${params.gameId}`);
    if (!state) return fail('NOT_FOUND', 'Game not found', 404);

    state.status = 'paused' as any;
    await redis.set(`games:${params.gameId}`, state, { ex: 86400 });

    await logAdminAction(admin!.adminId, admin!.username, 'PAUSE_GAME', 'game', params.gameId, {}, req.ip || undefined);

    return ok({ gameId: params.gameId, status: state.status });
  } catch (error) {
    return handleApiError(error);
  }
}
