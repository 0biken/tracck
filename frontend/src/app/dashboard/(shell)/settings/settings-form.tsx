'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { PLAN_CARDS, ROLES, type BillingView, type CvRetention, type MeView, type Preferences } from '@tracck/shared'
import { ErrorNotice } from '@/components/sources/dialogs'
import { Tag } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { BareSelect, TextField } from '@/components/ui/field'
import { api, messageOf } from '@/lib/api/client'
import { ApiClientError } from '@/lib/api/errors'
import { apiBase } from '@/lib/api/transport'
import { formatDate } from '@/lib/format'
import { useJob } from '@/lib/use-job'
import { createClient } from '@/utils/supabase/client'

export type Notice = { tone: 'ok' | 'error'; text: string }

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
      className={`grid gap-5 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-8 ${first ? '' : 'border-t border-line'}`}
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

const retentionLabels: Record<CvRetention, string> = {
  '12_months': '12 months',
  '6_months': '6 months',
  until_deleted: 'Until I delete',
}

type Confirm = 'resumes' | 'account' | 'cancel' | null

export function SettingsForm({
  me,
  billing,
  notice,
}: {
  me: MeView
  billing: BillingView
  notice: Notice | null
}) {
  const router = useRouter()
  const [name, setName] = useState(me.name ?? '')
  const [location, setLocation] = useState(me.location ?? '')
  const [phone, setPhone] = useState(me.phone ?? '')
  const [address, setAddress] = useState(me.address ?? '')
  const [dateOfBirth, setDateOfBirth] = useState(me.dateOfBirth ?? '')
  const [nationality, setNationality] = useState(me.nationality ?? '')
  const [prefs, setPrefs] = useState<Preferences>(me.preferences)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<Notice | null>(notice)
  const [error, setError] = useState<unknown>(null)
  const [typed, setTyped] = useState('')

  const say = (text: string) => setMessage({ tone: 'ok', text })
  const fail = (failure: unknown) => setMessage({ tone: 'error', text: messageOf(failure) })

  async function saveAccount() {
    setSaving(true)
    try {
      await api.me.update({
        name: name.trim() || undefined,
        location: location.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        dateOfBirth: dateOfBirth || null,
        nationality: nationality.trim() || null,
      })
      say('Saved. Your details now appear on new resumes.')
      router.refresh()
    } catch (failure) {
      fail(failure)
    } finally {
      setSaving(false)
    }
  }

  async function savePrefs(next: Preferences) {
    const previous = prefs
    setPrefs(next)
    try {
      await api.me.setPreferences(next)
      say('Saved.')
    } catch (failure) {
      setPrefs(previous)
      fail(failure)
    }
  }

  /** Paystack hosts the payment. The person comes back to this page with the outcome. */
  async function checkout() {
    setBusy('pro')
    setMessage(null)
    try {
      const { authorizationUrl } = await api.billing.checkout({ returnPath: '/dashboard/settings' })
      window.location.assign(authorizationUrl)
    } catch (failure) {
      fail(failure)
      setBusy(null)
    }
  }

  async function cancelPlan() {
    setBusy('cancel')
    try {
      await api.billing.cancel()
      setConfirm(null)
      say('Your plan will not renew. You keep it until the end of the period you paid for.')
      router.refresh()
    } catch (failure) {
      setError(failure)
    } finally {
      setBusy(null)
    }
  }

  async function deleteResumes() {
    setBusy('resumes')
    try {
      await api.resumes.removeAll()
      setConfirm(null)
      say('All resumes deleted.')
      router.refresh()
    } catch (failure) {
      setError(failure)
    } finally {
      setBusy(null)
    }
  }

  /** Deleting the account removes the sign-in too, so the person is signed out straight away. */
  async function deleteAccount() {
    setBusy('account')
    try {
      await api.me.deleteAccount()
      await createClient().auth.signOut()
      window.location.assign('/?deleted=1')
    } catch (failure) {
      setError(failure)
      setBusy(null)
    }
  }

  const toggles: { key: keyof Preferences['notifications']; label: string }[] = [
    { key: 'done', label: 'Email me when a resume or source finishes' },
    { key: 'weekly', label: 'Weekly email when new evidence is found' },
    { key: 'attention', label: 'Email when a source needs attention' },
  ]

  const roleNames = me.roles.map((id) => ROLES.find((role) => role.id === id)?.name ?? id)
  const onPro = me.plan === 'pro'
  const paymentsOff = !billing.paymentsConfigured
  const { usage } = billing

  return (
    <>
      {message && (
        <div
          role={message.tone === 'error' ? 'alert' : 'status'}
          className={`border px-4 py-3 text-sm ${
            message.tone === 'error' ? 'border-danger bg-danger-tint text-danger-ink' : 'border-line-strong bg-sunken'
          }`}
        >
          {message.text}
        </div>
      )}

      <Section id="s-acc" title="Account" hint="Used on every resume header." first>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-4">
            <TextField id="full-name" label="Full name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
            <TextField
              id="account-email"
              label="Email"
              type="email"
              value={me.email ?? ''}
              readOnly
              help="The address you sign in with."
              autoComplete="email"
            />
            <TextField id="location" label="Location" value={location} onChange={(event) => setLocation(event.target.value)} autoComplete="address-level2" />
            <TextField id="phone" label="Phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" />
            <TextField id="address" label="Street address" value={address} onChange={(event) => setAddress(event.target.value)} autoComplete="street-address" />
            <TextField id="dateOfBirth" label="Date of birth" type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} />
            <TextField id="nationality" label="Nationality" value={nationality} onChange={(event) => setNationality(event.target.value)} />

            <div className="flex flex-col gap-1.5">
              <span className="t-label">Roles</span>
              <div className="flex min-h-11 flex-wrap items-center gap-1.5">
                {roleNames.length === 0 && <span className="text-sm text-ink-muted">None chosen yet.</span>}
                {roleNames.map((role) => (
                  <Tag key={role} tone="ink" className="px-2 py-1">
                    {role}
                  </Tag>
                ))}
              </div>
              <Link href="/onboarding/role" className="text-[13px] font-semibold">
                Change roles
              </Link>
            </div>
          </div>
          <div>
            <Button onClick={saveAccount} loading={saving} disabled={!name.trim()}>
              Save changes
            </Button>
          </div>
        </div>
      </Section>

      <Section
        id="s-plan"
        title="Plan"
        hint={
          usage.resumesLimit === null
            ? `${usage.resumes} resumes generated this month. No limit on your plan.`
            : `${usage.resumes} of ${usage.resumesLimit} resumes used this month. Resets ${usage.resetsOn.replaceAll('-', '.')}.`
        }
      >
        <div className="flex flex-col gap-4">
          {paymentsOff && (
            <p className="m-0 border border-line-strong bg-sunken px-4 py-3 text-sm">Payments are not set up on this server yet, so plans cannot be bought.</p>
          )}
          {billing.status === 'past_due' && (
            <p role="alert" className="m-0 border border-danger bg-danger-tint px-4 py-3 text-sm text-danger-ink">
              Your last payment did not go through. Pay again below to keep Pro.
            </p>
          )}
          {onPro && billing.currentPeriodEnd && (
            <p className="m-0 text-[15px]">
              {billing.cancelAtPeriodEnd
                ? `Your plan will not renew. You keep Pro until ${formatDate(billing.currentPeriodEnd)}.`
                : `Renews ${formatDate(billing.currentPeriodEnd)}.`}
            </p>
          )}

          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-px border border-line bg-line">
            <div className={`flex flex-col gap-2.5 p-5 ${onPro ? 'bg-canvas' : 'bg-sunken'}`}>
              <span className="t-eyebrow text-ink-muted">{onPro ? PLAN_CARDS.free.eyebrow : 'Current'}</span>
              <span className="text-lg font-bold">{PLAN_CARDS.free.name}</span>
              <span className="font-mono text-[22px]">{PLAN_CARDS.free.price}</span>
              <span className="text-sm leading-[21px] text-ink-muted">{PLAN_CARDS.free.settingsBlurb}</span>
            </div>

            <div className={`flex flex-col gap-2.5 p-5 ${onPro ? 'bg-sunken' : 'bg-canvas'}`}>
              <span className="t-eyebrow text-ink-muted">{onPro ? 'Current' : PLAN_CARDS.pro.eyebrow}</span>
              <span className="text-lg font-bold">{PLAN_CARDS.pro.name}</span>
              <span className="font-mono text-[22px]">
                {PLAN_CARDS.pro.price}
                <span className="text-[13px] text-ink-muted"> / month</span>
              </span>
              <span className="text-sm leading-[21px] text-ink-muted">{PLAN_CARDS.pro.settingsBlurb}</span>
              {!onPro && (
                <Button variant="secondary" className="self-start" loading={busy === 'pro'} disabled={paymentsOff} onClick={checkout}>
                  Upgrade
                </Button>
              )}
            </div>
          </div>

          {onPro && !billing.cancelAtPeriodEnd && (
            <div>
              <Button variant="secondary" onClick={() => setConfirm('cancel')}>
                Cancel plan
              </Button>
            </div>
          )}
        </div>
      </Section>

      <Section id="s-not" title="Notifications" hint="Email only. In-app notices always show.">
        <div>
          {toggles.map((toggle) => (
            <label key={toggle.key} className={`${row} cursor-pointer`}>
              <span>{toggle.label}</span>
              <input
                type="checkbox"
                checked={prefs.notifications[toggle.key]}
                onChange={(event) => savePrefs({ ...prefs, notifications: { ...prefs.notifications, [toggle.key]: event.target.checked } })}
                className="size-5 shrink-0 cursor-pointer accent-ink"
              />
            </label>
          ))}
        </div>
      </Section>

      <Section id="s-priv" title="Privacy and data" hint="Only the evidence relevant to a job is sent to the AI. Credentials never are.">
        <div className="flex flex-col">
          <div className={row}>
            <label htmlFor="retention">Uploaded CVs are kept for</label>
            <BareSelect
              id="retention"
              value={prefs.cvRetention}
              onChange={(event) => savePrefs({ ...prefs, cvRetention: event.target.value as CvRetention })}
              className="w-44 shrink-0"
            >
              {(Object.keys(retentionLabels) as CvRetention[]).map((value) => (
                <option key={value} value={value}>
                  {retentionLabels[value]}
                </option>
              ))}
            </BareSelect>
          </div>
          <div className={row}>
            <span>Download everything Tracck holds about you</span>
            <ExportControl onError={setError} onSaid={say} />
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
              <span className="text-[13px] text-ink-muted">Removes sources, entries, resumes and policy agreements. Cannot be undone.</span>
            </span>
            <Button variant="danger-solid" onClick={() => setConfirm('account')}>
              Delete account
            </Button>
          </div>
        </div>
      </Section>

      <Dialog
        open={confirm !== null}
        onClose={() => {
          setConfirm(null)
          setTyped('')
          setError(null)
        }}
        title={confirm === 'account' ? 'Delete account' : confirm === 'cancel' ? 'Cancel plan' : 'Delete all resumes'}
      >
        <div className="flex flex-col gap-4 pr-8">
          <h2 className="t-claim m-0">
            {confirm === 'account' ? 'Delete your account?' : confirm === 'cancel' ? 'Cancel your plan?' : 'Delete all resumes?'}
          </h2>
          <p className="m-0 text-[15px] leading-[22px] text-ink-muted">
            {confirm === 'account'
              ? 'This removes your sources, entries, resumes, files and policy agreements, and ends any subscription. It cannot be undone.'
              : confirm === 'cancel'
                ? `Your plan will not renew. You keep Pro until ${formatDate(billing.currentPeriodEnd)}.`
                : 'This removes every resume and its saved job description. Your sources and entries stay.'}
          </p>
          {confirm === 'account' && (
            <TextField
              id="confirm-delete"
              label="Type DELETE to confirm"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
            />
          )}
          {error !== null && <ErrorNotice error={error} />}
          <div className="flex flex-wrap gap-2">
            {confirm === 'account' && (
              <Button variant="danger-solid" loading={busy === 'account'} disabled={typed.trim() !== 'DELETE'} onClick={deleteAccount}>
                Delete account
              </Button>
            )}
            {confirm === 'resumes' && (
              <Button variant="danger-solid" loading={busy === 'resumes'} onClick={deleteResumes}>
                Delete resumes
              </Button>
            )}
            {confirm === 'cancel' && (
              <Button variant="danger-solid" loading={busy === 'cancel'} onClick={cancelPlan}>
                Cancel plan
              </Button>
            )}
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Keep it
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  )
}

