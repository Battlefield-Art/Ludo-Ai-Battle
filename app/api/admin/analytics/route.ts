import { NextRequest } from 'next/server';
import { ok, handleApiError } from '@/lib/api';
import { requireAdmin } from '@/lib/adminMiddleware';
import { getGameAnalytics, getAnalyticsInsights, getRatingDistribution } from '@/lib/analytics';

export async function GET(req: NextRequest) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    const gameAnalytics = await getGameAnalytics();
    const insights = await getAnalyticsInsights();
    const ratingDistribution = await getRatingDistribution();

    return ok({
      gameAnalytics,
      insights,
      ratingDistribution,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
