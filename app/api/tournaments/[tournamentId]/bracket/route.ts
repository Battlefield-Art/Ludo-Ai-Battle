import { NextRequest } from 'next/server';
import { ok, fail, handleApiError } from '@/lib/api';
import { getTournament, generateBracketVisualization } from '@/lib/tournaments';

export async function GET(req: NextRequest, { params }: { params: { tournamentId: string } }) {
  try {
    const tournament = await getTournament(params.tournamentId);
    if (!tournament) return fail('NOT_FOUND', 'Tournament not found', 404);
    const bracket = generateBracketVisualization(tournament);
    return ok({ bracket });
  } catch (error) {
    return handleApiError(error);
  }
}
