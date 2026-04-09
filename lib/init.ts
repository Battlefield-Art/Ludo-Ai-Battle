import { ensureDefaultAdmin } from '@/lib/auth';
import { getSSEManager } from '@/lib/sse';

let initialized = false;

export async function initialize() {
  if (initialized) return;
  initialized = true;

  try {
    // Initialize SSE manager
    console.log('Initializing SSE manager...');
    await getSSEManager().initialize();
    console.log('SSE manager initialized successfully');
  } catch (error) {
    console.warn('SSE manager failed to initialize:', error);
    // Continue without SSE - it's optional
  }

  try {
    // Ensure default admin exists
    await ensureDefaultAdmin();
  } catch (error) {
    console.warn('Failed to ensure default admin:', error);
  }
}
