import { NextRequest } from 'next/server';
import { ok, fail, handleApiError } from '@/lib/api';
import { getReplay } from '@/lib/replay';

export async function GET(req: NextRequest, { params }: { params: { gameId: string } }) {
  try {
    const replay = await getReplay(params.gameId);
    if (!replay) return fail('NOT_FOUND', 'Replay not found', 404);
    return ok({ replay });
  } catch (error) {
    return handleApiError(error);
  }
}
