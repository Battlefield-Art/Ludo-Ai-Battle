import { NextRequest } from 'next/server';
import { ok, fail, handleApiError } from '@/lib/api';
import { getReplay, createReplayEngine } from '@/lib/replay';

export async function GET(req: NextRequest, { params }: { params: { gameId: string; moveNumber: string } }) {
  try {
    const replay = await getReplay(params.gameId);
    if (!replay) return fail('NOT_FOUND', 'Replay not found', 404);

    const engine = createReplayEngine(replay);
    const moveNumber = parseInt(params.moveNumber);
    const move = engine.getMove(moveNumber);
    const boardState = engine.getCurrentBoardState(moveNumber);

    if (!move) return fail('NOT_FOUND', 'Move not found', 404);

    return ok({ move, boardState });
  } catch (error) {
    return handleApiError(error);
  }
}
