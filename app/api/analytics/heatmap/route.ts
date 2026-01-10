import { NextRequest } from 'next/server';
import { ok, handleApiError } from '@/lib/api';

export async function GET(req: NextRequest) {
  try {
    // Placeholder endpoint - heatmap computation requires aggregating replay/history.
    return ok({ heatmap: {} });
  } catch (error) {
    return handleApiError(error);
  }
}
