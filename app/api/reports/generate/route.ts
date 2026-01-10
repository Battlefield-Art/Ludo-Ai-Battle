import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, handleApiError } from '@/lib/api';
import { redis } from '@/lib/redis';
import { v4 as uuidv4 } from 'uuid';

const schema = z.object({
  tournamentId: z.string().optional(),
  gameId: z.string().optional(),
  type: z.string().default('tournament'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tournamentId, gameId, type } = schema.parse(body);

    const reportId = uuidv4();
    const report = {
      reportId,
      type,
      tournamentId,
      gameId,
      createdAt: new Date().toISOString(),
      status: 'completed',
      data: {
        tournament: tournamentId ? await redis.get(`tournament:${tournamentId}`) : null,
        game: gameId ? await redis.get(`history:${gameId}`) : null,
      },
    };

    await redis.set(`report:${reportId}`, report, { ex: 7 * 24 * 3600 });

    return ok({ reportId });
  } catch (error) {
    return handleApiError(error);
  }
}
