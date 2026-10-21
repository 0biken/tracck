import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import { ClientIp } from '../auth/current-user.decorator';
import { ZodPipe } from '../common/zod.pipe';
import { WaitlistService, waitlistSchema } from './waitlist.service';

/** Public: no sign-in. Rate-limited by address. */
@Controller('v1/waitlist')
export class WaitlistController {
  constructor(@Inject(WaitlistService) private readonly waitlist: WaitlistService) {}

  @Post()
  @HttpCode(200)
  async join(@Body(new ZodPipe(waitlistSchema)) body: Parameters<WaitlistService['join']>[0], @ClientIp() ip: string | null) {
    await this.waitlist.join(body, ip);
    return { ok: true };
  }
}
