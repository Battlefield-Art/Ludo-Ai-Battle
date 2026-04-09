import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { performGameMove } from '@/lib/gameRunner';
import { z } from 'zod';
import { GameState } from '@/types/game';

const moveSchema = z.object({
  gameId: z.string(),
  diceRoll: z.number().min(1).max(6).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { gameId, diceRoll: manualDiceRoll } = moveSchema.parse(body);

    const state = await redis.get<GameState>(`games:${gameId}`);
    if (!state) {
      return NextResponse.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Game not found' },
        timestamp: new Date().toISOString(),
      }, { status: 404 });
    }

    // Execute the move using shared logic
    const result = await performGameMove(gameId, manualDiceRoll);

    return NextResponse.json({
      success: true,
      data: {
        move: result.move,
        state: result.state,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Move error:', error);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
