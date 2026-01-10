import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, handleApiError, fail } from '@/lib/api';
import { createTournament, getTournament } from '@/lib/tournaments';
import { redis } from '@/lib/redis';
import { Tournament } from '@/types/tournament';

const createSchema = z.object({
  name: z.string().min(1),
  format: z.enum(['round-robin', 'knockout', 'best-of-n']),
  participants: z.array(z.string()).min(2),
  settings: z
    .object({
      bestOfN: z.number().optional(),
      knockoutType: z.enum(['single', 'double']).optional(),
      gamesPerMatch: z.number().optional(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, format, participants, settings } = createSchema.parse(body);

    const tournament = await createTournament(name, format, participants, settings);

    return ok({ tournament }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const offset = parseInt(searchParams.get('offset') || '0');
    const limit = parseInt(searchParams.get('limit') || '20');

    const ids = await redis.zrange('tournaments:list', 0, -1, { rev: true });
    const tournaments = await Promise.all(
      ids.slice(offset, offset + limit).map((id) => getTournament(id as string))
    );

    return ok({
      tournaments: tournaments.filter(Boolean) as Tournament[],
      pagination: { offset, limit, total: ids.length },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
