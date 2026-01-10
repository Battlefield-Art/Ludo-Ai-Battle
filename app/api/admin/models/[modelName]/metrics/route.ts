import { NextRequest } from 'next/server';
import { ok, handleApiError } from '@/lib/api';
import { requireAdmin } from '@/lib/adminMiddleware';
import { getModelStats } from '@/lib/stats';
import { getModelAnalytics } from '@/lib/analytics';

export async function GET(req: NextRequest, { params }: { params: { modelName: string } }) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    const stats = await getModelStats(params.modelName);
    const analytics = await getModelAnalytics(params.modelName);

    return ok({ stats, analytics });
  } catch (error) {
    return handleApiError(error);
  }
}
