import { NextRequest } from 'next/server';
import { ok, handleApiError } from '@/lib/api';
import { getAnalyticsInsights } from '@/lib/analytics';

export async function GET(req: NextRequest) {
  try {
    const insights = await getAnalyticsInsights();
    return ok({ insights });
  } catch (error) {
    return handleApiError(error);
  }
}
