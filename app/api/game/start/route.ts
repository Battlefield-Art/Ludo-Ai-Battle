import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { createInitialState } from '@/lib/game';
import { initReplay } from '@/lib/replay';
import { getSSEManager } from '@/lib/sse';
import { queueGameMove } from '@/lib/queue';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

const startSchema = z.object({
  models: z.array(z.enum(['openai', 'gpt-4', 'deepseek', 'google', 'gemini', 'xai', 'grok'])).length(4).optional(),
  autoPlay: z.boolean().optional().default(true),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { models = ['openai', 'deepseek', 'google', 'xai'], autoPlay } = startSchema.parse(body);

    const gameId = uuidv4();
    const initialState = createInitialState(gameId, models);

    await redis.set(`games:${gameId}`, initialState, { ex: 86400 }); // 24h TTL
    await redis.zadd('games:active:list', { score: Date.now(), member: gameId });

    // Initialize replay
    await initReplay(initialState);

    // Emit SSE event
    try {
      const sseManager = getSSEManager();
      await sseManager.initialize();
      await sseManager.broadcastToGame(gameId, {
        type: 'GAME_STARTED',
        gameId,
        timestamp: new Date().toISOString(),
        data: { state: initialState },
      });
    } catch (sseError) {
      // SSE might not be initialized, that's OK
      console.log('SSE not available:', sseError);
    }

    // Queue the game for auto-play if enabled
    if (autoPlay) {
      await queueGameMove(gameId, 1000); // Start with a 1 second delay
    }

    return NextResponse.json({
      success: true,
      data: {
        gameId,
        state: initialState,
        autoPlay,
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
