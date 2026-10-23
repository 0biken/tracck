import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { KEY_SCOPES } from '@tracck/shared';
import { AuthGuard } from '../auth/auth.guard';
import { UserId } from '../auth/current-user.decorator';
import { ZodPipe } from '../common/zod.pipe';
import { AdminService } from './admin.service';
import { StaffGuard } from './staff.guard';

const uuid = new ZodPipe(z.uuid());

const clientBody = z.strictObject({
  name: z.string().trim().min(2).max(120),
  contactEmail: z.email().max(200).optional(),
  monthlyQuota: z.number().int().min(1).max(10_000_000).optional(),
});
const clientPatch = z
  .strictObject({ status: z.enum(['active', 'suspended']).optional(), monthlyQuota: z.number().int().min(1).max(10_000_000).optional() })
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to change.' });
const webhookBody = z.strictObject({
  // Addresses an organisation gives us are called from our servers, so only https is accepted.
  url: z.url({ protocol: /^https$/ }).max(500),
});
const keyBody = z.strictObject({
  label: z.string().trim().min(1).max(80),
  mode: z.enum(['live', 'test']),
  scopes: z.array(z.enum(KEY_SCOPES)).min(1).max(KEY_SCOPES.length),
  rateLimitPerMin: z.number().int().min(1).max(10_000).optional(),
  monthlyQuota: z.number().int().min(1).max(10_000_000).nullish(),
  expiresInDays: z.number().int().min(1).max(730).nullish(),
});
const auditQuery = z.strictObject({ key: z.uuid().optional(), format: z.enum(['json', 'csv']).default('json') });

/** The Tracck team's console: organisations, their keys, how they use the API, and the record of what happened. */
@Controller('v1/admin')
@UseGuards(AuthGuard, StaffGuard)
export class AdminController {
  constructor(@Inject(AdminService) private readonly admin: AdminService) {}

  @Get('clients')
  clients() {
    return this.admin.clients();
  }

  @Post('clients')
  createClient(@UserId() staffId: string, @Body(new ZodPipe(clientBody)) body: z.infer<typeof clientBody>) {
    return this.admin.createClient(staffId, body);
  }

  @Patch('clients/:clientId')
  updateClient(@UserId() staffId: string, @Param('clientId', uuid) clientId: string, @Body(new ZodPipe(clientPatch)) body: z.infer<typeof clientPatch>) {
    return this.admin.updateClient(staffId, clientId, body);
  }

  @Post('clients/:clientId/webhook')
  @HttpCode(200)
  setWebhook(@UserId() staffId: string, @Param('clientId', uuid) clientId: string, @Body(new ZodPipe(webhookBody)) body: z.infer<typeof webhookBody>) {
    return this.admin.setWebhook(staffId, clientId, body.url);
  }

  @Get('clients/:clientId/keys')
  keys(@Param('clientId', uuid) clientId: string) {
    return this.admin.keys(clientId);
  }

  @Post('clients/:clientId/keys')
  createKey(@UserId() staffId: string, @Param('clientId', uuid) clientId: string, @Body(new ZodPipe(keyBody)) body: z.infer<typeof keyBody>) {
    return this.admin.createKey(staffId, clientId, { ...body, scopes: [...new Set(body.scopes)] });
  }

  @Post('clients/:clientId/keys/:keyId/rotate')
  @HttpCode(200)
  rotateKey(@UserId() staffId: string, @Param('clientId', uuid) clientId: string, @Param('keyId', uuid) keyId: string) {
    return this.admin.rotateKey(staffId, clientId, keyId);
  }

  @Delete('clients/:clientId/keys/:keyId')
  @HttpCode(204)
  async revokeKey(@UserId() staffId: string, @Param('clientId', uuid) clientId: string, @Param('keyId', uuid) keyId: string) {
    await this.admin.revokeKey(staffId, clientId, keyId);
  }

  @Get('clients/:clientId/usage')
  usage(@Param('clientId', uuid) clientId: string) {
    return this.admin.usage(clientId);
  }

  @Get('clients/:clientId/audit')
  async audit(@Param('clientId', uuid) clientId: string, @Query(new ZodPipe(auditQuery)) query: z.infer<typeof auditQuery>, @Res() response: Response) {
    if (query.format === 'csv') {
      response.type('text/csv').set('Content-Disposition', 'attachment; filename="tracck-audit.csv"').send(await this.admin.auditCsv(clientId, query.key));
      return;
    }
    response.json(await this.admin.auditLog(clientId, query.key));
  }
}
