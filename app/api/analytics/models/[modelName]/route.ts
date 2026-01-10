import { NextRequest } from 'next/server';
import { ok, handleApiError } from '@/lib/api';
import { getModelAnalytics } from '@/lib/analytics';

export async function GET(req: NextRequest, { params }: { params: { modelName: string } }) {
  try {
    const analytics = await getModelAnalytics(params.modelName);
    return ok({ analytics });
  } catch (error) {
    return handleApiError(error);
  }
}
