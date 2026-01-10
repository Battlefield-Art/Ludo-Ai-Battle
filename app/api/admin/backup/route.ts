import { NextRequest } from 'next/server';
import { ok, handleApiError } from '@/lib/api';
import { requireSuperAdmin } from '@/lib/adminMiddleware';
import { redis } from '@/lib/redis';
import { v4 as uuidv4 } from 'uuid';
import { logAdminAction } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const { admin, error } = requireSuperAdmin(req);
    if (error) return error;

    const backupId = uuidv4();

    const snapshot = {
      createdAt: new Date().toISOString(),
      leaderboard: await redis.zrange('leaderboard', 0, -1, { rev: true, withScores: true }),
      config: await redis.get('config:system'),
      tournaments: await redis.zrange('tournaments:list', 0, -1, { rev: true }),
    };

    await redis.set(`backup:${backupId}`, snapshot, { ex: 7 * 24 * 3600 });

    await logAdminAction(admin!.adminId, admin!.username, 'BACKUP', 'system', backupId);

    return ok({ backupId, expiresInSeconds: 7 * 24 * 3600 });
  } catch (error) {
    return handleApiError(error);
  }
}
