import { Controller, Delete, Get, Headers, HttpCode, Inject, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { UserId } from '../auth/current-user.decorator';
import type { ApiRequest } from '../common/api-request';
import { requireIdempotencyKey } from '../common/idempotency';
import { PrivacyService } from './privacy.service';

@Controller('v1/me')
@UseGuards(AuthGuard)
export class PrivacyController {
  constructor(@Inject(PrivacyService) private readonly privacy: PrivacyService) {}

  @Post('export')
  @HttpCode(202)
  requestExport(@UserId() userId: string, @Headers('idempotency-key') key: string | undefined, @Req() request: ApiRequest) {
    return this.privacy.requestExport(userId, requireIdempotencyKey(key), request.id);
  }

  /** "No export yet" is a real answer, so it is sent as JSON null. */
  @Get('export/latest')
  async latestExport(@UserId() userId: string, @Res() response: Response) {
    response.json(await this.privacy.latestExport(userId));
  }

  @Delete()
  @HttpCode(202)
  deleteAccount(
    @UserId() userId: string,
    @Query('confirm') confirm: string | undefined,
    @Req() request: ApiRequest,
  ) {
    PrivacyService.assertConfirmed(confirm);
    // Asking twice finds the same request, so no idempotency key is needed.
    return this.privacy.requestDeletion(userId, request.id);
  }
}
