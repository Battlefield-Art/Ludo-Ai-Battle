import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export function ok<T>(data: T, status: number = 200) {
  return NextResponse.json(
    {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

export function fail(
  code: string,
  message: string,
  status: number = 400,
  details?: any
) {
  return NextResponse.json(
    {
      success: false,
      error: { code, message, details },
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    return fail('INVALID_DATA', 'Invalid request data', 422, error.flatten());
  }
  if (error instanceof Error) {
    return fail('INTERNAL_ERROR', error.message, 500);
  }
  return fail('INTERNAL_ERROR', 'Unknown error', 500);
}
