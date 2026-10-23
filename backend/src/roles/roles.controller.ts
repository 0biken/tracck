import { Controller, Get } from '@nestjs/common';
import { ROLES, type RoleProfile } from '@tracck/shared';

/** The roles Tracck writes for. Public, and the same list the onboarding screens use. */
@Controller('v1/roles')
export class RolesController {
  @Get()
  list(): { roles: RoleProfile[] } {
    return { roles: ROLES };
  }
}
