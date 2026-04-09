import { getIORedisClient } from '@/lib/redis';
import { RealtimeMessage } from '@/types/realtime';

interface SSEClient {
  id: string;
  controller: ReadableStreamDefaultController;
  subscriptions: Set<string>;
}

class SSEManager {
  private clients: Map<string, SSEClient> = new Map();
  private redisSubscriber: any = null;
  private initialized = false;

  async initialize() {
    if (this.initialized) return;

    const redis = getIORedisClient();
    this.redisSubscriber = redis.duplicate();

    // Subscribe to all game and tournament channels
    await this.redisSubscriber.subscribe('game:*', 'tournaments:*', 'leaderboard', (err: any) => {
      if (err) {
        console.error('Failed to subscribe to Redis channels:', err);
      }
    });

    // Listen for messages
    this.redisSubscriber.on('message', (channel: string, message: string) => {
      const realtimeMsg: RealtimeMessage = JSON.parse(message);
      this.broadcastToClients(channel, realtimeMsg);
    });

    this.initialized = true;
  }

  addClient(
    clientId: string,
    controller: ReadableStreamDefaultController,
    subscriptions: string[] = []
  ) {
    const client: SSEClient = {
      id: clientId,
      controller,
      subscriptions: new Set(subscriptions),
    };
    this.clients.set(clientId, client);

    // Send initial message
    controller.enqueue(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: new Date().toISOString() })}\n\n`);
  }

  removeClient(clientId: string) {
    const client = this.clients.get(clientId);
    if (client) {
      client.controller.close();
      this.clients.delete(clientId);
    }
  }

  subscribeToChannel(clientId: string, channel: string) {
    const client = this.clients.get(clientId);
    if (client) {
      client.subscriptions.add(channel);
    }
  }

  unsubscribeFromChannel(clientId: string, channel: string) {
    const client = this.clients.get(clientId);
    if (client) {
      client.subscriptions.delete(channel);
    }
  }

  async broadcast(channel: string, message: RealtimeMessage) {
    // Send to Redis pub/sub for distributed systems
    const redis = getIORedisClient();
    await redis.publish(channel, JSON.stringify(message));

    // Send directly to connected clients
    this.broadcastToClients(channel, message);
  }

  private broadcastToClients(channel: string, message: RealtimeMessage) {
    const payload = `data: ${JSON.stringify(message)}\n\n`;

    this.clients.forEach((client) => {
      if (client.subscriptions.has(channel) && client.controller.desiredSize !== null) {
        try {
          client.controller.enqueue(payload);
        } catch (error) {
          // Client disconnected
          this.clients.delete(client.id);
        }
      }
    });
  }

  async broadcastToGame(gameId: string, message: RealtimeMessage) {
    await this.broadcast(`game:${gameId}`, message);
  }

  async broadcastToTournament(tournamentId: string, message: RealtimeMessage) {
    await this.broadcast(`tournaments:${tournamentId}`, message);
  }

  async broadcastToLeaderboard(message: RealtimeMessage) {
    await this.broadcast('leaderboard', message);
  }

  getStats() {
    return {
      totalClients: this.clients.size,
      channels: Array.from(this.clients.values()).flatMap(c => Array.from(c.subscriptions)),
    };
  }

  async shutdown() {
    this.clients.forEach((client) => {
      client.controller.close();
    });
    this.clients.clear();

    if (this.redisSubscriber) {
      await this.redisSubscriber.quit();
    }
    this.initialized = false;
  }
}

// Singleton instance
let sseManager: SSEManager | null = null;

export function getSSEManager(): SSEManager {
  if (!sseManager) {
    sseManager = new SSEManager();
  }
  return sseManager;
}
