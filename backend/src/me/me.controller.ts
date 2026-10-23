import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Put, Patch, UseGuards } from '@nestjs/common';
import { ROLES, type Preferences, type RoleId, type UpdateMeRequest } from '@tracck/shared';
import { AuthGuard } from '../auth/auth.guard';
import { UserEmail, UserId } from '../auth/current-user.decorator';
import { ZodPipe } from '../common/zod.pipe';
import { MeService } from './me.service';
import { preferencesSchema, setRolesSchema, updateMeSchema, uuidParam } from './me.schemas';

@Controller('v1')
@UseGuards(AuthGuard)
export class MeController {
  constructor(@Inject(MeService) private readonly me: MeService) {}

  @Get('me')
  get(@UserId() userId: string, @UserEmail() email: string | null) {
    return this.me.view(userId, email);
  }

  @Patch('me')
  update(
    @UserId() userId: string,
    @UserEmail() email: string | null,
    @Body(new ZodPipe(updateMeSchema)) body: UpdateMeRequest,
  ) {
    return this.me.update(userId, email, body);
  }

  @Get('me/summary')
  summary(@UserId() userId: string) {
    return this.me.summary(userId);
  }

  @Put('me/preferences')
  setPreferences(@UserId() userId: string, @Body(new ZodPipe(preferencesSchema)) body: Preferences) {
    return this.me.setPreferences(userId, body);
  }

  @Put('me/roles')
  setRoles(
    @UserId() userId: string,
    @UserEmail() email: string | null,
    @Body(new ZodPipe(setRolesSchema)) body: { roles: RoleId[] },
  ) {
    return this.me.update(userId, email, { roles: body.roles });
  }

  @Post('me/consents/policy')
  @HttpCode(200)
  async acceptPolicy(@UserId() userId: string) {
    await this.me.acceptPolicy(userId);
    return { ok: true };
  }

  @Get('me/consents')
  consents(@UserId() userId: string) {
    return this.me.consents(userId);
  }

  @Delete('me/consents/:id')
  @HttpCode(204)
  async revokeConsent(@UserId() userId: string, @Param('id', new ZodPipe(uuidParam)) id: string) {
    await this.me.revokeConsent(userId, id);
  }

  @Get('roles')
  roles() {
    return ROLES;
  }

  @Get('notifications')
  notifications(@UserId() userId: string) {
    return this.me.notifications(userId);
  }

  @Post('notifications/:id/read')
  @HttpCode(204)
  async markRead(@UserId() userId: string, @Param('id', new ZodPipe(uuidParam)) id: string) {
    await this.me.markRead(userId, id);
  }
}
