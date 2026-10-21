import { z } from 'zod';
import { ROLE_IDS } from '@tracck/shared';

const roles = z.array(z.enum(ROLE_IDS)).min(1).max(ROLE_IDS.length);

export const updateMeSchema = z.strictObject({
  name: z.string().trim().min(1).max(120).optional(),
  headline: z.string().trim().max(200).nullable().optional(),
  location: z.string().trim().max(120).nullable().optional(),
  roles: roles.optional(),
});

export const setRolesSchema = z.strictObject({ roles });

export const preferencesSchema = z.strictObject({
  notifications: z.strictObject({ done: z.boolean(), weekly: z.boolean(), attention: z.boolean() }),
  cvRetention: z.enum(['6_months', '12_months', 'until_deleted']),
});

export const uuidParam = z.uuid();
