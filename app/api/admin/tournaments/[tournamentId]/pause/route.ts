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

    tournament.status = 'paused';
    await updateTournament(tournament);

    await logAdminAction(admin!.adminId, admin!.username, 'PAUSE_TOURNAMENT', 'tournament', tournament.id);

    return ok({ tournament });
  } catch (error) {
    return handleApiError(error);
  }
}
