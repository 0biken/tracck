import Link from 'next/link'
import type { ReactNode } from 'react'
import { PageHeader } from '@/components/page-header'
import { Tag } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { ScrollTable, tdClass, thClass } from '@/components/ui/table'
import { ALL_SCOPES } from '@/lib/mock/org'

export const metadata = { title: 'API reference' }

const scopeDescriptions: Record<(typeof ALL_SCOPES)[number], string> = {
  'generate:resume': 'Create a resume for a person who has consented, from a job description you send.',
  'read:resume': 'Read resumes that were created through your key.',
  'read:profile': 'Read the person’s profile and skills summary. Never their CV, sources or account details.',
}

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

const p = 'm-0 text-[15px] leading-[23px] text-ink-muted'

export default function ApiReferencePage() {
  return (
    <>
      <PageHeader eyebrow="Organisation API · version 1" title="API reference">
        Generate and read verified resumes for people who have consented. Everything an integration needs, on one page.
      </PageHeader>

      <Alert tone="warning" title="Preview of the contract">
        The API is not live yet. This is the planned shape of version 1; items in [BRACKETS] are still to be decided.
        You can create sandbox and live keys now on the <Link href="/org/keys">API keys</Link> page.
      </Alert>

      <div className="grid items-start gap-10 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-14">
        <nav aria-label="On this page" className="flex flex-col lg:sticky lg:top-6">
          <div className="t-eyebrow pb-2 text-ink-muted">On this page</div>
          {[
            ['auth', 'Authentication'],
            ['scopes', 'Scopes'],
            ['consent', 'Consent'],
            ['create', 'Create a resume'],
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
              Send your key as a bearer token on every request. Keys belong to one organisation and can reach only its
              data. Tracck stores a hash and the prefix, so a lost key cannot be recovered; create a new one.
            </p>
            <Code label="Authorization header">{'Authorization: Bearer trk_live_8f2a••••••••'}</Code>
            <ul className="m-0 flex list-disc flex-col gap-2 pl-5 text-[15px] leading-[23px] text-ink-muted">
              <li>
                <span className="font-mono text-ink">trk_live_</span> keys act on real people&apos;s records.
              </li>
              <li>
                <span className="font-mono text-ink">trk_test_</span> keys work on synthetic data only.
              </li>
              <li>Rotate a key from the API keys page; the old key keeps working until its stop date.</li>
            </ul>
          </Section>

          <Section id="scopes" title="Scopes">
            <p className={p}>Grant only what an integration needs. A request outside its key&apos;s scopes is refused.</p>
            <ScrollTable caption="Scopes" minWidth={480}>
              <thead>
                <tr>
                  <th className={thClass}>Scope</th>
                  <th className={thClass}>Allows</th>
                </tr>
              </thead>
              <tbody>
                {ALL_SCOPES.map((scope) => (
                  <tr key={scope}>
                    <td className={`${tdClass} align-top`}>
                      <Tag tone="ink">{scope}</Tag>
                    </td>
                    <td className={`${tdClass} text-[14px] leading-5 text-ink-muted`}>{scopeDescriptions[scope]}</td>
                  </tr>
                ))}
              </tbody>
            </ScrollTable>
          </Section>

          <Section id="consent" title="Consent">
            <p className={p}>
              A valid key alone grants nothing. A person must allow your organisation first, choosing which scopes to
              give. You send them to the <Link href="/consent">consent page</Link>, where they see exactly what you ask
              for and what you will not be able to do. They can revoke at any time, and the next request is refused.
            </p>
            <p className={p}>How you start a consent request and learn its outcome: [CONSENT FLOW ENDPOINTS TO CONFIRM].</p>
          </Section>

          <Section id="create" title="Create a resume">
            <p className={p}>
              Sends one job description for one person and returns a resume. Needs the{' '}
              <span className="font-mono text-ink">generate:resume</span> scope and the person&apos;s consent.
            </p>
            <Code label="Example request">
              {`POST /v1/resumes\nAuthorization: Bearer trk_live_8f2a••••••••\n\n{ "user": "usr_31c9", "length": "one_page",\n  "job_description": "Backend Engineer..." }`}
            </Code>
            <ScrollTable caption="Request fields" minWidth={520}>
              <thead>
                <tr>
                  <th className={thClass}>Field</th>
                  <th className={thClass}>Type</th>
                  <th className={thClass}>Meaning</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['user', 'string', 'The person’s Tracck id, from their consent.'],
                  ['length', '"one_page" | "full"', 'Length of the resume. Checked on the finished layout.'],
                  ['job_description', 'string', 'The job text to tailor to, as plain text.'],
                ].map(([field, type, meaning]) => (
                  <tr key={field}>
                    <td className={`${tdClass} font-mono text-[13px]`}>{field}</td>
                    <td className={`${tdClass} font-mono text-[13px] text-ink-muted`}>{type}</td>
                    <td className={`${tdClass} text-[14px] leading-5 text-ink-muted`}>{meaning}</td>
                  </tr>
                ))}
              </tbody>
            </ScrollTable>
            <Code label="Example response status">{'201 Created · consent: granted 2026.10.02'}</Code>
            <p className={p}>Response body, and how long generation takes to finish: [RESPONSE SCHEMA TO CONFIRM].</p>
          </Section>

          <Section id="limits" title="Limits and errors">
            <p className={p}>
              Each key has a rate limit per minute and draws on a monthly quota set by your plan. You can see both on the{' '}
              <Link href="/org/keys">API keys</Link> page, and use against them on <Link href="/org/usage">Usage and audit</Link>.
            </p>
            <ScrollTable caption="Status codes" minWidth={480}>
              <thead>
                <tr>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Meaning</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['401', 'The key is missing, wrong, revoked or expired.'],
                  ['403', 'The key lacks the scope, or the person has not consented or has revoked.'],
                  ['429', 'The key went over its rate limit. Wait, then retry.'],
                ].map(([status, meaning]) => (
                  <tr key={status}>
                    <td className={`${tdClass} font-mono text-[13px]`}>{status}</td>
                    <td className={`${tdClass} text-[14px] leading-5 text-ink-muted`}>{meaning}</td>
                  </tr>
                ))}
              </tbody>
            </ScrollTable>
          </Section>

          <Section id="audit" title="Audit events">
            <p className={p}>
              Every key and consent action is recorded with the time, the key, who did it and the source address. Filter
              and download them as CSV from <Link href="/org/usage">Usage and audit</Link>.
            </p>
            <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,230px),1fr))] gap-2 p-0">
              {['key.created', 'key.rotation_started', 'key.revoked', 'resume.generated', 'rate_limit.exceeded', 'consent.granted'].map(
                (event) => (
                  <li key={event} className="border border-line px-3 py-2 font-mono text-[13px]">
                    {event}
                  </li>
                ),
              )}
            </ul>
          </Section>
        </div>
      </div>
    </>
  )
}
