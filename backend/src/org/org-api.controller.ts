import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { z } from 'zod';
import { KEY_SCOPES, ROLE_IDS } from '@tracck/shared';
import { requireIdempotencyKey } from '../common/idempotency';
import { ZodPipe } from '../common/zod.pipe';
import { ApiKeyGuard, OrgUsageInterceptor, RequireScope, type OrgRequest } from './org-auth';
import { OrgApiService } from './org-api.service';

const uuid = new ZodPipe(z.uuid());
const linkBody = z.strictObject({
  scopes: z.array(z.enum(KEY_SCOPES)).min(1),
  externalRef: z.string().trim().min(1).max(120).optional(),
});
const resumeBody = z.strictObject({
  jobDescription: z.string().trim().min(40).max(30_000),
  length: z.enum(['one_page', 'full']),
  roleId: z.enum(ROLE_IDS).optional(),
});

/** The API an organisation's server calls, with a key instead of a sign-in. */
@Controller('v1/org')
@UseGuards(ApiKeyGuard)
@UseInterceptors(OrgUsageInterceptor)
export class OrgApiController {
  constructor(@Inject(OrgApiService) private readonly org: OrgApiService) {}

  @Post('consent-links')
  @HttpCode(201)
  consentLink(@Req() request: OrgRequest, @Body(new ZodPipe(linkBody)) body: z.infer<typeof linkBody>) {
    return this.org.consentLink(request.org!, [...new Set(body.scopes)], body.externalRef);
  }

  @Get('users/:id/profile')
  @RequireScope('read:profile')
  profile(@Req() request: OrgRequest, @Param('id', uuid) id: string) {
    return this.org.profile(request.org!, id);
  }

  @Post('users/:id/resumes')
  @HttpCode(202)
  @RequireScope('generate:resume')
  async createResume(
    @Req() request: OrgRequest,
    @Param('id', uuid) id: string,
    @Body(new ZodPipe(resumeBody)) body: z.infer<typeof resumeBody>,
    @Headers('idempotency-key') key: string | undefined,
  ) {
    const { response, created } = await this.org.createResume(request.org!, id, body, requireIdempotencyKey(key), request.id);
    // Only a resume that was really started counts against the quota; a repeat of the same request does not.
    if (created) request.orgCost = 1;
    return response;
  }

  @Get('jobs/:id')
  @RequireScope('read:resume')
  job(@Req() request: OrgRequest, @Param('id') id: string) {
    return this.org.job(request.org!, id);
  }

  @Get('usage')
  usage(@Req() request: OrgRequest) {
    return this.org.usage(request.org!);
  }
}
