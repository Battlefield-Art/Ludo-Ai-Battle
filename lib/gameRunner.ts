import { redis } from '@/lib/redis';
import { getValidMoves, applyMove } from '@/lib/game';
import { AIGateway } from '@/lib/ai/gateway';
import { appendReplayMove } from '@/lib/replay';
import { getSSEManager } from '@/lib/sse';
import { queueGameMove } from '@/lib/queue';
import { GameState } from '@/types/game';

/**
 * Execute a single move for a game
 * This is called by both the /api/game/move endpoint and the BullMQ worker
 */
export async function performGameMove(gameId: string, manualDiceRoll?: number): Promise<any> {
  const state = await redis.get<GameState>(`games:${gameId}`);
  if (!state) {
    throw new Error('Game not found');
  }

  if (state.status === 'completed') {
    return { gameId, status: 'completed', message: 'Game already completed' };
  }

  if (state.status === 'paused') {
    return { gameId, status: 'paused', message: 'Game is paused' };
  }

  if (state.status === 'cancelled') {
    return { gameId, status: 'cancelled', message: 'Game is cancelled' };
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
  }

  // Update game state in Redis
  await redis.set(`games:${gameId}`, updatedState, { ex: 86400 });

  // Emit realtime events via SSE
  try {
    const sseManager = getSSEManager();
    await sseManager.initialize();
    await sseManager.broadcastToGame(gameId, {
      type: 'MOVE_EXECUTED',
      gameId,
      timestamp: new Date().toISOString(),
      data: { move: moveResult.executed || moveResult.skipped, diceRoll },
    });
    await sseManager.broadcastToGame(gameId, {
      type: 'GAME_STATE_UPDATED',
      gameId,
      timestamp: new Date().toISOString(),
      data: { state: updatedState, delta: { move: moveResult, diceRoll } },
    });

    if (updatedState.status === 'completed') {
      await sseManager.broadcastToGame(gameId, {
        type: 'GAME_COMPLETED',
        gameId,
        timestamp: new Date().toISOString(),
        data: { finalRanking: updatedState.finalRanking, state: updatedState },
      });

      // Remove from active games list
      await redis.zrem('games:active:list', gameId);
    }
  } catch (sseError) {
    // ignore SSE errors
    console.log('SSE error:', sseError);
  }

  // If game is still active, queue next move
  if (updatedState.status === 'active') {
    // Add a small delay between moves (2 seconds)
    await queueGameMove(gameId, 2000);
  }

  return {
    gameId,
    move: moveResult,
    state: updatedState,
    status: updatedState.status,
  };
}
