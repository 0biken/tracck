import Link from 'next/link'
import type { ReactNode } from 'react'
import { KEY_SCOPES, SCOPE_LABELS } from '@tracck/shared'
import { PageHeader } from '@/components/page-header'
import { Tag } from '@/components/ui/badge'
import { ScrollTable, tdClass, thClass } from '@/components/ui/table'

export const metadata = { title: 'API reference' }

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.tracck.app'

function Code({ children, label }: { children: string; label: string }) {
  return (
    <pre
      aria-label={label}
      tabIndex={0}
      className="m-0 overflow-x-auto border border-line-strong bg-sunken p-4 font-mono text-[13px] leading-5 text-ink"
    >
      {children}
    </pre>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="flex scroll-mt-6 flex-col gap-4 border-t-2 border-ink py-8">
      <h2 id={`${id}-h`} className="t-claim m-0">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Table({ caption, head, rows, minWidth = 520 }: { caption: string; head: string[]; rows: ReactNode[][]; minWidth?: number }) {
  return (
    <ScrollTable caption={caption} minWidth={minWidth}>
      <thead>
        <tr>
          {head.map((heading) => (
            <th key={heading} className={thClass}>
              {heading}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((cells, index) => (
          <tr key={index}>
            {cells.map((cell, cellIndex) => (
              <td key={cellIndex} className={`${tdClass} align-top ${cellIndex === 0 ? 'font-mono text-[13px]' : 'text-[14px] leading-5 text-ink-muted'}`}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </ScrollTable>
  )
}

const p = 'm-0 text-[15px] leading-[23px] text-ink-muted'
const code = (text: string) => <span className="font-mono text-ink">{text}</span>

export default function ApiReferencePage() {
  return (
    <>
      <PageHeader eyebrow="Organisation API · version 1" title="API reference">
        Ask people for access, read what they allow, and have verified resumes written for them. Everything an integration needs, on
        one page.
      </PageHeader>

      <div className="grid items-start gap-10 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-14">
        <nav aria-label="On this page" className="flex flex-col lg:sticky lg:top-6">
          <div className="t-eyebrow pb-2 text-ink-muted">On this page</div>
          {[
            ['auth', 'Authentication'],
            ['scopes', 'Scopes'],
            ['consent', 'Consent'],
            ['profile', 'Read a profile'],
            ['create', 'Create a resume'],
            ['webhooks', 'Webhooks'],
            ['sandbox', 'Sandbox keys'],
            ['limits', 'Limits and errors'],
            ['audit', 'Audit events'],
          ].map(([id, label]) => (
            <a key={id} href={`#${id}`} className="inline-flex min-h-9 items-center border-b border-line text-sm no-underline hover:text-signal">
              {label}
            </a>
          ))}
        </nav>

        <div className="flex min-w-0 flex-col">
          <Section id="auth" title="Authentication">
            <p className={p}>
              Send your key as a bearer token on every request to {code(`${BASE}/v1/org`)}. Keys belong to one organisation and can reach
              only its data. Tracck stores a hash and the prefix, so a lost key cannot be recovered; create a new one. Bodies are JSON.
            </p>
            <Code label="Authorization header">{'Authorization: Bearer trk_live_8f2a91c4_••••••••••••••••••••••••••••••••••••••••••'}</Code>
            <ul className="m-0 flex list-disc flex-col gap-2 pl-5 text-[15px] leading-[23px] text-ink-muted">
              <li>
                {code('trk_live_')} keys act on real people&apos;s records. {code('trk_test_')} keys work on synthetic data only.
              </li>
              <li>A key is shown once, when it is created. The page shows only its prefix afterwards.</li>
              <li>
                Rotating a key issues a new one with the same settings. The old key keeps working for 24 hours, so you can switch over
                without downtime.
              </li>
              <li>Revoking a key takes effect on its very next request.</li>
              <li>A wrong, malformed, revoked or expired key all answer 401. The reply does not say which.</li>
            </ul>
          </Section>

          <Section id="scopes" title="Scopes">
            <p className={p}>Grant only what an integration needs. A request outside its key&apos;s scopes is refused with a 403 that names the scope.</p>
            <Table
              caption="Scopes"
              head={['Scope', 'Allows']}
              rows={KEY_SCOPES.map((scope) => [<Tag key={scope} tone="ink">{scope}</Tag>, SCOPE_LABELS[scope]])}
              minWidth={480}
            />
          </Section>

          <Section id="consent" title="Consent">
            <p className={p}>
              A valid key alone grants nothing. A person must allow your organisation first, choosing which scopes to give. Create a link
              and send it to them; they sign in to Tracck and see exactly what you ask for and what you will not be able to do. They can
              take access back at any time, and your next request is refused.
            </p>
            <Code label="Create a consent link">
              {`POST /v1/org/consent-links\n\n{ "scopes": ["read:profile", "generate:resume"],\n  "externalRef": "matric-2024-001" }\n\n→ 201 { "url": "https://tracck.app/consent/…", "expiresAt": "2026-10-28T09:00:00Z" }`}
            </Code>
            <ul className="m-0 flex list-disc flex-col gap-2 pl-5 text-[15px] leading-[23px] text-ink-muted">
              <li>A key can only ask for scopes it has itself.</li>
              <li>Links work for 7 days and can be answered once. {code('externalRef')} is your own reference; it comes back in webhooks.</li>
              <li>
                A person who has not agreed, has revoked, or does not exist all answer 404 with the same message, so the API cannot be
                used to find out who has an account.
              </li>
            </ul>
          </Section>

          <Section id="profile" title="Read a profile">
            <p className={p}>
              Needs the {code('read:profile')} scope and the person&apos;s consent. Returns a summary only: never their CV, sources or
              account details.
            </p>
            <Code label="Example request and response">
              {`GET /v1/org/users/{userId}/profile\n\n→ 200 { "name": "Ada Okafor", "headline": "Final-year computer science student",\n          "location": "Lagos, Nigeria", "roles": ["dev"],\n          "skills": ["TypeScript", "PostgreSQL", "Docker"] }`}
            </Code>
          </Section>

          <Section id="create" title="Create a resume">
            <p className={p}>
              Sends one job description for one person. Needs the {code('generate:resume')} scope and the person&apos;s consent. The
              resume is written from that person&apos;s own record, and every claim in it is checked against it. Writing takes a short
              while, so the call answers 202 straight away with a job to follow.
            </p>
            <Code label="Example request">
              {`POST /v1/org/users/{userId}/resumes\nIdempotency-Key: 6f1c0d9e-…   (required: a repeat of the same key returns the same job)\n\n{ "jobDescription": "Backend Engineer at …", "length": "one_page", "roleId": "dev" }\n\n→ 202 { "jobId": "…", "statusUrl": "/v1/org/jobs/…" }`}
            </Code>
            <Table
              caption="Request fields"
              head={['Field', 'Type', 'Meaning']}
              rows={[
                ['jobDescription', '"string" · 40 to 30,000 characters', 'The job text to tailor to, as plain text.'],
                ['length', '"one_page" | "full"', 'Length of the resume.'],
                ['roleId', '"dev" | "devrel" | "smm" | "va" | "ux" | "da" (optional)', 'The role profile to write for. Detected from the job when left out.'],
              ]}
            />
            <p className={p}>
              Follow the job with {code('GET /v1/org/jobs/{jobId}')} (needs {code('read:resume')}), or wait for the webhook. Once{' '}
              {code('status')} is {code('"succeeded"')} the resume is in {code('result')}.
            </p>
            <Code label="Example job">
              {`GET /v1/org/jobs/{jobId}\n\n→ 200 { "id": "…", "status": "succeeded", "progressPercent": 100, "error": null,\n          "result": { "resumeId": "…", "score": 84,\n                      "content": { "header": { "name": "…", "contact": "…" },\n                                   "sections": [ … ], "evidenceRefs": { … } } } }`}
            </Code>
            <p className={p}>
              Statuses: {code('queued')}, {code('running')}, {code('retry_wait')}, {code('needs_user_action')}, {code('succeeded')},{' '}
              {code('failed')}, {code('cancelled')}. The resume also appears in the person&apos;s own Tracck account. It counts against
              your monthly quota, not their plan.
            </p>
          </Section>

          <Section id="webhooks" title="Webhooks">
            <p className={p}>
              When a resume you asked for is written, or could not be, Tracck posts to your webhook address (https only; set by the
              Tracck team). The result stays available by polling if your server is down. Deliveries are retried with backoff when your
              server answers 5xx, 408 or 429, and are not retried on other errors.
            </p>
            <Code label="Example delivery">
              {`POST https://example.edu.ng/hooks/tracck\nTracck-Event: resume.completed\nTracck-Signature: t=1760000000,v1=5257a869…\n\n{ "id": "evt_…", "type": "resume.completed", "createdAt": "2026-10-21T09:00:00Z",\n  "data": { "jobId": "…", "resumeId": "…", "status": "succeeded", "externalRef": "matric-2024-001" } }`}
            </Code>
            <p className={p}>
              Events: {code('resume.completed')} and {code('resume.failed')}. To check a delivery, compute an HMAC-SHA256 of{' '}
              {code('"{t}.{raw body}"')} with your webhook secret and compare it with {code('v1')} in constant time. Reject deliveries
              whose {code('t')} is more than five minutes old, so a captured one cannot be replayed.
            </p>
            <Code label="Verifying a delivery (Node.js)">
              {`import { createHmac, timingSafeEqual } from 'node:crypto'\n\nfunction valid(header, rawBody, secret) {\n  const [, t, v1] = header.match(/^t=(\\d+),v1=([0-9a-f]+)$/) ?? []\n  if (!t || Math.abs(Date.now() / 1000 - Number(t)) > 300) return false\n  const expected = createHmac('sha256', secret).update(\`\${t}.\${rawBody}\`).digest()\n  const given = Buffer.from(v1, 'hex')\n  return given.length === expected.length && timingSafeEqual(given, expected)\n}`}
            </Code>
          </Section>

          <Section id="sandbox" title="Sandbox keys">
            <p className={p}>
              A {code('trk_test_')} key answers every endpoint with made-up data and never touches a real person, a quota or a
              billing record. Use it to build and test your integration. Resume jobs return an id that starts with {code('sbx_')} and
              finish at once. A live key cannot read a sandbox job, or the other way round.
            </p>
          </Section>

          <Section id="limits" title="Limits and errors">
            <p className={p}>
              Each key has a rate limit per minute, shown in {code('X-RateLimit-Limit')} and {code('X-RateLimit-Remaining')} on every
              response. Resumes also draw on a monthly quota for your organisation, and a key may have a smaller one of its own. See both
              on <Link href="/org/keys">API keys</Link>, and use against them on <Link href="/org/usage">Usage and audit</Link>. Errors
              are JSON: {code('{ "error": { "code", "message", "correlationId" } }')}. Quote the correlation id when you write to us.
            </p>
            <Table
              caption="Status codes"
              head={['Status', 'Meaning']}
              rows={[
                ['202', 'A resume is being written. Follow the job.'],
                ['400', 'The request is not valid, or the Idempotency-Key header is missing.'],
                ['401', 'The key is missing, wrong, revoked or expired.'],
                ['403', 'The key lacks the scope, or the organisation is suspended.'],
                ['404', 'No such job, or the person has not given you access (or has taken it back). Both look the same.'],
                ['409', 'The person has not finished setting up Tracck.'],
                ['429', 'Over the rate limit or monthly quota. Wait for the number of seconds in the Retry-After header.'],
              ]}
              minWidth={480}
            />
          </Section>

          <Section id="audit" title="Audit events">
            <p className={p}>
              Every key and consent action is recorded with the time, the key, who did it and the source address. Staff can filter and
              download them as CSV from <Link href="/org/usage">Usage and audit</Link>.
            </p>
            <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,230px),1fr))] gap-2 p-0">
              {[
                'client.created',
                'key.created',
                'key.rotated',
                'key.revoked',
                'api.unauthorized',
                'consent.requested',
                'consent.granted',
                'consent.denied',
                'consent.revoked',
                'resume.created_by_org',
                'webhook.configured',
              ].map((event) => (
                <li key={event} className="border border-line px-3 py-2 font-mono text-[13px]">
                  {event}
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </div>
    </>
  )
}
