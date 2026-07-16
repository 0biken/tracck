/**
 * Tracck — Structured API error handling.
 *
 * Standard error class and response serializer used across all API routes.
 * Matches the envelope shape defined in api-design.md §2–3.
 */

import { NextResponse } from 'next/server';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Serialize an error into the standard API response envelope.
 *
 * ```json
 * { "success": false, "error": { "code": "...", "message": "...", "details": {} } }
 * ```
 */
export function errorResponse(err: ApiError | Error): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: err.code,
          message: err.message,
          ...(err.details ? { details: err.details } : {}),
        },
      },
      { status: err.status }
    );
  }

  // Unknown / unexpected errors — never leak stack traces
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong',
      },
    },
    { status: 500 }
  );
}

/**
 * Wrap a successful payload in the standard envelope.
 *
 * ```json
 * { "success": true, "data": { ... } }
 * ```
 */
export function successResponse<T extends Record<string, unknown>>(
  data: T,
  status = 200
): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}
