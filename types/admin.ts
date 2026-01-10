export type AdminRole = 'superadmin' | 'moderator';

export interface Admin {
  id: string;
  username: string;
  passwordHash: string;
  role: AdminRole;
  createdAt: number;
  lastLoginAt?: number;
}

export interface AdminSession {
  adminId: string;
  username: string;
  role: AdminRole;
  iat: number;
  exp: number;
}

export interface AuditLog {
  id: string;
  adminId: string;
  adminUsername: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, any>;
  timestamp: number;
  ip?: string;
}

export interface SystemConfig {
  heartbeatInterval: number;
  inactivityTimeout: number;
  maxGamesPerTournament: number;
  defaultEloRating: number;
  kFactor: number;
  enableAutoArchive: boolean;
  archiveCutoffDays: number;
}
