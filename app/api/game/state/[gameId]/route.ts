import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { GameState } from '@/types/game';

export async function GET(
  req: NextRequest,
  { params }: { params: { gameId: string } }
) {
  const { gameId } = params;

  try {
    const state = await redis.get<GameState>(`games:${gameId}`);
    if (!state) {
      return NextResponse.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Game not found' },
        timestamp: new Date().toISOString(),
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: state,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
