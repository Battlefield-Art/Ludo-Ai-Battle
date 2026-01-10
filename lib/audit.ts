import { redis } from '@/lib/redis';
import { AuditLog } from '@/types/admin';
import { v4 as uuidv4 } from 'uuid';

export async function logAdminAction(
  adminId: string,
  adminUsername: string,
  action: string,
  resource: string,
  resourceId?: string,
  details?: Record<string, any>,
  ip?: string
): Promise<void> {
  const log: AuditLog = {
    id: uuidv4(),
    adminId,
    adminUsername,
    action,
    resource,
    resourceId,
    details,
    timestamp: Date.now(),
    ip,
  };

  // Store in Redis list (newest first)
  await redis.lpush('audit:logs', JSON.stringify(log));
  
  // Keep only last 10000 logs
  await redis.ltrim('audit:logs', 0, 9999);
  
  // Also store in a sorted set by timestamp for querying
  await redis.zadd('audit:logs:sorted', { score: log.timestamp, member: log.id });
  await redis.set(`audit:log:${log.id}`, log, { ex: 31536000 }); // 1 year TTL
}

export async function getAuditLogs(
  offset: number = 0,
  limit: number = 50,
  filters?: {
    adminId?: string;
    resource?: string;
    startTime?: number;
    endTime?: number;
  }
): Promise<{ logs: AuditLog[]; total: number }> {
  let logs: AuditLog[] = [];

  if (filters) {
    // Use sorted set for time-based queries
    const startScore = filters.startTime || 0;
    const endScore = filters.endTime || Date.now();
    
    const logIds = await redis.zrangebyscore('audit:logs:sorted', startScore, endScore);
    
    // Fetch log details
    const logPromises = logIds.map((id) => redis.get<AuditLog>(`audit:log:${id}`));
    const allLogs = (await Promise.all(logPromises)).filter((log): log is AuditLog => log !== null);
    
    // Apply additional filters
    logs = allLogs.filter((log) => {
      if (filters.adminId && log.adminId !== filters.adminId) return false;
      if (filters.resource && log.resource !== filters.resource) return false;
      return true;
    });
  } else {
    // Get from list
    const logStrings = await redis.lrange('audit:logs', offset, offset + limit - 1);
    logs = logStrings.map((str) => JSON.parse(str as string));
  }

  return {
    logs: logs.slice(offset, offset + limit),
    total: logs.length,
  };
}
