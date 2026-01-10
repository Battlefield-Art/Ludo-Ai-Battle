import { NextRequest } from 'next/server';
import { ok, handleApiError } from '@/lib/api';
import { requireAdmin } from '@/lib/adminMiddleware';
import { redis } from '@/lib/redis';

export async function GET(req: NextRequest) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    const keys = await redis.keys('stats:*');
    const models = keys
      .filter((k) => k.startsWith('stats:') && k !== 'stats:total-games')
      .map((k) => k.replace('stats:', ''));

    return ok({ models });
  } catch (error) {
    return handleApiError(error);
  }
}
