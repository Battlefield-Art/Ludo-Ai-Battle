/**
 * BullMQ Worker for AI Ludo Game Moves
 *
 * This worker processes game moves from the queue.
 * It runs as a separate long-lived process.
 *
 * Usage:
 *   npx tsx worker.ts
 */

import { createGameWorker } from '@/lib/queue';
import { getIORedisClient } from '@/lib/redis';

async function startWorker() {
  console.log('🚀 Starting AI Ludo Game Worker...');

  try {
    // Test Redis connection
    const redis = getIORedisClient();
    await redis.ping();
    console.log('✅ Connected to Redis');

    // Create and start the worker
    const worker = createGameWorker();
    console.log('✅ Worker is ready to process game moves');
    console.log('Press Ctrl+C to stop the worker');

    // Graceful shutdown
    const shutdown = async () => {
      console.log('\n🛑 Shutting down worker...');
      await worker.close();
      await redis.quit();
      console.log('✅ Worker shutdown complete');
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (error: any) {
    console.error('❌ Failed to start worker:', error);
    process.exit(1);
  }
}

startWorker();
