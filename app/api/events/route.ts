import { NextRequest } from 'next/server';
import { getSSEManager } from '@/lib/sse';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const channels = searchParams.getAll('channel');
  const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const sseManager = getSSEManager();
  await sseManager.initialize();

  const stream = new ReadableStream({
    start(controller) {
      // Add client with subscriptions
      sseManager.addClient(clientId, controller, channels);

      // Send initial keepalive
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(`: keepalive\n\n`);
        } catch {
          clearInterval(keepalive);
        }
      }, 15000);

      // Clean up on disconnect
      req.signal.addEventListener('abort', () => {
        clearInterval(keepalive);
        sseManager.removeClient(clientId);
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
