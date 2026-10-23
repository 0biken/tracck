import { Body, Controller, Get, HttpCode, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { KEY_SCOPES } from '@tracck/shared';
import { AuthGuard } from '../auth/auth.guard';
import { UserId } from '../auth/current-user.decorator';
import { ZodPipe } from '../common/zod.pipe';
import { ConsentService } from './consent.service';

const token = new ZodPipe(z.string().regex(/^[A-Za-z0-9_-]{20,80}$/));
const grantBody = z.strictObject({ scopes: z.array(z.enum(KEY_SCOPES)).min(1) });

/** The person's side of an access request. Reading it needs only the link; answering needs them signed in. */
@Controller('v1/consent-requests')
export class ConsentController {
  constructor(@Inject(ConsentService) private readonly consent: ConsentService) {}

  @Get(':token')
  view(@Param('token', token) value: string) {
    return this.consent.view(value);
  }

  @Post(':token/grant')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  async grant(@UserId() userId: string, @Param('token', token) value: string, @Body(new ZodPipe(grantBody)) body: z.infer<typeof grantBody>) {
    await this.consent.grant(userId, value, body.scopes);
    return { ok: true };
  }

  @Post(':token/deny')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  async deny(@UserId() userId: string, @Param('token', token) value: string) {
    await this.consent.deny(userId, value);
    return { ok: true };
  }
}
