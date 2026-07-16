/**
 * Tracck — API route authentication helper.
 *
 * Validates the Supabase JWT from the Authorization header and returns
 * the authenticated user_id. Throws ApiError(401) on failure.
 *
 * Usage in a route handler:
 *   const { user_id } = await requireAuth(request);
 */

import { createServerClient } from '@supabase/ssr';
import { ApiError } from './errors';

interface AuthResult {
  user_id: string;
  email?: string;
}

export async function requireAuth(request: Request): Promise<AuthResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // ── Dev bypass: when Supabase is not configured, return a mock user ────────
  // This preserves the existing dev-without-Supabase workflow already
  // established by the mock clients in src/utils/supabase/client.ts.
  if (!url || !serviceKey) {
    return { user_id: 'mock-user-id', email: 'developer@tracck.io' };
  }

  // ── Extract bearer token ───────────────────────────────────────────────────
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '');

  if (!token) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Missing or malformed Authorization header');
  }

  // ── Verify via Supabase ────────────────────────────────────────────────────
  const supabase = createServerClient(url, serviceKey, {
    cookies: {
      getAll: () => [],
      setAll: () => {},
    },
  });

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    throw new ApiError(401, 'INVALID_TOKEN', 'Token is invalid or expired');
  }

  return {
    user_id: data.user.id,
    email: data.user.email ?? undefined,
  };
}
