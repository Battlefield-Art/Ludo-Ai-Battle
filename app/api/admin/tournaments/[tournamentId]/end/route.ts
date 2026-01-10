import { NextRequest } from 'next/server';
import { ok, fail, handleApiError } from '@/lib/api';
import { requireAdmin } from '@/lib/adminMiddleware';
import { getTournament, updateTournament, calculateStandings } from '@/lib/tournaments';
import { logAdminAction } from '@/lib/audit';

export async function POST(req: NextRequest, { params }: { params: { tournamentId: string } }) {
  try {
    const { admin, error } = requireAdmin(req);
    if (error) return error;

    const tournament = await getTournament(params.tournamentId);
    if (!tournament) return fail('NOT_FOUND', 'Tournament not found', 404);

    tournament.status = 'completed';
    tournament.completedAt = Date.now();

    const standings = calculateStandings(tournament);
    tournament.winnerId = standings[0]?.modelName;

    await updateTournament(tournament);

    await logAdminAction(admin!.adminId, admin!.username, 'END_TOURNAMENT', 'tournament', tournament.id);

    return ok({ tournament, standings });
  } catch (error) {
    return handleApiError(error);
  }
}
