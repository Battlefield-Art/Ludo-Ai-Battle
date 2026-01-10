import { NextRequest } from 'next/server';
import { ok, handleApiError } from '@/lib/api';
import { requireAdmin } from '@/lib/adminMiddleware';
import { redis } from '@/lib/redis';
import { GameState, ModelStats } from '@/types/game';

export async function GET(req: NextRequest) {
  try {
    const { admin, error } = requireAdmin(req);
    if (error) return error;

    // Metrics overview
    const totalGames = (await redis.get<number>('stats:total-games')) || 0;
    const activeGameIds = await redis.zrange('games:active:list', 0, -1);
    const activeGames = activeGameIds.length;

    // Leaderboard
    const leaderboard = await redis.zrange('leaderboard', 0, 9, { rev: true, withScores: true });
    const formattedLeaderboard = [];
    for (let i = 0; i < leaderboard.length; i += 2) {
      formattedLeaderboard.push({
        model: leaderboard[i],
        elo: parseFloat(leaderboard[i + 1] as string),
      });
    }

    // Recent games (last 10)
    const recentGameIds = await redis.zrange('games:active:list', 0, 9, { rev: true });
    const recentGames = await Promise.all(
      recentGameIds.map(async (gameId) => {
        const state = await redis.get<GameState>(`games:${gameId}`);
        return state;
      })
    );

    // AI models count
    const modelKeys = await redis.keys('stats:*');
    const modelsCount = modelKeys.filter((k) => k.startsWith('stats:') && k !== 'stats:total-games').length;

    // System health
    const systemHealth = {
      redis: true,
      websocket: true,
      timestamp: Date.now(),
    };

    // Average game duration
    const durations = await redis.lrange('analytics:game-durations', 0, -1);
    const avgDuration = durations.length > 0
      ? durations.reduce((sum, d) => sum + parseFloat(d as string), 0) / durations.length
      : 0;

    return ok({
      metrics: {
        totalGames,
        activeGames,
        completedGames: totalGames - activeGames,
        avgDuration,
        modelsCount,
        systemHealth,
      },
      leaderboard: formattedLeaderboard,
      recentGames: recentGames.filter(Boolean).slice(0, 10),
      admin: {
        username: admin!.username,
        role: admin!.role,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
