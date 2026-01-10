import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { GameState } from '@/types/game';
import { z } from 'zod';
import { updateAllStats } from '@/lib/stats';
import { completeReplay } from '@/lib/replay';
import { recordGameCompletion } from '@/lib/analytics';
import { getWebSocketManager } from '@/lib/websocket';

const endSchema = z.object({
  gameId: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { gameId } = endSchema.parse(body);

    const state = await redis.get<GameState>(`games:${gameId}`);
    if (!state) {
      return NextResponse.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Game not found' },
        timestamp: new Date().toISOString(),
      }, { status: 404 });
    }

    if (state.status !== 'completed' && !state.finalRanking) {
        // Force end if needed, but normally it should be completed by the game logic
        state.status = 'completed';
        state.completedAt = Date.now();
    }

    // Store in history
    await redis.set(`history:${gameId}`, state, { ex: 31536000 }); // 1 year TTL

    // Complete replay
    if (state.completedAt) {
      await completeReplay(gameId, state.completedAt);
    }

    // Trigger statistics update
    await updateAllStats(state);

    // Record analytics
    if (state.completedAt) {
      const duration = state.completedAt - state.createdAt;
      await recordGameCompletion(state, duration);
    }

    // Remove from active list
    await redis.zrem('games:active:list', gameId);

    // Emit WebSocket events
    try {
      const wsManager = getWebSocketManager();
      await wsManager.broadcastToGame(gameId, {
        type: 'GAME_COMPLETED',
        gameId,
        timestamp: new Date().toISOString(),
        data: { finalRanking: state.finalRanking, state },
      });
      await wsManager.broadcastToLeaderboard({
        type: 'LEADERBOARD_UPDATED',
        timestamp: new Date().toISOString(),
        data: { reason: 'game_completed', gameId },
      });
    } catch {
      // ignore websocket errors
    }

    return NextResponse.json({
      success: true,
      data: {
        results: state.finalRanking,
        state,
      },
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

