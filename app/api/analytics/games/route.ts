import { NextRequest } from 'next/server';
import { ok, handleApiError } from '@/lib/api';
import { getGameAnalytics } from '@/lib/analytics';

export async function GET(req: NextRequest) {
  try {
    const analytics = await getGameAnalytics();
    return ok({ analytics });
  } catch (error) {
    return handleApiError(error);
  }
}
