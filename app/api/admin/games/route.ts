import { NextRequest } from 'next/server';
import { ok, handleApiError } from '@/lib/api';
import { requireAdmin } from '@/lib/adminMiddleware';
import { redis } from '@/lib/redis';
import { GameState } from '@/types/game';

export async function GET(req: NextRequest) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'all';
    const offset = parseInt(searchParams.get('offset') || '0');
    const limit = parseInt(searchParams.get('limit') || '20');

    let gameIds: string[] = [];

    if (status === 'active' || status === 'all') {
      const activeIds = await redis.zrange('games:active:list', 0, -1) as string[];
      gameIds.push(...activeIds);
    }

    // Fetch game details
    const games = await Promise.all(
      gameIds.slice(offset, offset + limit).map(async (gameId) => {
        const state = await redis.get<GameState>(`games:${gameId}`);
        return state;
      })
    );

    return ok({
      games: games.filter(Boolean),
      pagination: {
        offset,
        limit,
        total: gameIds.length,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
