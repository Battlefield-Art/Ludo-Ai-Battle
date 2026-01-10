import { NextRequest } from 'next/server';
import { ok, handleApiError } from '@/lib/api';
import { requireAdmin } from '@/lib/adminMiddleware';
import { getAuditLogs } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const offset = parseInt(searchParams.get('offset') || '0');
    const limit = parseInt(searchParams.get('limit') || '50');
    const adminId = searchParams.get('adminId') || undefined;
    const resource = searchParams.get('resource') || undefined;
    const startTime = searchParams.get('startTime') ? parseInt(searchParams.get('startTime')!) : undefined;
    const endTime = searchParams.get('endTime') ? parseInt(searchParams.get('endTime')!) : undefined;

    const result = await getAuditLogs(offset, limit, {
      adminId,
      resource,
      startTime,
      endTime,
    });

    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
