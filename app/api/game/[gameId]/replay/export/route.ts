import { NextRequest, NextResponse } from 'next/server';
import { fail, handleApiError } from '@/lib/api';
import { getReplay } from '@/lib/replay';

export async function POST(req: NextRequest, { params }: { params: { gameId: string } }) {
  try {
    const replay = await getReplay(params.gameId);
    if (!replay) return fail('NOT_FOUND', 'Replay not found', 404);

    // Export as JSON file
    const json = JSON.stringify(replay, null, 2);

    return new NextResponse(json, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="replay-${params.gameId}.json"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
