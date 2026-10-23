import { Global, Module } from '@nestjs/common';
import { createSafeFetch } from '../common/safe-fetch';
import { SecretBox } from '../common/secret-box';
import type { ApiEnv } from '../config/env';
import { ENV, SAFE_FETCH, SECRET_BOX, STORAGE } from '../tokens';
import { SupabaseStorage, UnconfiguredStorage } from './storage';

/** File storage, the key that encrypts stored secrets, and the fetcher that refuses private addresses. */
@Global()
@Module({
  providers: [
    {
      provide: STORAGE,
      inject: [ENV],
      useFactory: (env: ApiEnv) =>
        env.SUPABASE_SERVICE_ROLE_KEY
          ? new SupabaseStorage(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, env.STORAGE_BUCKET)
          : new UnconfiguredStorage(),
    },
    { provide: SECRET_BOX, inject: [ENV], useFactory: (env: ApiEnv) => new SecretBox(env.TOKEN_ENCRYPTION_KEY) },
    { provide: SAFE_FETCH, useFactory: () => createSafeFetch() },
  ],
  exports: [STORAGE, SECRET_BOX, SAFE_FETCH],
})
export class StorageModule {}
