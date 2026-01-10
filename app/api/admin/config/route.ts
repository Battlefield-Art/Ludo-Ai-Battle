import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, handleApiError } from '@/lib/api';
import { requireSuperAdmin } from '@/lib/adminMiddleware';
import { redis } from '@/lib/redis';
import { SystemConfig } from '@/types/admin';

const configSchema = z.object({
  heartbeatInterval: z.number().int().min(5000).optional(),
  inactivityTimeout: z.number().int().min(10000).optional(),
  maxGamesPerTournament: z.number().int().min(1).optional(),
  defaultEloRating: z.number().int().min(0).optional(),
  kFactor: z.number().int().min(1).optional(),
  enableAutoArchive: z.boolean().optional(),
  archiveCutoffDays: z.number().int().min(1).optional(),
});

const defaultConfig: SystemConfig = {
  heartbeatInterval: 30000,
  inactivityTimeout: 300000,
  maxGamesPerTournament: 100,
  defaultEloRating: 1600,
  kFactor: 32,
  enableAutoArchive: true,
  archiveCutoffDays: 365,
};

export async function GET(req: NextRequest) {
  try {
    const { error } = requireSuperAdmin(req);
    if (error) return error;

    const config = (await redis.get<SystemConfig>('config:system')) || defaultConfig;
    return ok({ config });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { admin, error } = requireSuperAdmin(req);
    if (error) return error;

    const body = await req.json();
    const updates = configSchema.parse(body);

    const current = (await redis.get<SystemConfig>('config:system')) || defaultConfig;
    const updated = { ...current, ...updates };

    await redis.set('config:system', updated);

    return ok({ config: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