/** Asks for a copy of the person's data, follows the job, and opens the zip when it is ready. */
function ExportControl({ onError, onSaid }: { onError: (error: unknown) => void; onSaid: (text: string) => void }) {
  const [jobId, setJobId] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  async function start() {
    setStarting(true)
    try {
      setJobId((await api.me.requestExport()).jobId)
    } catch (failure) {
      onError(failure)
    } finally {
      setStarting(false)
    }
  }

  return (
    <>
      <Button variant="secondary" loading={starting || jobId !== null} onClick={start}>
        {jobId ? 'Preparing…' : 'Request export'}
      </Button>
      {jobId && <Following key={jobId} jobId={jobId} onDone={() => setJobId(null)} onError={onError} onSaid={onSaid} />}
    </>
  )
}

function Following({
  jobId,
  onDone,
  onError,
  onSaid,
}: {
  jobId: string
  onDone: () => void
  onError: (error: unknown) => void
  onSaid: (text: string) => void
}) {
  const { job } = useJob(apiBase(), jobId)
  const status = job?.status

  useEffect(() => {
    if (status === 'succeeded') {
      void api.me
        .latestExport()
        .then((latest) => {
          if (latest) {
            window.open(latest.url, '_blank', 'noopener')
            onSaid('Your export is ready. The link works for a few minutes; request another if it runs out.')
          }
        })
        .catch(onError)
        .finally(onDone)
    } else if (status === 'failed' || status === 'cancelled') {
      onError(new ApiClientError(422, 'EXPORT_FAILED', 'We could not prepare your export. Try again.'))
      onDone()
    }
  }, [status, onDone, onError, onSaid])

  return (
    <span className="sr-only" role="status">
      Preparing your export
    </span>
  )
}
