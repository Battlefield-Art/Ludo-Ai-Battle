import { NextRequest } from 'next/server';
import { ok, fail, handleApiError } from '@/lib/api';
import { getTournament, updateTournament } from '@/lib/tournaments';

export async function POST(req: NextRequest, { params }: { params: { tournamentId: string } }) {
  try {
    const tournament = await getTournament(params.tournamentId);
    if (!tournament) return fail('NOT_FOUND', 'Tournament not found', 404);

    if (tournament.status !== 'active') {
      return fail('CONFLICT', 'Tournament is not active', 409);
    }

    tournament.status = 'paused';
    await updateTournament(tournament);

    return ok({ tournament });
  } catch (error) {
    return handleApiError(error);
  }
}
