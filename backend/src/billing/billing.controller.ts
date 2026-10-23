import { Body, Controller, Get, Headers, HttpCode, Inject, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard';
import { UserEmail, UserId } from '../auth/current-user.decorator';
import { ZodPipe } from '../common/zod.pipe';
import { BillingService } from './billing.service';

const checkoutBody = z.strictObject({
  plan: z.enum(['pro', 'student']),
  // Only a path on this app: never a full address, so checkout cannot send a person elsewhere.
  returnPath: z
    .string()
    .regex(/^\/(?!\/)[^\s]*$/, 'Use a path on this site.')
    .max(200)
    .default('/dashboard/settings'),
});
const verifyQuery = z.strictObject({ reference: z.string().regex(/^[A-Za-z0-9_-]{6,80}$/) });
const studentBody = z.strictObject({ email: z.email().trim().toLowerCase().max(200) });

@Controller('v1')
export class BillingController {
  constructor(@Inject(BillingService) private readonly billing: BillingService) {}

  @Get('billing')
  @UseGuards(AuthGuard)
  view(@UserId() userId: string) {
    return this.billing.view(userId);
  }

  @Post('billing/checkout')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  checkout(@UserId() userId: string, @UserEmail() email: string | null, @Body(new ZodPipe(checkoutBody)) body: z.infer<typeof checkoutBody>) {
    return this.billing.checkout(userId, email, body.plan, body.returnPath);
  }

  @Get('billing/verify')
  @UseGuards(AuthGuard)
  verify(@UserId() userId: string, @Query(new ZodPipe(verifyQuery)) query: z.infer<typeof verifyQuery>) {
    return this.billing.verify(userId, query.reference);
  }

  @Post('billing/cancel')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  cancel(@UserId() userId: string) {
    return this.billing.cancel(userId);
  }

  @Post('billing/student-verification')
  @HttpCode(202)
  @UseGuards(AuthGuard)
  async requestStudent(@UserId() userId: string, @Body(new ZodPipe(studentBody)) body: z.infer<typeof studentBody>) {
    await this.billing.requestStudentVerification(userId, body.email);
    return { ok: true };
  }

  /** Opened from the email, so it carries no sign-in; the link itself is the proof. */
  @Get('billing/student-verification/confirm')
  async confirmStudent(@Query('token') token: string | undefined, @Res() response: Response) {
    response.redirect(302, await this.billing.confirmStudent(token));
  }

  /** Paystack calls this. It is signed, not signed in, and needs the exact bytes it was sent. */
  @Post('webhooks/paystack')
  @HttpCode(200)
  async webhook(@Req() request: Request & { rawBody?: Buffer }, @Headers('x-paystack-signature') signature: string | undefined) {
    await this.billing.handleWebhook(request.rawBody, signature);
    return { ok: true };
  }
}

