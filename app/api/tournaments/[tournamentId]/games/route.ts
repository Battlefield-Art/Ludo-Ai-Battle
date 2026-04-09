import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { getTournament } from '@/lib/tournaments';
import { getTournamentGames, getMatchGames } from '@/lib/tournamentManager';
import { ok, fail, handleApiError } from '@/lib/api';
import { z } from 'zod';

const gamesSchema = z.object({
  matchId: z.string().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { tournamentId: string } }
) {
  try {
    const tournament = await getTournament(params.tournamentId);
    if (!tournament) return fail('NOT_FOUND', 'Tournament not found', 404);

    const { searchParams } = new URL(req.url);
    const { matchId } = gamesSchema.parse({
      matchId: searchParams.get('matchId'),
    });

    let gameIds: string[] = [];
    if (matchId) {
      gameIds = await getMatchGames(params.tournamentId, matchId);
    } else {
      gameIds = await getTournamentGames(params.tournamentId);
    }

    // Fetch game states for all game IDs
    const games = await Promise.all(
      gameIds.map(async (gameId) => {
        const game = await redis.get<any>(`games:${gameId}`);
        return game ? { gameId, ...game } : null;
      })
    );

    const validGames = games.filter((g) => g !== null);

    return NextResponse.json({
      success: true,
      data: {
        tournamentId: params.tournamentId,
        matchId: matchId || null,
        games: validGames,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
