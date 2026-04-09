import { NextRequest } from 'next/server';
import { ok, fail, handleApiError } from '@/lib/api';
import { getTournament, updateTournament } from '@/lib/tournaments';
import { pauseTournament, resumeTournament } from '@/lib/tournamentManager';
import { z } from 'zod';

const pauseSchema = z.object({
  action: z.enum(['pause', 'resume']).default('pause'),
});

export async function POST(req: NextRequest, { params }: { params: { tournamentId: string } }) {
  try {
    const tournament = await getTournament(params.tournamentId);
    if (!tournament) return fail('NOT_FOUND', 'Tournament not found', 404);

    const body = await req.json().catch(() => ({}));
    const { action } = pauseSchema.parse(body);

    if (action === 'pause') {
      if (tournament.status !== 'active') {
        return fail('CONFLICT', 'Tournament is not active', 409);
      }
      await pauseTournament(params.tournamentId);
    } else {
      if (tournament.status !== 'paused') {
        return fail('CONFLICT', 'Tournament is not paused', 409);
      }
      await resumeTournament(params.tournamentId);
    }

    const updated = await getTournament(params.tournamentId);
    return ok({ tournament: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
