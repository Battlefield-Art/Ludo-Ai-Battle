import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { getValidMoves, applyMove } from '@/lib/game';
import { AIGateway } from '@/lib/ai/gateway';
import { appendReplayMove } from '@/lib/replay';
import { getWebSocketManager } from '@/lib/websocket';
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

    if (state.status === 'paused') {
      return NextResponse.json({
        success: false,
        error: { code: 'CONFLICT', message: 'Game is paused' },
        timestamp: new Date().toISOString(),
      }, { status: 409 });
    }

    if (state.status === 'cancelled') {
      return NextResponse.json({
        success: false,
        error: { code: 'CONFLICT', message: 'Game is cancelled' },
        timestamp: new Date().toISOString(),
      }, { status: 409 });
    }

    const diceRoll = manualDiceRoll || Math.floor(Math.random() * 6) + 1;
    state.diceRoll = diceRoll;

    const currentPlayer = state.players[state.currentPlayerIndex];
    const validMoves = getValidMoves(state, diceRoll);

    let moveResult: any;
    let updatedState = state;

    if (validMoves.length === 0) {
      // No valid moves, skip turn
      updatedState.currentPlayerIndex = (updatedState.currentPlayerIndex + 1) % 4;
      while (updatedState.players[updatedState.currentPlayerIndex].piecesState.every(p => p.position === 52)) {
        updatedState.currentPlayerIndex = (updatedState.currentPlayerIndex + 1) % 4;
      }
      moveResult = { skipped: true };
    } else {
      const aiMove = await AIGateway.getMove(
        currentPlayer.model,
        currentPlayer.color,
        updatedState,
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

      updatedState = applyMove(updatedState, aiMove, diceRoll);
      await redis.rpush(`moves:${gameId}`, JSON.stringify({ aiMove, diceRoll, timestamp: Date.now() }));

      // Append replay move (store board snapshot as the updated state)
      try {
        await appendReplayMove(gameId, {
          playerColor: currentPlayer.color,
          diceRoll,
          piece: aiMove.pieceId,
          action: aiMove.action,
          position: aiMove.targetPosition,
          boardState: updatedState,
          timestamp: Date.now(),
          reasoning: aiMove.reasoning,
        });
      } catch {
        // replay might not be initialized, ignore
      }

      moveResult = { executed: aiMove, skipped: false };

      // Emit realtime event(s)
      try {
        const wsManager = getWebSocketManager();
        await wsManager.broadcastToGame(gameId, {
          type: 'MOVE_EXECUTED',
          gameId,
          timestamp: new Date().toISOString(),
          data: { move: aiMove, diceRoll },
        });
        await wsManager.broadcastToGame(gameId, {
          type: 'GAME_STATE_UPDATED',
          gameId,
          timestamp: new Date().toISOString(),
          data: { state: updatedState, delta: { move: aiMove, diceRoll } },
        });
        if (updatedState.status === 'completed') {
          await wsManager.broadcastToGame(gameId, {
            type: 'GAME_COMPLETED',
            gameId,
            timestamp: new Date().toISOString(),
            data: { finalRanking: updatedState.finalRanking, state: updatedState },
          });
        }
      } catch {
        // ignore websocket errors
      }
    }

    await redis.set(`games:${gameId}`, updatedState, { ex: 86400 });

    return NextResponse.json({
      success: true,
      data: {
        move: moveResult,
        state: updatedState,
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
