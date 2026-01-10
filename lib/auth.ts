import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { redis } from '@/lib/redis';
import { Admin, AdminSession } from '@/types/admin';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';
const JWT_EXPIRES_IN = '24h';

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export function generateToken(admin: Admin): string {
  const payload: Omit<AdminSession, 'iat' | 'exp'> = {
    adminId: admin.id,
    username: admin.username,
    role: admin.role,
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): AdminSession | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AdminSession;
    return decoded;
  } catch (error) {
    return null;
  }
}

export async function getAdmin(username: string): Promise<Admin | null> {
  const admin = await redis.get<Admin>(`admin:${username}`);
  return admin;
}

export async function createAdmin(
  username: string,
  password: string,
  role: 'superadmin' | 'moderator'
): Promise<Admin> {
  const passwordHash = await hashPassword(password);
  const admin: Admin = {
    id: `admin-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    username,
    passwordHash,
    role,
    createdAt: Date.now(),
  };

  await redis.set(`admin:${username}`, admin);
  await redis.sadd('admins:list', username);

  return admin;
}

export async function updateAdminLastLogin(username: string): Promise<void> {
  const admin = await getAdmin(username);
  if (admin) {
    admin.lastLoginAt = Date.now();
    await redis.set(`admin:${username}`, admin);
  }
}

// Initialize default admin if none exists
export async function ensureDefaultAdmin() {
  const admins = await redis.smembers('admins:list');
  if (!admins || admins.length === 0) {
    // Create default admin: username=admin, password=admin123
    await createAdmin('admin', 'admin123', 'superadmin');
    console.log('Default admin created: username=admin, password=admin123');
  }
}
