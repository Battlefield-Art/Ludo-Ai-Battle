import { redis } from '@/lib/redis';
import { GameState, ModelStats } from '@/types/game';

const DEFAULT_ELO = 1200;
const K_FACTOR = 32;

export async function getModelStats(modelName: string): Promise<ModelStats> {
  const stats = await redis.get<ModelStats>(`stats:${modelName}`);
  if (stats) return stats;

  return {
    modelName,
    wins: 0,
    losses: 0,
    draws: 0,
    gamesPlayed: 0,
    winRate: 0,
    elo: DEFAULT_ELO,
    totalCaptures: 0,
    avgGameLength: 0,
  };
}

export function calculateNewElo(currentElo: number, opponentAvgElo: number, actualScore: number): number {
  const expectedScore = 1 / (1 + Math.pow(10, (opponentAvgElo - currentElo) / 400));
  return Math.round(currentElo + K_FACTOR * (actualScore - expectedScore));
}

export async function updateAllStats(state: GameState) {
  if (!state.finalRanking) return;

  const playerModels = state.players.reduce((acc, p) => {
    acc[p.color] = p.model;
    return acc;
  }, {} as Record<string, string>);

  const models = state.players.map(p => p.model);
  const currentStats = await Promise.all(models.map(m => getModelStats(m)));
  const statsMap = new Map(currentStats.map(s => [s.modelName, s]));

  // Calculate captures
  const capturesMap = new Map<string, number>();
  state.moveHistory.forEach(move => {
    if (move.action === 'capture') {
      const model = playerModels[move.playerColor];
      capturesMap.set(model, (capturesMap.get(model) || 0) + 1);
    }
  });

  // Calculate ELO changes
  // For Ludo (4 players), we can treat it as multiple 1v1 matchups
  // Winner gets 1 point, 2nd gets 0.7, 3rd gets 0.3, 4th gets 0
  const scores = [1, 0.7, 0.3, 0];
  const ranking = state.finalRanking;

  for (let i = 0; i < ranking.length; i++) {
    const color = ranking[i];
    const modelName = playerModels[color];
    const modelStats = statsMap.get(modelName)!;
    const score = scores[i];

    // Average ELO of opponents
    const otherModels = state.players.filter(p => p.color !== color).map(p => p.model);
    const avgOpponentElo = otherModels.reduce((sum, m) => sum + (statsMap.get(m)?.elo || DEFAULT_ELO), 0) / 3;

    modelStats.elo = calculateNewElo(modelStats.elo, avgOpponentElo, score);
    modelStats.gamesPlayed += 1;
    if (i === 0) modelStats.wins += 1;
    else modelStats.losses += 1;

    modelStats.totalCaptures += capturesMap.get(modelName) || 0;
    modelStats.winRate = (modelStats.wins / modelStats.gamesPlayed) * 100;
    
    // Update average game length
    const gameLength = state.moveHistory.length;
    modelStats.avgGameLength = (modelStats.avgGameLength * (modelStats.gamesPlayed - 1) + gameLength) / modelStats.gamesPlayed;

    await redis.set(`stats:${modelName}`, modelStats);
    await redis.zadd('leaderboard', { score: modelStats.elo, member: modelName });
  }
}
