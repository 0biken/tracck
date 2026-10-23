import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import {
  ApiError,
  type CreateConsentLinkResponse,
  type KeyScope,
  type OrgCreateResumeRequest,
  type OrgCreateResumeResponse,
  type OrgJobView,
  type OrgProfileView,
  type ResumeContent,
  type RoleId,
  type UsageView,
} from '@tracck/shared';
import type { ApiEnv } from '../config/env';
import { RateLimitedError } from '../common/rate-limited';
import type { Database } from '../db';
import { ResumesService } from '../resumes/resumes.service';
import { DB, ENV, JOB_STORE } from '../tokens';
import type { JobStore } from '@tracck/shared';
import { AdminService } from './admin.service';
import { ConsentService } from './consent.service';
import type { OrgContext } from './org-auth';

const rowsOf = <T>(result: unknown) => (result as { rows: T[] }).rows;
const NO_SUCH_PERSON = 'We could not find that person, or they have not given you access.';
const SANDBOX_PREFIX = 'sbx_';

const SANDBOX_PROFILE: OrgProfileView = {
  name: 'Test Student',
  headline: 'Final-year computer science student',
  location: 'Lagos, Nigeria',
  roles: ['dev'],
  skills: ['TypeScript', 'PostgreSQL', 'Docker'],
};

const SANDBOX_RESUME: ResumeContent = {
  header: { name: 'Test Student', contact: 'test@example.com · Lagos, Nigeria' },
  person: { name: 'Test Student', email: 'test@example.com', phone: null, location: 'Lagos, Nigeria', address: null, dateOfBirth: null, nationality: null },
  templateId: 'classic-red',
  layout: { templateId: 'classic-red', experienceGroupIds: ['g1'], educationGroupIds: [], skills: [], strengths: [] },
  sections: [
    {
      id: 's-experience',
      heading: 'Experience and projects',
      kind: 'groups',
      groups: [{ id: 'g1', title: 'Sample project', year: '2026', bullets: [{ id: 'b1', text: 'Built a sample service in TypeScript and PostgreSQL.', evidence: ['e1'] }] }],
    },
  ],
  evidenceRefs: { e1: { id: 'e1', source: 'GITHUB', where: 'sample', date: '2026-01-01', original: 'Built a sample service in TypeScript and PostgreSQL.' } },
};

