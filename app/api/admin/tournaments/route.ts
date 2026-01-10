import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, handleApiError } from '@/lib/api';
import { requireAdmin } from '@/lib/adminMiddleware';
import { createTournament, getTournament } from '@/lib/tournaments';
import { redis } from '@/lib/redis';
import { Tournament } from '@/types/tournament';
import { logAdminAction } from '@/lib/audit';

const createSchema = z.object({
  name: z.string().min(1),
  format: z.enum(['round-robin', 'knockout', 'best-of-n']),
  participants: z.array(z.string()).min(2),
  settings: z.any().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    const ids = await redis.zrange('tournaments:list', 0, -1, { rev: true });
    const tournaments = await Promise.all(ids.map((id) => getTournament(id as string)));

    return ok({ tournaments: tournaments.filter(Boolean) as Tournament[] });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { admin, error } = requireAdmin(req);
    if (error) return error;

    const body = await req.json();
    const { name, format, participants, settings } = createSchema.parse(body);

    const tournament = await createTournament(name, format, participants, settings);

    await logAdminAction(admin!.adminId, admin!.username, 'CREATE_TOURNAMENT', 'tournament', tournament.id, { name, format, participants });

    return ok({ tournament }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
