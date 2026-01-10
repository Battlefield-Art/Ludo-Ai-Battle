import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, handleApiError } from '@/lib/api';
import { redis } from '@/lib/redis';
import { GameState } from '@/types/game';

const searchSchema = z.object({
  model: z.string().optional(),
  status: z.string().optional(),
  winner: z.string().optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { model, status, winner, limit = 50 } = searchSchema.parse(body);

    const keys = await redis.keys('history:*');
    const gameIds = keys.map((k) => k.replace('history:', ''));

    const games = await Promise.all(gameIds.map((gameId) => redis.get<GameState>(`history:${gameId}`)));

    const filtered = games.filter((g) => {
      if (!g) return false;
      if (status && g.status !== status) return false;
      if (model && !g.players.some((p) => p.model === model)) return false;
      if (winner && g.finalRanking && g.finalRanking.length > 0) {
        const winnerColor = g.finalRanking[0];
        const winnerModel = g.players.find((p) => p.color === winnerColor)?.model;
        if (winnerModel !== winner) return false;
      }
      return true;
    });

    return ok({ results: filtered.slice(0, limit), total: filtered.length });
  } catch (error) {
    return handleApiError(error);
  }
}
