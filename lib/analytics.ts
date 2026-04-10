import { redis } from '@/lib/redis';
import {
  ModelAnalytics,
  GameAnalytics,
  AnalyticsInsights,
  TrendPoint,
  RatingDistribution,
} from '@/types/analytics';
import { ModelStats, GameState } from '@/types/game';
import { getModelStats } from '@/lib/stats';

export async function getModelAnalytics(modelName: string): Promise<ModelAnalytics> {
  const stats = await getModelStats(modelName);
  
  // Get trend data from Redis
  const winRateTrend = await redis.lrange(`analytics:${modelName}:winrate`, 0, -1);
  const eloTrend = await redis.lrange(`analytics:${modelName}:elo`, 0, -1);
  const responseTimeTrend = await redis.lrange(`analytics:${modelName}:responsetime`, 0, -1);
  const errorRateTrend = await redis.lrange(`analytics:${modelName}:errorrate`, 0, -1);

  return {
    modelName,
    winRateTrend: (winRateTrend as string[]).map((item) => JSON.parse(item)),
    eloProgression: (eloTrend as string[]).map((item) => JSON.parse(item)),
    responseTimeTrend: (responseTimeTrend as string[]).map((item) => JSON.parse(item)),
    errorRateTrend: (errorRateTrend as string[]).map((item) => JSON.parse(item)),
    strategyPatterns: [],
  };
}

export async function recordAnalyticsPoint(
  modelName: string,
  metric: 'winrate' | 'elo' | 'responsetime' | 'errorrate',
  value: number
): Promise<void> {
  const point: TrendPoint = {
    timestamp: Date.now(),
    value,
  };

  await redis.rpush(`analytics:${modelName}:${metric}`, JSON.stringify(point));
  
  // Keep only last 1000 points
  await redis.ltrim(`analytics:${modelName}:${metric}`, -1000, -1);
}

export async function getGameAnalytics(): Promise<GameAnalytics> {
  const totalGames = (await redis.get<number>('stats:total-games')) || 0;
  const activeGameIds = await redis.zrange('games:active:list', 0, -1);
  const activeGames = activeGameIds.length;

  // Get completed games count
  const completedGames = totalGames - activeGames;

  // Calculate average duration
  const durations = await redis.lrange('analytics:game-durations', 0, -1);
  const avgDuration = durations.length > 0
    ? durations.reduce((sum, d) => sum + parseFloat(d as string), 0) / durations.length
    : 0;

  return {
    totalGames,
    activeGames,
    completedGames,
    averageDuration: avgDuration,
    durationByMatchup: {},
    capturePatterns: [],
    piecePositionHeatmap: {},
    winningPatterns: [],
  };
}

export async function recordGameCompletion(
  gameState: GameState,
  duration: number
): Promise<void> {
  // Record duration
  await redis.rpush('analytics:game-durations', duration.toString());
  await redis.ltrim('analytics:game-durations', -1000, -1);

  // Update total games
  await redis.incr('stats:total-games');

  // Record per-model analytics
  for (const player of gameState.players) {
    const stats = await getModelStats(player.model);
    await recordAnalyticsPoint(player.model, 'winrate', stats.winRate);
    await recordAnalyticsPoint(player.model, 'elo', stats.elo);
  }
}

export async function getAnalyticsInsights(): Promise<AnalyticsInsights> {
  // Get all model names from leaderboard
  const leaderboard = await redis.zrange('leaderboard', 0, -1) as string[];
  const modelNames = leaderboard;

  const allStats = await Promise.all(modelNames.map((m) => getModelStats(m)));

  // Sort by ELO
  const sorted = allStats.sort((a, b) => b.elo - a.elo);
  const topPerformer = sorted[0]?.modelName || 'N/A';

  // Find most improved (compare recent vs older ELO)
  let mostImproved = 'N/A';
  let maxImprovement = 0;
  
  for (const modelName of modelNames) {
    const eloTrend = await redis.lrange(`analytics:${modelName}:elo`, 0, -1);
    if (eloTrend.length > 10) {
      const recent = JSON.parse(eloTrend[eloTrend.length - 1] as string).value;
      const old = JSON.parse(eloTrend[0] as string).value;
      const improvement = recent - old;
      if (improvement > maxImprovement) {
        maxImprovement = improvement;
        mostImproved = modelName;
      }
    }
  }

  // Most consistent (lowest variance in win rate)
  let mostConsistent = 'N/A';
  let minVariance = Infinity;
  
  for (const modelName of modelNames) {
    const winRateTrend = await redis.lrange(`analytics:${modelName}:winrate`, 0, -1);
    if (winRateTrend.length > 5) {
      const values = winRateTrend.map((s) => JSON.parse(s as string).value);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
      if (variance < minVariance) {
        minVariance = variance;
        mostConsistent = modelName;
      }
    }
  }

  // Get game durations
  const durations = await redis.lrange('analytics:game-durations', 0, -1);
  const avgDuration = durations.length > 0
    ? durations.reduce((sum, d) => sum + parseFloat(d as string), 0) / durations.length
    : 0;

  // Get fastest and longest games (simplified)
  const gameIds = await redis.zrange('games:active:list', 0, -1);
  
  return {
    topPerformer,
    mostImprovedModel: mostImproved,
    mostConsistentModel: mostConsistent,
    peakActivityHour: 14, // Placeholder
    averageGameDuration: avgDuration,
    totalPiecesCapture: 0, // Would need to aggregate from game history
    fastestGame: {
      gameId: 'N/A',
      duration: 0,
      winner: 'N/A',
    },
    longestGame: {
      gameId: 'N/A',
      duration: 0,
      winner: 'N/A',
    },
  };
}

export async function getRatingDistribution(): Promise<RatingDistribution[]> {
  // Get all model names from leaderboard
  const leaderboard = await redis.zrange('leaderboard', 0, -1) as string[];
  const modelNames = leaderboard;
  const allStats = await Promise.all(modelNames.map((m) => getModelStats(m)));

  const ranges = [
    { min: 0, max: 1200, label: '0-1200' },
    { min: 1200, max: 1400, label: '1200-1400' },
    { min: 1400, max: 1600, label: '1400-1600' },
    { min: 1600, max: 1800, label: '1600-1800' },
    { min: 1800, max: 2000, label: '1800-2000' },
    { min: 2000, max: Infinity, label: '2000+' },
  ];

  return ranges.map((range) => {
    const modelsInRange = allStats.filter(
      (s) => s.elo >= range.min && s.elo < range.max
    );
    return {
      range: range.label,
      count: modelsInRange.length,
      models: modelsInRange.map((s) => s.modelName),
    };
  });
}
