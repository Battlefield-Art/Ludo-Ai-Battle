import { redis } from '@/lib/redis';
import { GameState, ModelStats, PlayerColor } from '@/types/game';

export const DEFAULT_ELO = 1600;
export const K_FACTOR = 32;

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

function expectedScore(rating: number, opponent: number): number {
  return 1 / (1 + Math.pow(10, (opponent - rating) / 400));
}

export function calculateEloChange(rating: number, opponent: number, result: number): number {
  const expected = expectedScore(rating, opponent);
  return K_FACTOR * (result - expected);
}

export function updateEloRatings(
  players: Array<{ modelName: string; rating: number }>,
  ranking: string[],
  isDraw: boolean
): Map<string, number> {
  const n = players.length;
  const rankIndex = new Map(ranking.map((m, i) => [m, i]));
  const perOpponentK = K_FACTOR / Math.max(1, n - 1);

  const newRatings = new Map<string, number>();

  for (const player of players) {
    let delta = 0;
    for (const opponent of players) {
      if (opponent.modelName === player.modelName) continue;

      let result = 0.5;
      if (!isDraw) {
        const a = rankIndex.get(player.modelName);
        const b = rankIndex.get(opponent.modelName);
        if (a === undefined || b === undefined) {
          result = 0.5;
        } else if (a < b) {
          result = 1;
        } else if (a > b) {
          result = 0;
        } else {
          result = 0.5;
        }
      }

      const expected = expectedScore(player.rating, opponent.rating);
      delta += perOpponentK * (result - expected);
    }

    newRatings.set(player.modelName, Math.round(player.rating + delta));
  }

  return newRatings;
}

export async function updateAllStats(state: GameState) {
  if (!state.finalRanking || state.finalRanking.length === 0) return;

  const playerModels = state.players.reduce((acc, p) => {
    acc[p.color] = p.model;
    return acc;
  }, {} as Record<PlayerColor, string>);

  const models = state.players.map((p) => p.model);
  const currentStats = await Promise.all(models.map((m) => getModelStats(m)));
  const statsMap = new Map(currentStats.map((s) => [s.modelName, s]));

  const capturesMap = new Map<string, number>();
  state.moveHistory.forEach((move) => {
    if (move.action === 'capture') {
      const model = playerModels[move.playerColor];
      capturesMap.set(model, (capturesMap.get(model) || 0) + 1);
    }
  });

  const rankingModels = state.finalRanking.map((color) => playerModels[color]);
  const playersForElo = currentStats.map((s) => ({ modelName: s.modelName, rating: s.elo }));
  const newRatings = updateEloRatings(playersForElo, rankingModels, false);

  for (const modelName of models) {
    const modelStats = statsMap.get(modelName)!;

    modelStats.elo = newRatings.get(modelName) ?? modelStats.elo;
    modelStats.gamesPlayed += 1;

    const place = rankingModels.indexOf(modelName);
    if (place === 0) modelStats.wins += 1;
    else if (place === -1) modelStats.draws += 1;
    else modelStats.losses += 1;

    modelStats.totalCaptures += capturesMap.get(modelName) || 0;
    modelStats.winRate = modelStats.gamesPlayed > 0 ? (modelStats.wins / modelStats.gamesPlayed) * 100 : 0;

    const gameLength = state.moveHistory.length;
    modelStats.avgGameLength =
      (modelStats.avgGameLength * (modelStats.gamesPlayed - 1) + gameLength) / modelStats.gamesPlayed;

    await redis.set(`stats:${modelName}`, modelStats);
    await redis.zadd('leaderboard', { score: modelStats.elo, member: modelName });
  }
}
