import { AIResponse, GameState, PlayerColor } from '@/types/game';
import { createLudoAgent } from '../agents/ludoAgent';

const agentCache: Map<string, Map<PlayerColor, any>> = new Map();

function getOrCreateAgent(gameId: string, color: PlayerColor): any {
  if (!agentCache.has(gameId)) {
    agentCache.set(gameId, new Map());
  }
  
  const gameAgents = agentCache.get(gameId)!;
  
  if (!gameAgents.has(color)) {
    const agent = createLudoAgent(color);
    gameAgents.set(color, agent);
  }
  
  return gameAgents.get(color);
}

export class AIGateway {
  static async getMove(
    modelName: string,
    color: PlayerColor,
    gameState: GameState,
    validMoves: any[]
  ): Promise<AIResponse> {
    try {
      const agent = await getOrCreateAgent(gameState.gameId, color);
      
      const response = await agent.getMove(gameState, validMoves);
      
      return {
        pieceId: response.pieceId,
        action: response.action,
        targetPosition: response.targetPosition,
        reasoning: response.reasoning,
      };
    } catch (error) {
      console.error(`Error getting move from agent ${color}:`, error);
      // Fallback to random valid move
      const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
      return {
        pieceId: randomMove.pieceId,
        action: randomMove.action,
        targetPosition: randomMove.targetPosition,
        reasoning: 'Fallback to random move due to agent error or timeout.',
      };
    }
  }
  
  static clearCache(gameId: string): void {
    agentCache.delete(gameId);
  }
}