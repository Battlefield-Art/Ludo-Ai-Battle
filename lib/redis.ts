import { Redis } from '@upstash/redis';
import RedisClient from 'ioredis';

if (!process.env.UPSTASH_REDIS_URL || !process.env.UPSTASH_REDIS_TOKEN) {
  throw new Error('UPSTASH_REDIS_URL and UPSTASH_REDIS_TOKEN must be defined');
}

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL,
  token: process.env.UPSTASH_REDIS_TOKEN,
});

// ioredis instance for BullMQ and pub/sub (requires Redis protocol support)
let ioredisClient: RedisClient | null = null;

export function getIORedisClient(): RedisClient {
  if (!ioredisClient) {
    const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;
    if (!redisUrl) {
      throw new Error('REDIS_URL or UPSTASH_REDIS_URL must be defined for ioredis');
    }
    ioredisClient = new RedisClient(redisUrl);
  }
  return ioredisClient;
}
