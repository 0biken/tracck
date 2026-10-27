import { describe, expect, it } from 'vitest';
import type { ApiEnv } from '../config/env';
import type { Database } from '../db';
import { EntitlementsService } from './entitlements.service';

const env = (flag: 'true' | 'false') => ({ DISABLE_PAYMENT_RESTRICTIONS: flag }) as unknown as ApiEnv;

/** A free-plan database. With the gate on, no check should ever reach it. */
const freePlan = () =>
  ({ select: () => ({ from: () => ({ where: async () => [{ plan: 'free' }] }) }) }) as unknown as Database;

const unreachable = () =>
  ({
    select: () => {
      throw new Error('the database should not be read');
    },
  }) as unknown as Database;

describe('payment restriction gate', () => {
  it('lets a free plan through every check when the gate is on, without reading the plan', async () => {
    const service = new EntitlementsService(unreachable(), env('true'));
    await expect(service.assertCanAddSource('user-1')).resolves.toBeUndefined();
    await expect(service.assertCanGenerate('user-1', 'full')).resolves.toBeUndefined();
    await expect(service.assertCanExport('user-1', 'docx')).resolves.toBeUndefined();
  });

  it('still refuses a free plan for Word export and full length when the gate is off', async () => {
    const service = new EntitlementsService(freePlan(), env('false'));
    await expect(service.assertCanExport('user-1', 'docx')).rejects.toMatchObject({ code: 'PLAN_LIMIT_REACHED' });
    await expect(service.assertCanGenerate('user-1', 'full')).rejects.toMatchObject({ code: 'PLAN_LIMIT_REACHED' });
  });
});
