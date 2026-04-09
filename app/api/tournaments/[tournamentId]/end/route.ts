import { NextRequest } from 'next/server';
import { ok, fail, handleApiError } from '@/lib/api';
import { getTournament } from '@/lib/tournaments';
import { endTournament } from '@/lib/tournamentManager';

export async function POST(req: NextRequest, { params }: { params: { tournamentId: string } }) {
  try {
    const tournament = await getTournament(params.tournamentId);
    if (!tournament) return fail('NOT_FOUND', 'Tournament not found', 404);

    if (tournament.status === 'completed') {
      return fail('CONFLICT', 'Tournament is already completed', 409);
    }

    await endTournament(params.tournamentId);

    const updated = await getTournament(params.tournamentId);
    if (!updated) {
      return fail('INTERNAL_ERROR', 'Failed to retrieve updated tournament', 500);
    }
    const { calculateStandings } = await import('@/lib/tournaments');
    const standings = calculateStandings(updated);

    return ok({ tournament: updated, standings });
  } catch (error) {
    return handleApiError(error);
  }
}
