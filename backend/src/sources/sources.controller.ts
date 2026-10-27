import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { z } from 'zod';
import { ApiError } from '@tracck/shared';
import { AuthGuard } from '../auth/auth.guard';
import { UserId } from '../auth/current-user.decorator';
import type { ApiRequest } from '../common/api-request';
import { requireIdempotencyKey } from '../common/idempotency';
import { ZodPipe } from '../common/zod.pipe';
import { SourcesService, type UploadProvider } from './sources.service';
import { detectFileKind } from './parsers';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const uuid = new ZodPipe(z.uuid());
const connectBody = z.strictObject({ from: z.enum(['onboarding', 'sources']).default('sources') });
const linkedinText = z.strictObject({ text: z.string().trim().min(20).max(90_000) });
const portfolioBody = z.strictObject({ url: z.url({ protocol: /^https?$/ }).max(2000) });
const pasteBody = z.strictObject({
  provider: z.enum(['behance', 'portfolio', 'linkedin']),
  text: z.string().trim().min(20).max(90_000),
});
const removeQuery = z.strictObject({ entries: z.enum(['keep', 'delete']).default('keep') });

type UploadedFileLike = { originalname: string; buffer: Buffer; mimetype: string } | undefined;

/**
 * A file is what its first bytes say it is. The name and the type the browser
 * declared are never trusted, and an empty or oversized file never gets stored.
 */
function checkFile(file: UploadedFileLike, accepts: ('pdf' | 'docx' | 'zip')[]) {
  if (!file || file.buffer.length === 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Choose a file to upload.');
  }
  const kind = detectFileKind(file.buffer);
  const isDocx = kind === 'zip' && /\.docx$/i.test(file.originalname);
  const ok = (kind === 'pdf' && accepts.includes('pdf')) || (isDocx && accepts.includes('docx')) || (kind === 'zip' && !isDocx && accepts.includes('zip'));
  if (!ok) {
    throw new ApiError(415, 'UNSUPPORTED_FILE_TYPE', `That file type is not supported. Upload ${accepts.map((a) => a.toUpperCase()).join(' or ')}.`);
  }
  return { name: file.originalname, buffer: file.buffer, contentType: file.mimetype };
}

@Controller('v1/sources')
export class SourcesController {
  constructor(@Inject(SourcesService) private readonly sources: SourcesService) {}

  @Get()
  @UseGuards(AuthGuard)
  list(@UserId() userId: string) {
    return this.sources.list(userId);
  }

  @Post('github/connect')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  githubConnect(@UserId() userId: string, @Body(new ZodPipe(connectBody)) body: z.infer<typeof connectBody>) {
    return this.sources.githubConnect(userId, body.from);
  }

  /** GitHub sends the browser here, so it carries no token: the signed `state` says who it is. */
  @Get('github/callback')
  async githubCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Req() request: ApiRequest,
    @Res() response: Response,
  ) {
    response.redirect(302, await this.sources.githubCallback(code, state, request.id));
  }

  @Post('cv')
  @HttpCode(202)
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  uploadCv(
    @UserId() userId: string,
    @UploadedFile() file: UploadedFileLike,
    @Headers('idempotency-key') key: string | undefined,
    @Req() request: ApiRequest,
  ) {
    const checked = checkFile(file, ['pdf', 'docx']);
    return this.sources.create(userId, { provider: 'cv', file: checked }, requireIdempotencyKey(key), request.id);
  }

  /** A LinkedIn export (ZIP), a profile PDF, or pasted profile text. */
  @Post('linkedin')
  @HttpCode(202)
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  uploadLinkedin(
    @UserId() userId: string,
    @UploadedFile() file: UploadedFileLike,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string | undefined,
    @Req() request: ApiRequest,
  ) {
    const idempotencyKey = requireIdempotencyKey(key);
    if (file) {
      return this.sources.create(userId, { provider: 'linkedin', file: checkFile(file, ['pdf', 'zip']) }, idempotencyKey, request.id);
    }
    const { text } = linkedinText.parse(body);
    return this.sources.create(userId, { provider: 'linkedin', text }, idempotencyKey, request.id);
  }

  /** X's data archive (ZIP). Only the posts are read; the rest of the archive is discarded. */
  @Post('x')
  @HttpCode(202)
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  uploadX(
    @UserId() userId: string,
    @UploadedFile() file: UploadedFileLike,
    @Headers('idempotency-key') key: string | undefined,
    @Req() request: ApiRequest,
  ) {
    return this.sources.create(userId, { provider: 'x', file: checkFile(file, ['zip']) }, requireIdempotencyKey(key), request.id);
  }

  @Post('portfolio')
  @HttpCode(202)
  @UseGuards(AuthGuard)
  addPortfolio(
    @UserId() userId: string,
    @Body(new ZodPipe(portfolioBody)) body: z.infer<typeof portfolioBody>,
    @Headers('idempotency-key') key: string | undefined,
    @Req() request: ApiRequest,
  ) {
    return this.sources.create(userId, { provider: 'portfolio', url: body.url }, requireIdempotencyKey(key), request.id);
  }

  @Post('paste')
  @HttpCode(202)
  @UseGuards(AuthGuard)
  paste(
    @UserId() userId: string,
    @Body(new ZodPipe(pasteBody)) body: z.infer<typeof pasteBody>,
    @Headers('idempotency-key') key: string | undefined,
    @Req() request: ApiRequest,
  ) {
    return this.sources.create(
      userId,
      { provider: body.provider as UploadProvider, text: body.text },
      requireIdempotencyKey(key),
      request.id,
    );
  }

  @Post(':id/refresh')
  @HttpCode(202)
  @UseGuards(AuthGuard)
  refresh(
    @UserId() userId: string,
    @Param('id', uuid) id: string,
    @Headers('idempotency-key') key: string | undefined,
    @Req() request: ApiRequest,
  ) {
    return this.sources.restart(userId, id, requireIdempotencyKey(key), request.id);
  }

  @Post(':id/retry')
  @HttpCode(202)
  @UseGuards(AuthGuard)
  retry(
    @UserId() userId: string,
    @Param('id', uuid) id: string,
    @Headers('idempotency-key') key: string | undefined,
    @Req() request: ApiRequest,
  ) {
    return this.sources.restart(userId, id, requireIdempotencyKey(key), request.id);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  async remove(
    @UserId() userId: string,
    @Param('id', uuid) id: string,
    @Query(new ZodPipe(removeQuery)) query: z.infer<typeof removeQuery>,
    @Req() request: ApiRequest,
  ) {
    await this.sources.remove(userId, id, query.entries, request.id);
  }
}
