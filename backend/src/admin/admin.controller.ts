import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { ROLE_IDS } from '@tracck/shared';
import { AuthGuard } from '../auth/auth.guard';
import { UserId } from '../auth/current-user.decorator';
import type { ApiRequest } from '../common/api-request';
import { ZodPipe } from '../common/zod.pipe';
import { AdminService } from './admin.service';
import { StaffGuard } from './staff.guard';

const uuidParam = new ZodPipe(z.uuid());

const usersQuery = z.strictObject({
  q: z.string().trim().max(200).optional(),
  plan: z.enum(['free', 'pro']).optional(),
  status: z.enum(['active', 'suspended', 'onboarding']).optional(),
  role: z.enum(ROLE_IDS).optional(),
  cursor: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const updateUserBody = z
  .strictObject({
    plan: z.enum(['free', 'pro']).optional(),
    suspended: z.boolean().optional(),
    reason: z.string().trim().max(500).optional(),
  })
  .refine((value) => value.plan !== undefined || value.suspended !== undefined, {
    message: 'Specify at least one field to update.',
  });

const auditQuery = z.strictObject({
  userId: z.uuid().optional(),
  eventType: z.string().trim().max(120).optional(),
  cursor: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

@Controller('v1/admin')
@UseGuards(AuthGuard, StaffGuard)
export class AdminController {
  constructor(@Inject(AdminService) private readonly admin: AdminService) {}

  @Get('stats')
  stats() {
    return this.admin.stats();
  }

  @Get('users')
  users(@Query(new ZodPipe(usersQuery)) query: z.infer<typeof usersQuery>) {
    return this.admin.users(query);
  }

  @Get('users/:userId')
  userDetail(@Param('userId', uuidParam) userId: string) {
    return this.admin.userDetail(userId);
  }

  @Patch('users/:userId')
  updateUser(
    @UserId() staffId: string,
    @Param('userId', uuidParam) userId: string,
    @Body(new ZodPipe(updateUserBody)) body: z.infer<typeof updateUserBody>,
  ) {
    return this.admin.updateUser(staffId, userId, body);
  }

  @Post('users/:userId/reset-quota')
  @HttpCode(200)
  resetQuota(@UserId() staffId: string, @Param('userId', uuidParam) userId: string) {
    return this.admin.resetUserQuota(staffId, userId);
  }

  @Delete('users/:userId')
  @HttpCode(202)
  deleteUser(
    @UserId() staffId: string,
    @Param('userId', uuidParam) userId: string,
    @Req() request: ApiRequest,
  ) {
    return this.admin.deleteUser(staffId, userId, request.id);
  }

  @Get('audit')
  audit(@Query(new ZodPipe(auditQuery)) query: z.infer<typeof auditQuery>) {
    return this.admin.auditLog(query);
  }

  @Get('deletion-requests')
  deletionRequests() {
    return this.admin.deletionRequestsList();
  }

  @Get('waitlist')
  waitlist() {
    return this.admin.waitlistList();
  }
}
