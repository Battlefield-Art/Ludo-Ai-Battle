import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { GameState } from '@/types/game';

export async function GET(req: NextRequest) {
  try {
    // Get all active game IDs
    const activeGameIds = await redis.zrange('games:active:list', 0, -1);

    const activeGames = [];

    for (const gameId of activeGameIds) {
      const gameState = await redis.get<GameState>(`games:${gameId}`);
      if (gameState) {
        activeGames.push({
          gameId: gameState.gameId,
          status: gameState.status,
          models: gameState.players.map(p => p.model),
          moveCount: gameState.moveHistory.length,
          currentPlayer: gameState.players[gameState.currentPlayerIndex]?.model || null,
          createdAt: new Date(gameState.createdAt).toISOString(),
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: activeGames,
      count: activeGames.length,
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
