import { CanActivate, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ApiEnv } from '../config/env';
import { ENV } from '../tokens';

/** The diagnostic route does not exist unless ENABLE_DIAGNOSTIC_JOBS=true. */
@Injectable()
export class DiagnosticJobsEnabledGuard implements CanActivate {
  constructor(@Inject(ENV) private readonly env: ApiEnv) {}

  canActivate() {
    if (this.env.ENABLE_DIAGNOSTIC_JOBS !== 'true') throw new NotFoundException();
    return true;
  }
}
