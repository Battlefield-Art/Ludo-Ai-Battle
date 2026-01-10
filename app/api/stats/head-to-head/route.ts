import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { GameState } from '@/types/game';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const model1 = searchParams.get('model1');
  const model2 = searchParams.get('model2');

  if (!model1 || !model2) {
    return NextResponse.json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'model1 and model2 are required' },
      timestamp: new Date().toISOString(),
    }, { status: 400 });
  }

  try {
    // In a real production app, you might want to maintain a separate head-to-head set in Redis
    // For now, we'll scan history (this might be slow if history is large)
    const keys = await redis.keys('history:*');
    let gamesPlayed = 0;
    let model1Wins = 0;
    let model2Wins = 0;
    let model1Positions: number[] = [];
    let model2Positions: number[] = [];

    for (const key of keys) {
      const state = await redis.get<GameState>(key);
      if (!state || !state.players || !state.finalRanking) continue;

      const hasModel1 = state.players.some(p => p.model === model1);
      const hasModel2 = state.players.some(p => p.model === model2);

      if (hasModel1 && hasModel2) {
        gamesPlayed++;
        const pos1 = state.finalRanking.indexOf(state.players.find(p => p.model === model1)!.color) + 1;
        const pos2 = state.finalRanking.indexOf(state.players.find(p => p.model === model2)!.color) + 1;
        
        model1Positions.push(pos1);
        model2Positions.push(pos2);
        
        if (pos1 < pos2) model1Wins++;
        else if (pos2 < pos1) model2Wins++;
      }
    }

    const avgPos1 = model1Positions.length ? model1Positions.reduce((a, b) => a + b, 0) / model1Positions.length : 0;
    const avgPos2 = model2Positions.length ? model2Positions.reduce((a, b) => a + b, 0) / model2Positions.length : 0;

    return NextResponse.json({
      success: true,
      data: {
        gamesPlayed,
        model1Wins,
        model2Wins,
        winPercentage1: gamesPlayed ? (model1Wins / gamesPlayed) * 100 : 0,
        winPercentage2: gamesPlayed ? (model2Wins / gamesPlayed) * 100 : 0,
        avgPosition1: avgPos1,
        avgPosition2: avgPos2,
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
