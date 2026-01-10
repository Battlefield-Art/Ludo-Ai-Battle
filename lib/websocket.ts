import { WebSocket, WebSocketServer } from 'ws';
import { redis } from '@/lib/redis';
import { RealtimeMessage, RealtimeChannel, ClientMessage, ServerMessage } from '@/types/realtime';

const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const INACTIVITY_TIMEOUT = 300000; // 5 minutes

interface ExtendedWebSocket extends WebSocket {
  isAlive: boolean;
  subscriptions: Set<RealtimeChannel>;
  lastActivity: number;
}

export class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Set<ExtendedWebSocket> = new Set();
  private channelSubscribers: Map<RealtimeChannel, Set<ExtendedWebSocket>> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private redisSubscriber: any = null;

  async initialize(port: number = 3001) {
    this.wss = new WebSocketServer({ port });

    this.wss.on('connection', (ws: WebSocket) => {
      this.handleConnection(ws as ExtendedWebSocket);
    });

    // Setup heartbeat
    this.heartbeatInterval = setInterval(() => {
      this.performHeartbeat();
    }, HEARTBEAT_INTERVAL);

    // Setup Redis pub/sub listener
    await this.setupRedisPubSub();

    console.log(`WebSocket server started on port ${port}`);
  }

  private handleConnection(ws: ExtendedWebSocket) {
    ws.isAlive = true;
    ws.subscriptions = new Set();
    ws.lastActivity = Date.now();
    this.clients.add(ws);

    // Send welcome message
    const welcomeMsg: ServerMessage = {
      type: 'WELCOME',
      timestamp: new Date().toISOString(),
      data: { message: 'Connected to AI Ludo WebSocket server' },
    };
    ws.send(JSON.stringify(welcomeMsg));

    ws.on('pong', () => {
      ws.isAlive = true;
      ws.lastActivity = Date.now();
    });

    ws.on('message', (data: Buffer) => {
      try {
        const message: ClientMessage = JSON.parse(data.toString());
        this.handleClientMessage(ws, message);
      } catch (error) {
        const errorMsg: ServerMessage = {
          type: 'ERROR',
          timestamp: new Date().toISOString(),
          error: { code: 'INVALID_MESSAGE', message: 'Invalid JSON message' },
        };
        ws.send(JSON.stringify(errorMsg));
      }
    });

    ws.on('close', () => {
      this.handleDisconnection(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.handleDisconnection(ws);
    });
  }

  private handleClientMessage(ws: ExtendedWebSocket, message: ClientMessage) {
    ws.lastActivity = Date.now();

    switch (message.type) {
      case 'SUBSCRIBE':
        if (message.channels) {
          message.channels.forEach((channel) => {
            ws.subscriptions.add(channel);
            if (!this.channelSubscribers.has(channel)) {
              this.channelSubscribers.set(channel, new Set());
            }
            this.channelSubscribers.get(channel)!.add(ws);
          });
        }
        break;

      case 'UNSUBSCRIBE':
        if (message.channels) {
          message.channels.forEach((channel) => {
            ws.subscriptions.delete(channel);
            this.channelSubscribers.get(channel)?.delete(ws);
          });
        }
        break;

      case 'PING':
        const pongMsg: ServerMessage = {
          type: 'PONG',
          timestamp: new Date().toISOString(),
        };
        ws.send(JSON.stringify(pongMsg));
        break;
    }
  }

  private handleDisconnection(ws: ExtendedWebSocket) {
    // Clean up subscriptions
    ws.subscriptions.forEach((channel) => {
      this.channelSubscribers.get(channel)?.delete(ws);
    });
    this.clients.delete(ws);
  }

  private performHeartbeat() {
    const now = Date.now();
    this.clients.forEach((ws) => {
      // Check for inactivity
      if (now - ws.lastActivity > INACTIVITY_TIMEOUT) {
        ws.terminate();
        return;
      }

      // Send ping
      if (!ws.isAlive) {
        ws.terminate();
        return;
      }

      ws.isAlive = false;
      ws.ping();
    });
  }

  private async setupRedisPubSub() {
    // Note: Upstash Redis HTTP API doesn't support pub/sub directly
    // For production, you'd want to use a different Redis client for pub/sub
    // or implement polling. For now, we'll expose a method to broadcast directly.
  }

  async broadcast(channel: RealtimeChannel, message: RealtimeMessage) {
    const subscribers = this.channelSubscribers.get(channel);
    if (!subscribers) return;

    const payload = JSON.stringify(message);
    subscribers.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    });

    // Store in Redis for distributed systems
    await redis.rpush(`realtime:${channel}`, payload);
    await redis.expire(`realtime:${channel}`, 3600); // 1 hour TTL
  }

  async broadcastToGame(gameId: string, message: RealtimeMessage) {
    await this.broadcast(`game:${gameId}`, message);
  }

  async broadcastToLeaderboard(message: RealtimeMessage) {
    await this.broadcast('leaderboard', message);
  }

  async broadcastToTournament(tournamentId: string, message: RealtimeMessage) {
    await this.broadcast(`tournaments:${tournamentId}`, message);
  }

  getStats() {
    return {
      totalClients: this.clients.size,
      channels: Array.from(this.channelSubscribers.entries()).map(([channel, subs]) => ({
        channel,
        subscribers: subs.size,
      })),
    };
  }

  async shutdown() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.clients.forEach((ws) => {
      ws.close();
    });

    if (this.wss) {
      this.wss.close();
    }
  }
}

// Singleton instance
let wsManager: WebSocketManager | null = null;

export function getWebSocketManager(): WebSocketManager {
  if (!wsManager) {
    wsManager = new WebSocketManager();
  }
  return wsManager;
}

export async function initWebSocketServer() {
  const manager = getWebSocketManager();
  const port = parseInt(process.env.WS_PORT || '3001');
  await manager.initialize(port);
  return manager;
}
