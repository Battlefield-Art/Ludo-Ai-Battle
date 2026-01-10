import { NextRequest } from 'next/server';
import { ok, fail, handleApiError } from '@/lib/api';
import { requireAdmin } from '@/lib/adminMiddleware';
import { getTournament, updateTournament } from '@/lib/tournaments';
import { logAdminAction } from '@/lib/audit';

export async function POST(req: NextRequest, { params }: { params: { tournamentId: string } }) {
  try {
    const { admin, error } = requireAdmin(req);
    if (error) return error;

    const tournament = await getTournament(params.tournamentId);
    if (!tournament) return fail('NOT_FOUND', 'Tournament not found', 404);

    if (tournament.status !== 'active') return fail('CONFLICT', 'Tournament not active', 409);

    tournament.currentRound = Math.min(tournament.currentRound + 1, tournament.rounds.length);
    await updateTournament(tournament);

    await logAdminAction(admin!.adminId, admin!.username, 'ADVANCE_ROUND', 'tournament', tournament.id, { currentRound: tournament.currentRound });

    return ok({ tournament });
  } catch (error) {
    return handleApiError(error);
  }
}
