import { NextRequest } from 'next/server';
import { ok, fail, handleApiError } from '@/lib/api';
import { getTournament } from '@/lib/tournaments';
import { startTournament } from '@/lib/tournamentManager';

export async function POST(req: NextRequest, { params }: { params: { tournamentId: string } }) {
  try {
    const tournament = await getTournament(params.tournamentId);
    if (!tournament) return fail('NOT_FOUND', 'Tournament not found', 404);

    if (tournament.status !== 'pending') {
      return fail('CONFLICT', 'Tournament already started', 409);
    }

    // Start tournament and automatically create and queue games
    await startTournament(params.tournamentId);

    const updated = await getTournament(params.tournamentId);
    return ok({ tournament: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