/** What an organisation can do with a key: ask for access, read what was granted, and request resumes. */
@Injectable()
export class OrgApiService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    @Inject(JOB_STORE) private readonly store: JobStore,
    @Inject(ConsentService) private readonly consent: ConsentService,
    @Inject(ResumesService) private readonly resumes: ResumesService,
    @Inject(AdminService) private readonly admin: AdminService,
  ) {}

  async consentLink(org: OrgContext, scopes: KeyScope[], externalRef: string | undefined): Promise<CreateConsentLinkResponse> {
    // A key can only ask for what it is itself allowed to use.
    const missing = scopes.filter((scope) => !org.scopes.includes(scope));
    if (missing.length) throw new ApiError(403, 'FORBIDDEN', `This key does not have the "${missing[0]}" scope, so it cannot ask for it.`);

    if (org.mode === 'test') {
      return { url: `${this.env.APP_ORIGIN}/consent/sandbox`, expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString() };
    }
    const { token, expiresAt } = await this.consent.createRequest(org.clientId, org.keyId, scopes, externalRef ?? null);
    return { url: `${this.env.APP_ORIGIN}/consent/${token}`, expiresAt: expiresAt.toISOString() };
  }

  async profile(org: OrgContext, userId: string): Promise<OrgProfileView> {
    if (org.mode === 'test') return SANDBOX_PROFILE;
    // Someone who does not exist and someone who said no look the same from here.
    if (!(await this.consent.allows(org.clientId, userId, 'read:profile'))) throw new ApiError(404, 'NOT_FOUND', NO_SUCH_PERSON);

    const [profile] = rowsOf<{ name: string | null; headline: string | null; location: string | null; roles: string[] }>(
      await this.db.execute(sql`select display_name as name, headline, location, preferred_roles as roles from public.profiles where id = ${userId} and deleted_at is null`),
    );
    if (!profile) throw new ApiError(404, 'NOT_FOUND', NO_SUCH_PERSON);
    const skills = rowsOf<{ skill: string }>(
      await this.db.execute(sql`
        select s as skill from public.candidate_evidence e, unnest(e.skills) s
         where e.user_id = ${userId} and not e.excluded group by s order by count(*) desc, s limit 12`),
    );
    return { name: profile.name, headline: profile.headline, location: profile.location, roles: profile.roles as RoleId[], skills: skills.map((row) => row.skill) };
  }

  async createResume(
    org: OrgContext,
    userId: string,
    input: OrgCreateResumeRequest,
    idempotencyKey: string,
    correlationId: string,
  ): Promise<{ response: OrgCreateResumeResponse; created: boolean }> {
    if (org.mode === 'test') {
      const jobId = `${SANDBOX_PREFIX}${randomUUID().replaceAll('-', '')}`;
      return { response: { jobId, statusUrl: `/v1/org/jobs/${jobId}` }, created: false };
    }
    if (!(await this.consent.allows(org.clientId, userId, 'generate:resume'))) throw new ApiError(404, 'NOT_FOUND', NO_SUCH_PERSON);
    await this.assertWithinQuota(org);

    const result = await this.resumes.createForOrg(userId, { clientId: org.clientId, keyId: org.keyId }, input, idempotencyKey, correlationId);
    return { response: { jobId: result.jobId, statusUrl: `/v1/org/jobs/${result.jobId}` }, created: result.created };
  }

  /** The monthly quota is shared by the whole organisation, and each key may have a smaller one of its own. */
  private async assertWithinQuota(org: OrgContext) {
    const from = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
    const [used] = rowsOf<{ client: number; key: number }>(
      await this.db.execute(sql`
        select coalesce(sum(e.cost_units), 0)::int as client,
               coalesce(sum(e.cost_units) filter (where e.key_id = ${org.keyId}), 0)::int as key
          from public.api_usage_events e join public.api_keys k on k.id = e.key_id
         where k.client_id = ${org.clientId} and e.at >= ${from.toISOString()}`),
    );
    const exceeded = used.client >= org.clientQuota ? 'Your organisation has used its monthly quota.' : org.keyQuota !== null && used.key >= org.keyQuota ? 'This key has used its monthly quota.' : null;
    if (exceeded) {
      const reset = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
      throw new RateLimitedError(`${exceeded} It resets on ${reset.toISOString().slice(0, 10)}.`, Math.ceil((reset.getTime() - Date.now()) / 1000));
    }
  }

  async job(org: OrgContext, jobId: string): Promise<OrgJobView> {
    const now = new Date().toISOString();
    if (jobId.startsWith(SANDBOX_PREFIX)) {
      if (org.mode !== 'test') throw new ApiError(404, 'NOT_FOUND', 'We could not find that job.');
      return { id: jobId, status: 'succeeded', step: null, progressPercent: 100, error: null, createdAt: now, completedAt: now, result: { resumeId: 'sbx_resume', score: 82, content: SANDBOX_RESUME } };
    }
    if (!/^[0-9a-f-]{36}$/.test(jobId)) throw new ApiError(404, 'NOT_FOUND', 'We could not find that job.');

    const job = await this.store.get(jobId);
    // A job that belongs to someone else looks the same as one that does not exist.
    if (!job || job.inputRef.orgClientId !== org.clientId || org.mode === 'test') throw new ApiError(404, 'NOT_FOUND', 'We could not find that job.');

    let result: OrgJobView['result'] = null;
    if (job.status === 'succeeded' && typeof job.resultRef?.resumeId === 'string') {
      const resume = await this.resumes.detail(job.userId, job.resultRef.resumeId);
      if (resume.content) result = { resumeId: resume.id, score: resume.match?.score ?? null, content: resume.content };
    }
    return {
      id: job.id,
      status: job.status,
      step: job.step,
      progressPercent: job.progressPercent,
      error: job.errorCode ? { code: job.errorCode, message: job.safeErrorMessage ?? 'This job did not finish.' } : null,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      result,
    };
  }

  usage(org: OrgContext): Promise<UsageView> {
    return this.admin.usage(org.clientId);
  }
}
