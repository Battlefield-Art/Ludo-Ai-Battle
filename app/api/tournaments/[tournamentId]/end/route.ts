import { NextRequest } from 'next/server';
import { ok, fail, handleApiError } from '@/lib/api';
import { getTournament, updateTournament, calculateStandings } from '@/lib/tournaments';

export async function POST(req: NextRequest, { params }: { params: { tournamentId: string } }) {
  try {
    const tournament = await getTournament(params.tournamentId);
    if (!tournament) return fail('NOT_FOUND', 'Tournament not found', 404);

    tournament.status = 'completed';
    tournament.completedAt = Date.now();

    const standings = calculateStandings(tournament);
    tournament.winnerId = standings[0]?.modelName;

    await updateTournament(tournament);

    return ok({ tournament, standings });
  } catch (error) {
    return handleApiError(error);
  }
}
