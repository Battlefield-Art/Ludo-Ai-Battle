import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { ModelStats } from '@/types/game';

export async function GET(req: NextRequest) {
  try {
    const leaderboard = await redis.zrevrange('leaderboard', 0, -1, { withScores: true }) as string[];
    
    const stats: ModelStats[] = [];
    // leaderboard is an array of alternating members and scores
    for (let i = 0; i < leaderboard.length; i += 2) {
      const modelName = leaderboard[i] as string;
      const modelStats = await redis.get<ModelStats>(`stats:${modelName}`);
      if (modelStats) {
        stats.push(modelStats);
      }
    }

    return NextResponse.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=59',
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
