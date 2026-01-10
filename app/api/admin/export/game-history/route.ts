import { NextRequest, NextResponse } from 'next/server';
import { stringify } from 'csv-stringify/sync';
import { requireAdmin } from '@/lib/adminMiddleware';
import { redis } from '@/lib/redis';
import { GameState } from '@/types/game';

export async function GET(req: NextRequest) {
  const { error } = requireAdmin(req);
  if (error) return error;

  const keys = await redis.keys('history:*');
  const gameIds = keys.map((k) => k.replace('history:', ''));
  const games = await Promise.all(gameIds.map((gameId) => redis.get<GameState>(`history:${gameId}`)));

  const rows = games
    .filter((g): g is GameState => Boolean(g))
    .map((g) => ({
      gameId: g.gameId,
      status: g.status,
      createdAt: new Date(g.createdAt).toISOString(),
      completedAt: g.completedAt ? new Date(g.completedAt).toISOString() : '',
      winner: g.finalRanking?.[0] ?? '',
      moves: g.moveHistory.length,
    }));

  const csv = stringify(rows, { header: true });

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="game-history.csv"',
    },
  });
}
