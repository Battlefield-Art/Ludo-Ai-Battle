import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { AIResponse, GameState, PlayerColor } from '@/types/game';
import { z } from 'zod';

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const deepseek = createOpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com/v1',
});

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_AI_API_KEY,
});

const xai = createOpenAI({
  apiKey: process.env.GROK_API_KEY,
  baseURL: 'https://api.x.ai/v1',
});

export const aiResponseSchema = z.object({
  pieceId: z.number().min(0).max(3),
  action: z.enum(['start', 'move', 'capture']),
  targetPosition: z.number(),
  reasoning: z.string(),
});

export class AIGateway {
  private static async retry<T>(
    fn: () => Promise<T>,
    retries = 3,
    delay = 1000
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (retries === 0) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.retry(fn, retries - 1, delay * 2);
    }
  }

  static async getMove(
    modelName: string,
    color: PlayerColor,
    gameState: GameState,
    validMoves: any[]
  ): Promise<AIResponse> {
    const prompt = this.constructPrompt(modelName, color, gameState, validMoves);
    
    const getModel = (name: string) => {
      switch (name.toLowerCase()) {
        case 'openai':
        case 'gpt-4':
          return openai('gpt-4-turbo');
        case 'deepseek':
          return deepseek('deepseek-chat');
        case 'google':
        case 'gemini':
          return google('gemini-1.5-pro');
        case 'xai':
        case 'grok':
          return xai('grok-beta');
        default:
          return openai('gpt-4-turbo');
      }
    };

    try {
      const response = await this.retry(async () => {
        const promise = generateText({
          model: getModel(modelName),
          prompt: prompt,
          temperature: 0.7,
          maxTokens: 500,
        });

        // 30s timeout
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('AI Model Timeout')), 30000)
        );

        const { text } = await (Promise.race([promise, timeoutPromise]) as Promise<{ text: string }>);

        // Extract JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON found in response');
        
        const parsed = JSON.parse(jsonMatch[0]);
        return aiResponseSchema.parse(parsed);
      });

      return response;
    } catch (error) {
      console.error(`Error getting move from ${modelName}:`, error);
      // Fallback to random valid move
      const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
      return {
        pieceId: randomMove.pieceId,
        action: randomMove.action,
        targetPosition: randomMove.targetPosition,
        reasoning: 'Fallback to random move due to model error or timeout.',
      };
    }
  }

  private static constructPrompt(
    modelName: string,
    color: PlayerColor,
    gameState: GameState,
    validMoves: any[]
  ): string {
    const player = gameState.players.find((p) => p.color === color)!;
    const pieces = player.piecesState;
    
    return `
You are ${modelName} playing Ludo as the ${color} player.

CURRENT BOARD STATE:
${JSON.stringify(gameState, null, 2)}

YOUR PIECES:
${pieces.map((p, i) => `- Piece ${p.pieceId}: ${p.position === -1 ? 'Home' : p.position === 52 ? 'Finished' : 'Position ' + p.position}`).join('\n')}

DICE ROLL: ${gameState.diceRoll}

VALID MOVES (choose one):
${validMoves.map((m, i) => `${i + 1}. Piece ${m.pieceId}: ${m.action} to ${m.targetPosition}`).join('\n')}

STRATEGIC GUIDELINES:
- Prioritize getting pieces out of home
- Capture opponent pieces when possible
- Protect your finished pieces
- Balance offense and defense
- Consider blocking opponent's paths

Respond with ONLY valid JSON:
{
  "pieceId": 0-3,
  "action": "start" | "move" | "capture",
  "targetPosition": number,
  "reasoning": "brief strategy explanation"
}
`;
  }
}
