import { NextRequest } from 'next/server';
import { ok, handleApiError } from '@/lib/api';
import { requireAdmin } from '@/lib/adminMiddleware';
import { redis } from '@/lib/redis';

export async function GET(req: NextRequest) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    // Get all known models from stats keys
    const keys = await redis.keys('stats:*');
    const modelNames = keys
      .filter((k) => k.startsWith('stats:') && k !== 'stats:total-games')
      .map((k) => k.replace('stats:', ''));

    // Get model status
    const models = await Promise.all(
      modelNames.map(async (modelName) => {
        const disabled = await redis.get<boolean>(`model:${modelName}:disabled`);
        return {
          modelName,
          enabled: !disabled,
        };
      })
    );

    return ok({ models });
  } catch (error) {
    return handleApiError(error);
  }
}
