import { NextRequest } from 'next/server';
import { ok, handleApiError } from '@/lib/api';
import { redis } from '@/lib/redis';
import { GameState } from '@/types/game';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const offset = parseInt(searchParams.get('offset') || '0');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');

    // Get game IDs from history
    const historyKeys = await redis.keys('history:*');
    const gameIds = historyKeys.map((k) => k.replace('history:', ''));

    // Fetch games
    const games = await Promise.all(
      gameIds.slice(offset, offset + limit).map(async (gameId) => {
        const state = await redis.get<GameState>(`history:${gameId}`);
        return state;
      })
    );

    const filteredGames = games.filter((g) => {
      if (!g) return false;
      if (status && g.status !== status) return false;
      return true;
    });

    return ok({
      games: filteredGames,
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
