import { NextRequest } from 'next/server';
import { ok, fail, handleApiError } from '@/lib/api';
import { redis } from '@/lib/redis';

export async function GET(req: NextRequest, { params }: { params: { reportId: string } }) {
  try {
    const report = await redis.get(`report:${params.reportId}`);
    if (!report) return fail('NOT_FOUND', 'Report not found', 404);
    return ok({ report });
  } catch (error) {
    return handleApiError(error);
  }
}
