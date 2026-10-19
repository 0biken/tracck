'use client'

import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import { Button, buttonClass } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { BareSelect, TextField } from '@/components/ui/field'
import { MOCK_USER, PLANS } from '@/lib/mock/account'
import { GRANTED_ORGS } from '@/lib/mock/org'

function Section({
  id,
  title,
  hint,
  first = false,
  children,
}: {
  id: string
  title: string
  hint: string
  first?: boolean
  children: ReactNode
}) {
  return (
    <section
      aria-labelledby={id}
      className={`grid gap-5 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-8 ${first ? "" : "border-t border-line"}`}
    >
      <div className="flex flex-col gap-1.5">
        <h2 id={id} className="t-claim m-0">
          {title}
        </h2>
        <span className="text-sm leading-[21px] text-ink-muted">{hint}</span>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  )
}

const row = 'flex items-center justify-between gap-4 border-b border-line py-3.5 text-[15px]'

type Confirm = 'resumes' | 'account' | null

export function SettingsForm({ name, email }: { name: string; email: string }) {
  const [notify, setNotify] = useState({ done: true, weekly: true, attention: true })
  const [retention, setRetention] = useState('12 months')
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [orgs, setOrgs] = useState(GRANTED_ORGS)
  const [message, setMessage] = useState<string | null>(null)

  function revoke(id: string) {
    setOrgs((list) => list.filter((org) => org.id !== id))
    setMessage('Access revoked. That organisation can no longer read your data.')
  }

  const toggles: { key: keyof typeof notify; label: string }[] = [
    { key: 'done', label: 'Email me when a resume or source finishes' },
    { key: 'weekly', label: 'Weekly email when new evidence is found' },
    { key: 'attention', label: 'Email when a source needs attention' },
  ]

  return (
    <>
      {message && (
        <div role="status" className="border border-line-strong bg-sunken px-4 py-3 text-sm">
          {message}
        </div>
      )}

      <Section id="s-acc" title="Account" hint="Used on every resume header." first>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-4">
          <TextField id="full-name" label="Full name" defaultValue={name} autoComplete="name" />
          <TextField id="account-email" label="Email" type="email" defaultValue={email} autoComplete="email" />
          <TextField id="location" label="Location" defaultValue={MOCK_USER.location} autoComplete="address-level2" />
          <TextField id="roles" label="Roles" defaultValue={MOCK_USER.roles.join(', ')} />
        </div>
      </Section>

      <Section id="s-plan" title="Plan" hint="1 of 2 resumes used this month. Resets 2026.11.01.">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-px border border-line bg-line">
          <div className="flex flex-col gap-2.5 bg-sunken p-5">
            <span className="t-eyebrow text-ink-muted">Current</span>
            <span className="text-lg font-bold">{PLANS.free.name}</span>
            <span className="font-mono text-[22px]">{PLANS.free.price}</span>
            <span className="text-sm leading-[21px] text-ink-muted">{PLANS.free.settingsBlurb}</span>
          </div>
          <div className="flex flex-col gap-2.5 bg-canvas p-5">
            <span className="t-eyebrow text-ink-muted">{PLANS.student.eyebrow}</span>
            <span className="text-lg font-bold">{PLANS.student.name}</span>
            <span className="font-mono text-[22px]">
              {PLANS.student.price}
              <span className="text-[13px] text-ink-muted"> / month</span>
            </span>
            <span className="text-sm leading-[21px] text-ink-muted">Everything in Pro. Verify with an .edu.ng email.</span>
            <Button className="self-start">Verify {email}</Button>
          </div>
          <div className="flex flex-col gap-2.5 bg-canvas p-5">
            <span className="t-eyebrow text-ink-muted">{PLANS.pro.eyebrow}</span>
            <span className="text-lg font-bold">{PLANS.pro.name}</span>
            <span className="font-mono text-[22px]">
              {PLANS.pro.price}
              <span className="text-[13px] text-ink-muted"> / month</span>
            </span>
            <span className="text-sm leading-[21px] text-ink-muted">{PLANS.pro.settingsBlurb}</span>
            <Button variant="secondary" className="self-start">
              Upgrade
            </Button>
          </div>
        </div>
      </Section>

      <Section id="s-not" title="Notifications" hint="Email only. In-app notices always show.">
        <div>
          {toggles.map((toggle) => (
            <label key={toggle.key} className={`${row} cursor-pointer`}>
              <span>{toggle.label}</span>
              <input
                type="checkbox"
                checked={notify[toggle.key]}
                onChange={(event) => setNotify({ ...notify, [toggle.key]: event.target.checked })}
                className="size-5 shrink-0 cursor-pointer accent-ink"
              />
            </label>
          ))}
        </div>
      </Section>

      <Section
        id="s-priv"
        title="Privacy and data"
        hint="Only the evidence relevant to a job is sent to the AI. Credentials never are."
      >
        <div className="flex flex-col">
          <div className={row}>
            <label htmlFor="retention">Uploaded CVs are kept for</label>
            <BareSelect
              id="retention"
              value={retention}
              onChange={(event) => setRetention(event.target.value)}
              className="w-44 shrink-0"
            >
              <option>12 months</option>
              <option>6 months</option>
              <option>Until I delete</option>
            </BareSelect>
          </div>
          <div className={row}>
            <span>Download everything Tracck holds about you</span>
            <Button variant="secondary" onClick={() => setMessage('Export requested. We will email you a download link.')}>
              Request export
            </Button>
          </div>
          <div className={row}>
            <span>Delete all resumes</span>
            <Button variant="danger" onClick={() => setConfirm('resumes')}>
              Delete resumes
            </Button>
          </div>
          <div className={`${row} border-b-0`}>
            <span>
              <strong>Delete account</strong>
              <br />
              <span className="text-[13px] text-ink-muted">
                Removes sources, entries, resumes and consents. Cannot be undone.
              </span>
            </span>
            <Button variant="danger-solid" onClick={() => setConfirm('account')}>
              Delete account
            </Button>
          </div>
        </div>
      </Section>

      <Section
        id="s-org"
        title="Organisations with access"
        hint="Organisations can read your data only with your consent. Revoke at any time."
      >
        <div className="flex flex-col">
          {orgs.length === 0 && <p className="m-0 py-3.5 text-[15px] text-ink-muted">No organisation has access.</p>}
          {orgs.map((org) => (
            <div key={org.id} className={row}>
              <span className="flex min-w-0 flex-col gap-0.5">
                <strong>{org.name}</strong>
                <span className="font-mono text-xs text-ink-muted">{org.detail}</span>
              </span>
              {org.state === 'granted' ? (
                <Button variant="secondary" onClick={() => revoke(org.id)}>
                  Revoke
                </Button>
              ) : (
                <Link href="/consent" className={buttonClass('secondary', 'md')}>
                  Review request
                </Link>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm === 'account' ? 'Delete account' : 'Delete all resumes'}
      >
        <div className="flex flex-col gap-4 pr-8">
          <h2 className="t-claim m-0">{confirm === 'account' ? 'Delete your account?' : 'Delete all resumes?'}</h2>
          <p className="m-0 text-[15px] leading-[22px] text-ink-muted">
            {confirm === 'account'
              ? 'This removes your sources, entries, resumes and consents. It cannot be undone.'
              : 'This removes every resume and its saved job description. Your sources and entries stay.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="danger-solid"
              onClick={() => {
                setMessage(confirm === 'account' ? 'Account deletion requested.' : 'All resumes deleted.')
                setConfirm(null)
              }}
            >
              {confirm === 'account' ? 'Delete account' : 'Delete resumes'}
            </Button>
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  )
}
