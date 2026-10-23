import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard';
import { UserId } from '../auth/current-user.decorator';
import type { ApiRequest } from '../common/api-request';
import { requireIdempotencyKey } from '../common/idempotency';
import { ZodPipe } from '../common/zod.pipe';
import { CvReviewService } from './cv-review.service';
import { EvidenceService } from './evidence.service';
import { GraphService } from './graph.service';

const uuid = new ZodPipe(z.uuid());

const listQuery = z.strictObject({
  show: z.enum(['all', 'pinned', 'excluded', 'duplicates', 'edited']).default('all'),
  source: z.enum(['github', 'cv', 'linkedin', 'portfolio', 'x', 'behance', 'manual']).optional(),
  q: z.string().trim().max(120).optional(),
  cursor: z.string().max(200).optional(),
});

const createBody = z.strictObject({
  kind: z.enum(['experience', 'project', 'skill', 'education']),
  title: z.string().trim().min(2).max(160),
  body: z.string().trim().min(20, 'Describe it in at least a sentence.').max(4000),
  skills: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  from: z.iso.date().nullish(),
  to: z.iso.date().nullish(),
});

const updateBody = z
  .strictObject({
    pinned: z.boolean().optional(),
    excluded: z.boolean().optional(),
    body: z.string().trim().min(20).max(4000).optional(),
    title: z.string().trim().min(2).max(160).optional(),
    version: z.number().int().min(1),
  })
  .refine((value) => Object.keys(value).length > 1, { message: 'Nothing to change.' });

const resolveBody = z.strictObject({ action: z.enum(['merge', 'keep_both']) });

@Controller('v1')
@UseGuards(AuthGuard)
export class EvidenceController {
  constructor(
    @Inject(EvidenceService) private readonly evidence: EvidenceService,
    @Inject(GraphService) private readonly graph: GraphService,
    @Inject(CvReviewService) private readonly reviews: CvReviewService,
  ) {}

  @Get('evidence')
  list(@UserId() userId: string, @Query(new ZodPipe(listQuery)) query: z.infer<typeof listQuery>) {
    return this.evidence.list(userId, query);
  }

  @Post('evidence')
  create(@UserId() userId: string, @Body(new ZodPipe(createBody)) body: z.infer<typeof createBody>) {
    return this.evidence.create(userId, body);
  }

  @Patch('evidence/:id')
  update(@UserId() userId: string, @Param('id', uuid) id: string, @Body(new ZodPipe(updateBody)) body: z.infer<typeof updateBody>) {
    return this.evidence.update(userId, id, body);
  }

  @Post('evidence/duplicates/:id/resolve')
  @HttpCode(200)
  async resolve(@UserId() userId: string, @Param('id', uuid) id: string, @Body(new ZodPipe(resolveBody)) body: z.infer<typeof resolveBody>) {
    await this.evidence.resolveDuplicate(userId, id, body);
    return { ok: true };
  }

  @Get('graph')
  graphView(@UserId() userId: string) {
    return this.graph.view(userId);
  }

  @Get('cv-reviews/latest')
  /** "No review yet" is a real answer, so it is sent as JSON null rather than an empty body. */
  async latestReview(@UserId() userId: string, @Res() response: Response) {
    response.json(await this.reviews.latest(userId));
  }

  @Post('cv-reviews')
  @HttpCode(202)
  requestReview(@UserId() userId: string, @Headers('idempotency-key') key: string | undefined, @Req() request: ApiRequest) {
    return this.reviews.request(userId, requireIdempotencyKey(key), request.id);
  }
}
