import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { UserId } from '../auth/current-user.decorator';
import type { ApiRequest } from '../common/api-request';
import { DiagnosticJobsEnabledGuard } from './diagnostic-jobs-enabled.guard';
import { JobStreamService } from './job-stream.service';
import { JobsService } from './jobs.service';

@Controller('v1')
export class JobsController {
  constructor(
    @Inject(JobsService) private readonly jobs: JobsService,
    @Inject(JobStreamService) private readonly streams: JobStreamService,
  ) {}

  @Post('diagnostic-jobs')
  @HttpCode(202)
  @UseGuards(DiagnosticJobsEnabledGuard, AuthGuard)
  createDiagnosticJob(
    @UserId() userId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: unknown,
    @Req() request: ApiRequest,
  ) {
    return this.jobs.createDiagnostic(userId, idempotencyKey, body, request.id);
  }

  @Get('jobs/:jobId')
  @UseGuards(AuthGuard)
  getJob(@UserId() userId: string, @Param('jobId') jobId: string) {
    return this.jobs.view(userId, jobId);
  }

  @Post('jobs/:jobId/cancel')
  @HttpCode(202)
  @UseGuards(AuthGuard)
  cancelJob(@UserId() userId: string, @Param('jobId') jobId: string) {
    return this.jobs.cancel(userId, jobId);
  }

  @Post('jobs/:jobId/retry')
  @HttpCode(202)
  @UseGuards(AuthGuard)
  retryJob(@UserId() userId: string, @Param('jobId') jobId: string) {
    return this.jobs.retry(userId, jobId);
  }

  @Get('jobs/:jobId/events')
  @UseGuards(AuthGuard)
  async streamJob(
    @UserId() userId: string,
    @Param('jobId') jobId: string,
    @Req() request: ApiRequest,
    @Res() response: Response,
  ) {
    const job = await this.jobs.load(userId, jobId);
    this.streams.open(request, response, job, userId);
  }
}
