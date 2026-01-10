import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { getValidMoves, applyMove } from '@/lib/game';
import { AIGateway } from '@/lib/ai/gateway';
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

    if (state.status === 'completed') {
      return NextResponse.json({
        success: false,
        error: { code: 'CONFLICT', message: 'Game already completed' },
        timestamp: new Date().toISOString(),
      }, { status: 409 });
    }

    const diceRoll = manualDiceRoll || Math.floor(Math.random() * 6) + 1;
    state.diceRoll = diceRoll;

    const currentPlayer = state.players[state.currentPlayerIndex];
    const validMoves = getValidMoves(state, diceRoll);

    let moveResult;
    if (validMoves.length === 0) {
      // No valid moves, skip turn
      state.currentPlayerIndex = (state.currentPlayerIndex + 1) % 4;
      while (state.players[state.currentPlayerIndex].piecesState.every(p => p.position === 52)) {
          state.currentPlayerIndex = (state.currentPlayerIndex + 1) % 4;
      }
      moveResult = { skipped: true };
    } else {
      const aiMove = await AIGateway.getMove(
        currentPlayer.model,
        currentPlayer.color,
        state,
        validMoves
      );

      // Validate move is in validMoves
      const isValid = validMoves.some(m => m.pieceId === aiMove.pieceId && m.action === aiMove.action);
      if (!isValid) {
          // If AI suggested invalid move, take the first valid move
          aiMove.pieceId = validMoves[0].pieceId;
          aiMove.action = validMoves[0].action;
          aiMove.targetPosition = validMoves[0].targetPosition;
          aiMove.reasoning = 'Invalid move suggested by AI, fallback to first valid move.';
      }

      const updatedState = applyMove(state, aiMove, diceRoll);
      await redis.set(`games:${gameId}`, updatedState, { ex: 86400 });
      await redis.rpush(`moves:${gameId}`, JSON.stringify({ aiMove, diceRoll, timestamp: Date.now() }));
      
      moveResult = { executed: aiMove, skipped: false };
    }

    // Update state again for skipped turn
    await redis.set(`games:${gameId}`, state, { ex: 86400 });

    return NextResponse.json({
      success: true,
      data: {
        move: moveResult,
        state,
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
