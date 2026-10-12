// Verifies Supabase access tokens (§10.1). Supabase Auth stays the identity
// issuer; this service checks the token itself and never trusts a user ID from
// the request body.

import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { ApiError } from '@tracck/core';

export type VerifyToken = (token: string) => Promise<{ userId: string }>;

export function createTokenVerifier(options: { supabaseUrl: string; jwtSecret?: string }): VerifyToken {
  const issuer = `${options.supabaseUrl.replace(/\/$/, '')}/auth/v1`;
  const key: JWTVerifyGetKey | Uint8Array = options.jwtSecret
    ? new TextEncoder().encode(options.jwtSecret)
    : createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));

  return async (token) => {
    try {
      const { payload } = await (typeof key === 'function'
        ? jwtVerify(token, key, { issuer, audience: 'authenticated' })
        : jwtVerify(token, key, { issuer, audience: 'authenticated', algorithms: ['HS256'] }));
      if (!payload.sub) throw new Error('Token has no subject');
      return { userId: payload.sub };
    } catch {
      throw new ApiError(401, 'UNAUTHORIZED', 'Sign in to continue.');
    }
  };
}

export function bearerToken(header: string | undefined): string {
  const match = header?.match(/^Bearer (.+)$/);
  if (!match) throw new ApiError(401, 'UNAUTHORIZED', 'Sign in to continue.');
  return match[1];
}
