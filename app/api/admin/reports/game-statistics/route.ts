import { NextRequest } from 'next/server';
import { ok, handleApiError } from '@/lib/api';
import { requireAdmin } from '@/lib/adminMiddleware';
import { getGameAnalytics } from '@/lib/analytics';

export async function GET(req: NextRequest) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    const analytics = await getGameAnalytics();
    return ok({ analytics });
  } catch (error) {
    return handleApiError(error);
  }
}
