import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { createInitialState } from '@/lib/game';
import { initReplay } from '@/lib/replay';
import { getWebSocketManager } from '@/lib/websocket';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

const startSchema = z.object({
  models: z.array(z.string()).length(4).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { models = ['openai', 'deepseek', 'google', 'xai'] } = startSchema.parse(body);
    
    const gameId = uuidv4();
    const initialState = createInitialState(gameId, models);
    
    await redis.set(`games:${gameId}`, initialState, { ex: 86400 }); // 24h TTL
    await redis.zadd('games:active:list', { score: Date.now(), member: gameId });

    // Initialize replay
    await initReplay(initialState);

    // Emit WebSocket event
    try {
      const wsManager = getWebSocketManager();
      await wsManager.broadcastToGame(gameId, {
        type: 'GAME_STARTED',
        gameId,
        timestamp: new Date().toISOString(),
        data: { state: initialState },
      });
    } catch (wsError) {
      // WebSocket might not be initialized, that's OK
      console.log('WebSocket not available:', wsError);
    }

    return NextResponse.json({
      success: true,
      data: {
        gameId,
        state: initialState,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: { code: 'BAD_REQUEST', message: error.message },
      timestamp: new Date().toISOString(),
    }, { status: 400 });
  }
}
