import { Global, Module } from '@nestjs/common';
import { ENV } from '../tokens';
import { loadEnv } from './env';

/** Reads and checks the environment once, at start-up, and shares the result. */
@Global()
@Module({
  providers: [{ provide: ENV, useFactory: () => loadEnv() }],
  exports: [ENV],
})
export class ConfigModule {}
