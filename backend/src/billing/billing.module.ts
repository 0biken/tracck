import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import type { ApiEnv } from '../config/env';
import { ENV, PAYSTACK } from '../tokens';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { HttpPaystack, UnconfiguredPaystack, type PaystackClient } from './paystack';

/** Plans, Paystack checkout and webhooks. */
@Module({
  imports: [AuthModule],
  controllers: [BillingController],
  providers: [
    BillingService,
    {
      provide: PAYSTACK,
      inject: [ENV],
      useFactory: (env: ApiEnv): PaystackClient => (env.PAYSTACK_SECRET_KEY ? new HttpPaystack(env.PAYSTACK_SECRET_KEY) : new UnconfiguredPaystack()),
    },
  ],
  exports: [BillingService, PAYSTACK],
})
export class BillingModule {}
