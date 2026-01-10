import { NextRequest } from 'next/server';
import { ok, fail, handleApiError } from '@/lib/api';
import { getTournament, updateTournament, generateRoundRobinMatches, generateKnockoutMatches, generateBestOfNMatches } from '@/lib/tournaments';

export async function POST(req: NextRequest, { params }: { params: { tournamentId: string } }) {
  try {
    const tournament = await getTournament(params.tournamentId);
    if (!tournament) return fail('NOT_FOUND', 'Tournament not found', 404);

    if (tournament.status !== 'pending') {
      return fail('CONFLICT', 'Tournament already started', 409);
    }

    // Generate matches based on format
    switch (tournament.format) {
      case 'round-robin':
        tournament.rounds = generateRoundRobinMatches(tournament.participants);
        break;
      case 'knockout':
        tournament.rounds = generateKnockoutMatches(
          tournament.participants,
          tournament.settings.knockoutType
        );
        break;
      case 'best-of-n':
        tournament.rounds = generateBestOfNMatches(
          tournament.participants,
          tournament.settings.bestOfN
        );
        break;
    }

    tournament.status = 'active';
    tournament.startedAt = Date.now();
    tournament.currentRound = 1;

    await updateTournament(tournament);

    return ok({ tournament });
  } catch (error) {
    return handleApiError(error);
  }
}
