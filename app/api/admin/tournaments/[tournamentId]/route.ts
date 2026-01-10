import { NextRequest } from 'next/server';
import { ok, fail, handleApiError } from '@/lib/api';
import { requireAdmin } from '@/lib/adminMiddleware';
import { getTournament, calculateStandings, generateBracketVisualization } from '@/lib/tournaments';

export async function GET(req: NextRequest, { params }: { params: { tournamentId: string } }) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    const tournament = await getTournament(params.tournamentId);
    if (!tournament) return fail('NOT_FOUND', 'Tournament not found', 404);

    const standings = calculateStandings(tournament);
    const bracket = generateBracketVisualization(tournament);

    return ok({ tournament, standings, bracket });
  } catch (error) {
    return handleApiError(error);
  }
}
