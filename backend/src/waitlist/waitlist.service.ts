import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { ApiError, ORG_TYPES } from '@tracck/shared';
import type { RateLimiter } from '../connections/rate-limiter';
import type { Database } from '../db';
import { orgWaitlist } from '../db/schema';
import { DB, RATE_LIMITER } from '../tokens';

export const waitlistSchema = z.strictObject({
  orgName: z.string().trim().min(1).max(200),
  contactName: z.string().trim().min(1).max(200),
  email: z.string().trim().max(320).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  orgType: z.enum(['university', 'bootcamp', 'job_platform', 'other'] satisfies (typeof ORG_TYPES)[number]['value'][]),
  volume: z.string().trim().max(100).optional(),
  message: z.string().trim().max(2000).optional(),
});

const PER_ADDRESS = 5;
const WINDOW_SECONDS = 3600;

@Injectable()
export class WaitlistService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(RATE_LIMITER) private readonly limiter: RateLimiter,
  ) {}

  async join(input: z.infer<typeof waitlistSchema>, ip: string | null): Promise<void> {
    const limit = await this.limiter.hit(`waitlist:${ip ?? 'unknown'}`, PER_ADDRESS, WINDOW_SECONDS);
    if (!limit.allowed) {
      throw new ApiError(429, 'RATE_LIMITED', `Too many requests. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.`);
    }

    // An address already on the list is not an error: the person gets what they wanted.
    await this.db
      .insert(orgWaitlist)
      .values({
        orgName: input.orgName,
        contactName: input.contactName,
        email: input.email,
        orgType: input.orgType,
        volume: input.volume || null,
        message: input.message || null,
      })
      .onConflictDoNothing();
  }
}
