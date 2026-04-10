import { redis } from '@/lib/redis';
import { PlayerColor } from '@/types/game';

export type MoodType = 'aggressive' | 'cautious' | 'reckless' | 'defensive' | 'neutral';

export interface AgentMemory {
  color: PlayerColor;
  gameId: string;
  mood: MoodType;
  capturesMade: number;
  capturesReceived: number;
  turnsSkipped: number;
  currentStreak: number;
  lastUpdated: number;
  recentMoves: Array<{
    pieceId: number;
    position: number;
    action: string;
  }>;
}

const MOOD_DECAY_FACTOR = 0.9;
const MOOD_CHANGE_THRESHOLD = 3;

function getMemoryKey(gameId: string, color: PlayerColor): string {
  return `agent:memory:${gameId}:${color}`;
}

export async function getAgentMemory(
  gameId: string,
  color: PlayerColor
): Promise<AgentMemory> {
  const key = getMemoryKey(gameId, color);
  const data = await redis.get(key);
  
  if (data) {
    return data as AgentMemory;
  }
  
  return createDefaultMemory(gameId, color);
}

function createDefaultMemory(gameId: string, color: PlayerColor): AgentMemory {
  return {
    color,
    gameId,
    mood: 'neutral',
    capturesMade: 0,
    capturesReceived: 0,
    turnsSkipped: 0,
    currentStreak: 0,
    lastUpdated: Date.now(),
    recentMoves: [],
  };
}

export async function updateAgentMemory(
  gameId: string,
  color: PlayerColor,
  updates: Partial<Omit<AgentMemory, 'color' | 'gameId'>>
): Promise<AgentMemory> {
  const memory = await getAgentMemory(gameId, color);
  const updated: AgentMemory = {
    ...memory,
    ...updates,
    lastUpdated: Date.now(),
  };
  
  const key = getMemoryKey(gameId, color);
  await redis.set(key, JSON.stringify(updated));
  
  return updated;
}

export async function incrementCapturesMade(
  gameId: string,
  color: PlayerColor
): Promise<void> {
  const memory = await getAgentMemory(gameId, color);
  memory.capturesMade++;
  memory.mood = determineMoodFromCaptures(memory);
  await updateAgentMemory(gameId, color, memory);
}

export async function incrementCapturesReceived(
  gameId: string,
  color: PlayerColor
): Promise<void> {
  const memory = await getAgentMemory(gameId, color);
  memory.capturesReceived++;
  memory.mood = determineMoodFromCaptures(memory);
  await updateAgentMemory(gameId, color, memory);
}

export async function incrementTurnsSkipped(
  gameId: string,
  color: PlayerColor
): Promise<void> {
  const memory = await getAgentMemory(gameId, color);
  memory.turnsSkipped++;
  await updateAgentMemory(gameId, color, { turnsSkipped: memory.turnsSkipped });
}

export async function addRecentMove(
  gameId: string,
  color: PlayerColor,
  move: { pieceId: number; position: number; action: string }
): Promise<void> {
  const memory = await getAgentMemory(gameId, color);
  memory.recentMoves.push(move);
  
  if (memory.recentMoves.length > 10) {
    memory.recentMoves = memory.recentMoves.slice(-10);
  }
  
  await updateAgentMemory(gameId, color, { recentMoves: memory.recentMoves });
}

function determineMoodFromCaptures(memory: AgentMemory): MoodType {
  if (memory.capturesMade > memory.capturesReceived + 3) {
    return 'aggressive';
  }
  if (memory.capturesReceived > memory.capturesMade + 3) {
    return 'defensive';
  }
  return 'neutral';
}

export async function applyMoodDecay(gameId: string, color: PlayerColor): Promise<void> {
  const memory = await getAgentMemory(gameId, color);
  
  memory.currentStreak = Math.max(0, memory.currentStreak * MOOD_DECAY_FACTOR);
  
  if (memory.currentStreak < MOOD_CHANGE_THRESHOLD) {
    memory.mood = 'neutral';
  }
  
  await updateAgentMemory(gameId, color, {
    currentStreak: memory.currentStreak,
    mood: memory.mood,
  });
}

export function buildContextString(memory: AgentMemory): string {
  const moodDescription = getMoodDescription(memory.mood);
  const captureStats = `Captures: ${memory.capturesMade} made, ${memory.capturesReceived} received`;
  const skipStats = `Turns skipped: ${memory.turnsSkipped}`;
  
  let context = `[STATE] ${moodDescription}. ${captureStats}. ${skipStats}.`;
  
  if (memory.recentMoves.length > 0) {
    const lastMoves = memory.recentMoves.slice(-3).map(
      m => `Piece ${m.pieceId} ${m.action} to ${m.position}`
    ).join('; ');
    context += ` Recent: ${lastMoves}.`;
  }
  
  return context;
}

function getMoodDescription(mood: MoodType): string {
  switch (mood) {
    case 'aggressive':
      return 'Feeling aggressive and dominant';
    case 'cautious':
      return 'Feeling cautious and careful';
    case 'reckless':
      return 'Feeling reckless and daring';
    case 'defensive':
      return 'Feeling defensive after recent losses';
    case 'neutral':
    default:
      return 'Playing with neutral strategy';
  }
}

export async function clearAgentMemory(
  gameId: string,
  color: PlayerColor
): Promise<void> {
  const key = getMemoryKey(gameId, color);
  await redis.del(key);
}
