import { Global, Module } from '@nestjs/common';
import type { ApiEnv } from '../config/env';
import { EMAIL, ENV } from '../tokens';
import { EmailSendHandler } from './email.handler';
import { ResendEmail, UnconfiguredEmail, type EmailSender } from './email';

/** Email through Resend when RESEND_API_KEY and EMAIL_FROM are set; otherwise sending is skipped, never faked. */
@Global()
@Module({
  providers: [
    EmailSendHandler,
    {
      provide: EMAIL,
      inject: [ENV],
      useFactory: (env: ApiEnv): EmailSender =>
        env.RESEND_API_KEY && env.EMAIL_FROM ? new ResendEmail(env.RESEND_API_KEY, env.EMAIL_FROM) : new UnconfiguredEmail(),
    },
  ],
  exports: [EMAIL, EmailSendHandler],
})
export class EmailModule {}
