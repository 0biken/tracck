import { Module } from '@nestjs/common';
import type { ApiEnv } from '../config/env';
import { ENV, VERIFY_TOKEN } from '../tokens';
import { AuthGuard } from './auth.guard';
import { createTokenVerifier } from './token-verifier';

@Module({
  providers: [
    {
      provide: VERIFY_TOKEN,
      inject: [ENV],
      useFactory: (env: ApiEnv) =>
        createTokenVerifier({ supabaseUrl: env.SUPABASE_URL, jwtSecret: env.SUPABASE_JWT_SECRET }),
    },
    AuthGuard,
  ],
  exports: [VERIFY_TOKEN, AuthGuard],
})
export class AuthModule {}
