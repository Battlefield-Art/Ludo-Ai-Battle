import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { GameState } from '@/types/game';
import { updateAllStats } from '@/lib/stats';
import { getSSEManager } from '@/lib/sse';
import { z } from 'zod';

const updateSchema = z.object({
  gameId: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { gameId } = updateSchema.parse(body);

    const state = await redis.get<GameState>(`history:${gameId}`) || await redis.get<GameState>(`games:${gameId}`);
    if (!state) {
      return NextResponse.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Game not found' },
        timestamp: new Date().toISOString(),
      }, { status: 404 });
    }

    if (state.status !== 'completed' || !state.finalRanking) {
        return NextResponse.json({
            success: false,
            error: { code: 'BAD_REQUEST', message: 'Game not completed or no ranking available' },
            timestamp: new Date().toISOString(),
          }, { status: 400 });
    }

    await updateAllStats(state);

    // Emit leaderboard update via SSE
    try {
      const sseManager = getSSEManager();
      await sseManager.initialize();
      await sseManager.broadcastToLeaderboard({
        type: 'LEADERBOARD_UPDATED',
        timestamp: new Date().toISOString(),
        data: { reason: 'manual_update', gameId },
      });
    } catch {
      // ignore SSE errors
    }

    return NextResponse.json({
      success: true,
      message: 'Statistics updated successfully',
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
