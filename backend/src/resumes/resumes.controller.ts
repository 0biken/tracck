import { Body, Controller, Delete, Get, Headers, HttpCode, Inject, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { ROLE_IDS } from '@tracck/shared';
import { AuthGuard } from '../auth/auth.guard';
import { UserEmail, UserId } from '../auth/current-user.decorator';
import type { ApiRequest } from '../common/api-request';
import { requireIdempotencyKey } from '../common/idempotency';
import { ZodPipe } from '../common/zod.pipe';
import { ResumesService } from './resumes.service';

const uuid = new ZodPipe(z.uuid());

const parseBody = z.strictObject({ description: z.string().trim().min(40, 'Paste the whole job description.').max(30_000) });

const createBody = z.strictObject({
  jobDescription: z.string().trim().min(40, 'Paste the whole job description.').max(30_000),
  title: z.string().trim().min(1).max(120).optional(),
  company: z.string().trim().min(1).max(120).optional(),
  focus: z.string().trim().min(1).max(600).optional(),
  length: z.enum(['one_page', 'full']),
  roleId: z.enum(ROLE_IDS).optional(),
  sources: z.array(z.enum(['github', 'cv', 'linkedin', 'portfolio', 'x', 'behance', 'manual'])).max(7).optional(),
});

const listQuery = z.strictObject({
  q: z.string().trim().max(120).optional(),
  status: z.enum(['generating', 'draft', 'exported', 'failed']).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const editBody = z
  .strictObject({
    text: z.string().trim().min(5).max(600).optional(),
    figure: z.string().trim().min(1).max(120).optional(),
    keepWithoutFigure: z.boolean().optional(),
    version: z.number().int().min(1),
  })
  .refine((value) => value.text !== undefined || value.figure !== undefined || value.keepWithoutFigure, { message: 'Nothing to change.' });

const versionBody = z.strictObject({ direction: z.literal('up').optional(), version: z.number().int().min(1) });
const versionQuery = z.strictObject({ version: z.coerce.number().int().min(1) });
const restoreBody = z.strictObject({ version: z.number().int().min(1) });
const exportBody = z.strictObject({ format: z.enum(['pdf', 'docx']) });
const formatParam = new ZodPipe(z.enum(['pdf', 'docx']));

@Controller('v1')
@UseGuards(AuthGuard)
export class ResumesController {
  constructor(@Inject(ResumesService) private readonly resumes: ResumesService) {}

  @Post('job-descriptions/parse')
  @HttpCode(200)
  parse(@Body(new ZodPipe(parseBody)) body: z.infer<typeof parseBody>) {
    return this.resumes.parseJob(body.description);
  }

  @Post('resumes')
  @HttpCode(202)
  create(
    @UserId() userId: string,
    @UserEmail() email: string | null,
    @Body(new ZodPipe(createBody)) body: z.infer<typeof createBody>,
    @Headers('idempotency-key') key: string | undefined,
    @Req() request: ApiRequest,
  ) {
    return this.resumes.create(userId, email, body, requireIdempotencyKey(key), request.id);
  }

  @Get('resumes')
  list(@UserId() userId: string, @Query(new ZodPipe(listQuery)) query: z.infer<typeof listQuery>) {
    return this.resumes.list(userId, query);
  }

  @Delete('resumes')
  @HttpCode(204)
  async removeAll(@UserId() userId: string, @Req() request: ApiRequest) {
    await this.resumes.removeAll(userId, request.id);
  }

  @Get('resumes/:id')
  detail(@UserId() userId: string, @Param('id', uuid) id: string) {
    return this.resumes.detail(userId, id);
  }

  @Delete('resumes/:id')
  @HttpCode(204)
  async remove(@UserId() userId: string, @Param('id', uuid) id: string, @Req() request: ApiRequest) {
    await this.resumes.remove(userId, id, request.id);
  }

  @Get('resumes/:id/versions')
  versions(@UserId() userId: string, @Param('id', uuid) id: string) {
    return this.resumes.versions(userId, id);
  }

  @Patch('resumes/:id/bullets/:bulletId')
  edit(
    @UserId() userId: string,
    @Param('id', uuid) id: string,
    @Param('bulletId') bulletId: string,
    @Body(new ZodPipe(editBody)) body: z.infer<typeof editBody>,
  ) {
    return this.resumes.editBullet(userId, id, bulletId, body);
  }

  @Post('resumes/:id/bullets/:bulletId/move')
  @HttpCode(200)
  move(
    @UserId() userId: string,
    @Param('id', uuid) id: string,
    @Param('bulletId') bulletId: string,
    @Body(new ZodPipe(versionBody)) body: z.infer<typeof versionBody>,
  ) {
    return this.resumes.moveBullet(userId, id, bulletId, body.version);
  }

  @Delete('resumes/:id/bullets/:bulletId')
  removeBullet(
    @UserId() userId: string,
    @Param('id', uuid) id: string,
    @Param('bulletId') bulletId: string,
    @Query(new ZodPipe(versionQuery)) query: z.infer<typeof versionQuery>,
  ) {
    return this.resumes.removeBullet(userId, id, bulletId, query.version);
  }

  @Post('resumes/:id/restore')
  @HttpCode(200)
  restore(@UserId() userId: string, @Param('id', uuid) id: string, @Body(new ZodPipe(restoreBody)) body: z.infer<typeof restoreBody>) {
    return this.resumes.restore(userId, id, body.version);
  }

  @Post('resumes/:id/regenerate')
  @HttpCode(202)
  regenerate(@UserId() userId: string, @Param('id', uuid) id: string, @Headers('idempotency-key') key: string | undefined, @Req() request: ApiRequest) {
    return this.resumes.regenerate(userId, id, requireIdempotencyKey(key), request.id);
  }

  @Post('resumes/:id/export')
  @HttpCode(202)
  requestExport(
    @UserId() userId: string,
    @Param('id', uuid) id: string,
    @Body(new ZodPipe(exportBody)) body: z.infer<typeof exportBody>,
    @Headers('idempotency-key') key: string | undefined,
    @Req() request: ApiRequest,
  ) {
    return this.resumes.requestExport(userId, id, body.format, requireIdempotencyKey(key), request.id);
  }

  @Get('resumes/:id/export/:format')
  exportLink(@UserId() userId: string, @Param('id', uuid) id: string, @Param('format', formatParam) format: 'pdf' | 'docx') {
    return this.resumes.exportLink(userId, id, format);
  }
}
