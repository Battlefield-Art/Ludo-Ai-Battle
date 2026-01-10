import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export async function middleware(req: NextRequest) {
  const ip = req.ip || '127.0.0.1';
  const limit = 100;
  const window = 60; // 60 seconds
  const key = `rate_limit:${ip}`;

  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, window);
  }

  if (current > limit) {
    return NextResponse.json({
      success: false,
      error: { code: 'TOO_MANY_REQUESTS', message: 'Rate limit exceeded' },
      timestamp: new Date().toISOString(),
    }, { status: 429 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
