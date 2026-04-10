import { z } from 'zod';
import { PlayerColor } from '@/types/game';
import { AGENT_PERSONALITIES, AgentPersonalityConfig } from './personalities';
import { 
  getAgentMemory, 
  updateAgentMemory, 
  incrementCapturesMade, 
  addRecentMove, 
  buildContextString
} from './memory';

const moveSchema = z.object({
  pieceId: z.number().min(0).max(3),
  action: z.enum(['start', 'move', 'capture']),
  targetPosition: z.number(),
  reasoning: z.string(),
});

export interface MoveResult {
  pieceId: number;
  action: 'start' | 'move' | 'capture';
  targetPosition: number;
  reasoning: string;
}

export interface LudoAgent {
  color: PlayerColor;
  name: string;
  personality: AgentPersonalityConfig;
  getMove: (
    gameState: any,
    validMoves: any[]
  ) => Promise<MoveResult>;
}

async function callOpenAI(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo',
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as any;
  return data.choices[0]?.message?.content || '';
}

export async function createLudoAgent(color: PlayerColor): Promise<LudoAgent> {
  const personality = AGENT_PERSONALITIES[color];
  
  return {
    color,
    name: personality.name,
    personality,
    
    async getMove(gameState: any, validMoves: any[]) {
      const gameId = gameState.gameId;
      
      const memory = await getAgentMemory(gameId, color);
      const contextString = buildContextString(memory);
      
      const prompt = buildPrompt(
        color,
        personality.name,
        personality.systemPrompt,
        gameState,
        validMoves,
        contextString
      );
      
      try {
        const text = await callOpenAI(prompt);

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON found in response');
        
        const parsed = moveSchema.parse(JSON.parse(jsonMatch[0])) as MoveResult;
        
        const isValid = validMoves.some(
          vm => vm.pieceId === parsed.pieceId && 
                vm.targetPosition === parsed.targetPosition
        );
        
        if (!isValid) {
          console.warn(`Agent proposed invalid move: ${JSON.stringify(parsed)}, valid moves: ${JSON.stringify(validMoves)}`);
          throw new Error('Agent proposed invalid move');
        }
        
        await addRecentMove(gameId, color, {
          pieceId: parsed.pieceId,
          position: parsed.targetPosition,
          action: parsed.action,
        });
        
        const moveResult = validMoves.find(
          vm => vm.pieceId === parsed.pieceId && vm.targetPosition === parsed.targetPosition
        );
        if (moveResult && moveResult.action === 'capture') {
          await incrementCapturesMade(gameId, color);
        }

        await updateAgentMemory(gameId, color, {
          currentStreak: memory.currentStreak + 1,
        });

        return parsed;
      } catch (error) {
        console.error(`Error getting move from agent ${color}:`, error);
        const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
        const result = {
          pieceId: randomMove.pieceId,
          action: randomMove.action,
          targetPosition: randomMove.targetPosition,
          reasoning: 'Fallback to random move due to model error or timeout.',
        };
        return result;
      }
    },
  };
}

function buildPrompt(
  color: PlayerColor,
  agentName: string,
  systemPrompt: string,
  gameState: any,
  validMoves: any[],
  context: string
): string {
  const player = gameState.players.find((p: any) => p.color === color);
  const pieces = player.piecesState;
  
  const boardState = buildCompactBoardState(gameState, color);
  
  return `
${systemPrompt}

GAME CONTEXT:
${context}

BOARD STATE:
${boardState}

YOUR PIECES:
${pieces.map((p: any, i: number) => `- Piece ${p.pieceId}: ${p.position === -1 ? 'Home' : p.position === 52 ? 'Finished' : 'Position ' + p.position}`).join('\n')}

DICE ROLL: ${gameState.diceRoll}

VALID MOVES (choose ONE):
${validMoves.map((m: any, i: number) => `${i + 1}. Piece ${m.pieceId}: ${m.action} to position ${m.targetPosition}`).join('\n')}

Respond with ONLY valid JSON:
{
  "pieceId": 0-3,
  "action": "start" | "move" | "capture",
  "targetPosition": number,
  "reasoning": "brief explanation in your personality's voice"
}
`;
}

function buildCompactBoardState(gameState: any, currentColor: PlayerColor): string {
  const lines: string[] = [];
  
  for (const player of gameState.players) {
    const status = player.piecesState
      .map((p: any) => p.position === -1 ? 'H' : p.position === 52 ? 'F' : p.position)
      .join('/');
    const prefix = player.color === currentColor ? '*' : ' ';
    lines.push(`${prefix}${player.color}: [${status}]`);
  }
  
  return lines.join('\n');
}

export function getAgentPersonality(color: PlayerColor): AgentPersonalityConfig {
  return AGENT_PERSONALITIES[color];
}