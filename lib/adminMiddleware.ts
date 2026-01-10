import { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { AdminSession } from '@/types/admin';
import { fail } from '@/lib/api';

export interface AuthenticatedRequest extends NextRequest {
  admin?: AdminSession;
}

export function requireAdmin(req: NextRequest): { admin: AdminSession; error: null } | { admin: null; error: Response } {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { admin: null, error: fail('UNAUTHORIZED', 'Missing token', 401) };
  }

  const token = authHeader.slice(7);
  const session = verifyToken(token);

  if (!session) {
    return { admin: null, error: fail('UNAUTHORIZED', 'Invalid or expired token', 401) };
  }

  return { admin: session, error: null };
}

export function requireSuperAdmin(req: NextRequest): { admin: AdminSession; error: null } | { admin: null; error: Response } {
  const { admin, error } = requireAdmin(req);
  if (error) return { admin: null, error };

  if (admin!.role !== 'superadmin') {
    return { admin: null, error: fail('FORBIDDEN', 'Superadmin access required', 403) };
  }

  return { admin, error: null };
}
