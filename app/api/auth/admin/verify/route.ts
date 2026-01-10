import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api';
import { verifyToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return fail('UNAUTHORIZED', 'Missing token', 401);
  }

  const token = authHeader.slice(7);
  const session = verifyToken(token);

  if (!session) {
    return fail('UNAUTHORIZED', 'Invalid token', 401);
  }

  return ok({
    valid: true,
    session: {
      adminId: session.adminId,
      username: session.username,
      role: session.role,
      exp: session.exp,
    },
  });
}
