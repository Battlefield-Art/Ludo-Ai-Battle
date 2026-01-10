import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, fail, handleApiError } from '@/lib/api';
import { getAdmin, verifyPassword, generateToken, updateAdminLastLogin, ensureDefaultAdmin } from '@/lib/auth';

const loginSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
});

export async function POST(req: NextRequest) {
  try {
    // Ensure default admin exists
    await ensureDefaultAdmin();

    const body = await req.json();
    const { username, password } = loginSchema.parse(body);

    const admin = await getAdmin(username);
    if (!admin) {
      return fail('UNAUTHORIZED', 'Invalid credentials', 401);
    }

    const isValid = await verifyPassword(password, admin.passwordHash);
    if (!isValid) {
      return fail('UNAUTHORIZED', 'Invalid credentials', 401);
    }

    const token = generateToken(admin);
    await updateAdminLastLogin(username);

    return ok({
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        role: admin.role,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
