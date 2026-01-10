import { NextRequest, NextResponse } from 'next/server';
import { stringify } from 'csv-stringify/sync';
import { getRatingDistribution } from '@/lib/analytics';

export async function POST(req: NextRequest) {
  const distribution = await getRatingDistribution();
  const csv = stringify(distribution, { header: true });
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="analytics-export.csv"',
    },
  });
}
