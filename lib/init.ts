import { initWebSocketServer } from '@/lib/websocket';
import { ensureDefaultAdmin } from '@/lib/auth';

let initialized = false;

export async function initialize() {
  if (initialized) return;
  initialized = true;

  try {
    // Initialize WebSocket server
    console.log('Initializing WebSocket server...');
    await initWebSocketServer();
    console.log('WebSocket server initialized successfully');
  } catch (error) {
    console.warn('WebSocket server failed to initialize:', error);
    // Continue without WebSocket - it's optional
  }

  try {
    // Ensure default admin exists
    await ensureDefaultAdmin();
  } catch (error) {
    console.warn('Failed to ensure default admin:', error);
  }
}
