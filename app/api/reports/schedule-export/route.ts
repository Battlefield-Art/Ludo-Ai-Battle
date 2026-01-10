import { NextRequest } from 'next/server';
import { ok } from '@/lib/api';

export async function POST(req: NextRequest) {
  // Placeholder for scheduled exports. In production, integrate with cron/queue.
  return ok({ scheduled: true });
}
