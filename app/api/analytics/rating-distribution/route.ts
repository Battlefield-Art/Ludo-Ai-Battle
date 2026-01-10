import { NextRequest } from 'next/server';
import { ok, handleApiError } from '@/lib/api';
import { getRatingDistribution } from '@/lib/analytics';

export async function GET(req: NextRequest) {
  try {
    const distribution = await getRatingDistribution();
    return ok({ distribution });
  } catch (error) {
    return handleApiError(error);
  }
}
