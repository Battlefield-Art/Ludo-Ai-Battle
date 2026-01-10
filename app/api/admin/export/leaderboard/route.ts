import { NextRequest, NextResponse } from 'next/server';
import { stringify } from 'csv-stringify/sync';
import { requireAdmin } from '@/lib/adminMiddleware';
import { redis } from '@/lib/redis';

export async function GET(req: NextRequest) {
  const { error } = requireAdmin(req);
  if (error) return error;

  const leaderboard = await redis.zrange('leaderboard', 0, -1, { rev: true, withScores: true });
  const rows: Array<{ model: string; elo: number }> = [];

  for (let i = 0; i < leaderboard.length; i += 2) {
    rows.push({
      model: leaderboard[i] as string,
      elo: parseFloat(leaderboard[i + 1] as string),
    });
  }

  const csv = stringify(rows, { header: true, columns: ['model', 'elo'] });

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="leaderboard.csv"',
    },
  });
}
