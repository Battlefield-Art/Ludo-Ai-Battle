import { Queue, Worker, Job } from 'bullmq';
import { getIORedisClient } from '@/lib/redis';
import { performGameMove } from '@/lib/gameRunner';

const QUEUE_NAME = 'game-moves';

// Create the game moves queue
export function getGameQueue(): Queue {
  const redis = getIORedisClient();
  return new Queue(QUEUE_NAME, {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: {
        count: 100,
        age: 3600, // 1 hour
      },
      removeOnFail: {
        count: 500,
        age: 24 * 3600, // 24 hours
      },
    },
  });
}

// Process a single game move
async function processMove(job: Job) {
  const { gameId } = job.data as { gameId: string };
  return await performGameMove(gameId);
}

// Create and start the worker
export function createGameWorker(): Worker {
  const redis = getIORedisClient();

  const worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      try {
        const result = await processMove(job);
        return result;
      } catch (error: any) {
        console.error(`Error processing move for game ${job.data.gameId}:`, error);
        throw error;
      }
    },
    {
      connection: redis,
      concurrency: 5, // Process up to 5 games concurrently
    }
  );

  worker.on('completed', (job: Job, result: any) => {
    console.log(`Job ${job.id} completed for game ${result?.gameId || 'unknown'}`);
  });

  worker.on('failed', (job: Job | undefined, error: Error) => {
    console.error(`Job ${job?.id} failed:`, error.message);
  });

  return worker;
}

// Queue a game move
export async function queueGameMove(gameId: string, delay: number = 0) {
  const queue = getGameQueue();
  await queue.add(
    'process-move',
    { gameId },
    {
      delay,
      jobId: `move-${gameId}-${Date.now()}`,
    }
  );
}
