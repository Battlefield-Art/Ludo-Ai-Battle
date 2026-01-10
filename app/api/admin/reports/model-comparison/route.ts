import { NextRequest } from 'next/server';
import { ok, handleApiError } from '@/lib/api';
import { requireAdmin } from '@/lib/adminMiddleware';
import { redis } from '@/lib/redis';

export async function GET(req: NextRequest) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    const leaderboard = await redis.zrange('leaderboard', 0, -1, { rev: true, withScores: true });

    return ok({ leaderboard });
  } catch (error) {
    return handleApiError(error);
  }
}
