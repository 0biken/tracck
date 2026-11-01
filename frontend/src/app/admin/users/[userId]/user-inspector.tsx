'use client'

import { Ban, CheckCircle2, Clock, RotateCcw, Shield, Sparkles, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  ROLE_LABELS,
  SOURCE_LABELS,
  type AdminUserDetailView,
  type SourceProvider,
} from '@tracck/shared'
import { PageHeader, SectionHead } from '@/components/page-header'
import { StatGrid } from '@/components/stat-grid'
import { Alert } from '@/components/ui/alert'
import { Badge, Tag } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { TextField } from '@/components/ui/field'
import { ScrollTable, tdClass, thClass } from '@/components/ui/table'
import { TabPanel, Tabs } from '@/components/ui/tabs'
import { api, messageOf } from '@/lib/api/client'

import { formatCount, formatDate, formatStamp } from '@/lib/format'

type InspectorTab = 'sources' | 'resumes' | 'jobs' | 'payments' | 'audit'

export function UserInspector({
  initial,
  viewerId,
}: {
  initial: AdminUserDetailView
  viewerId: string
}) {
  const router = useRouter()
  const [user, setUser] = useState<AdminUserDetailView>(initial)
  const [tab, setTab] = useState<InspectorTab>('sources')
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const isSelf = user.id === viewerId

  async function handlePlanToggle() {
    const nextPlan = user.plan === 'pro' ? 'free' : 'pro'
    setBusyAction('plan')
    setError(null)
    setNotice(null)
    try {
      const updated = await api.admin.updateUser(user.id, {
        plan: nextPlan,
        reason: reason.trim() || undefined,
      })
      setUser(updated)
      setReason('')
      setNotice(`Updated plan to ${nextPlan.toUpperCase()}.`)
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setBusyAction(null)
    }
  }

  async function handleSuspensionToggle() {
    const nextSuspended = user.status !== 'suspended'
    setBusyAction('suspend')
    setError(null)
    setNotice(null)
    try {
      const updated = await api.admin.updateUser(user.id, {
        suspended: nextSuspended,
        reason: reason.trim() || undefined,
      })
      setUser(updated)
      setReason('')
      setNotice(nextSuspended ? 'Account has been suspended.' : 'Account suspension removed.')
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setBusyAction(null)
    }
  }

  async function handleResetQuota() {
    setBusyAction('quota')
    setError(null)
    setNotice(null)
    try {
      const updated = await api.admin.resetQuota(user.id)
      setUser(updated)
      setNotice('Monthly resume counter reset to 0.')
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setBusyAction(null)
    }
  }

  async function handleDeleteUser() {
    setBusyAction('delete')
    setError(null)
    try {
      await api.admin.deleteUser(user.id)
      setDeleteDialogOpen(false)
      router.push('/admin/users')
      router.refresh()
    } catch (err) {
      setError(messageOf(err))
      setBusyAction(null)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={`USER ID · ${user.id}`}
        title={user.name || user.email || 'Unnamed user'}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {user.staff && (
              <Badge tone="accent" icon={Shield}>
                Staff
              </Badge>
            )}
            {user.plan === 'pro' ? (
              <Badge tone="accent" icon={Sparkles}>
                Pro plan
              </Badge>
            ) : (
              <Tag tone="muted">Free plan</Tag>
            )}
            {user.status === 'suspended' ? (
              <Badge tone="danger" icon={Ban}>
                Suspended
              </Badge>
            ) : user.status === 'onboarding' ? (
              <Badge tone="warning" icon={Clock}>
                Onboarding
              </Badge>
            ) : (
              <Badge tone="success" icon={CheckCircle2}>
                Active
              </Badge>
            )}
          </div>
        }
      >
        {user.email ?? 'No email on record'}
        {user.headline ? ` — ${user.headline}` : ''}
      </PageHeader>

      {error && <Alert tone="danger" title="Action failed">{error}</Alert>}
      {notice && <Alert tone="success" title="Updated">{notice}</Alert>}

      <StatGrid
        label="User entitlements and activity"
        stats={[
          {
            label: 'PLAN & SUBSCRIPTION',
            value: user.plan.toUpperCase(),
            note:
              user.subscription.status !== 'none'
                ? `Billing: ${user.subscription.status}${user.subscription.currentPeriodEnd ? ` (until ${formatDate(user.subscription.currentPeriodEnd)})` : ''}`
                : 'No active Paystack subscription',
          },
          {
            label: 'RESUMES THIS MONTH',
            value:
              user.usage.resumesLimit === null
                ? `${formatCount(user.usage.resumesThisMonth)} / ∞`
                : `${formatCount(user.usage.resumesThisMonth)} / ${formatCount(user.usage.resumesLimit)}`,
            note: `Resets ${user.usage.periodResetsOn.replaceAll('-', '.')}`,
          },
          {
            label: 'ACTIVE SOURCES',
            value:
              user.usage.sourcesLimit === null
                ? `${formatCount(user.usage.activeSources)} / ∞`
                : `${formatCount(user.usage.activeSources)} / ${formatCount(user.usage.sourcesLimit)}`,
            note: `${formatCount(user.usage.evidenceCount)} evidence entries in graph`,
          },
          {
            label: 'JOINED / LAST SIGN-IN',
            value: formatDate(user.createdAt),
            note: user.lastSignInAt ? `Last sign-in ${formatStamp(user.lastSignInAt)}` : 'No sign-in timestamp recorded',
          },
        ]}
      />

      <section aria-labelledby="profile-actions-heading" className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4 border border-line bg-canvas p-5">
          <SectionHead id="profile-actions-heading" title="Profile details" />
          <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="font-mono text-xs text-ink-muted">PRIMARY ROLE</dt>
              <dd className="m-0 mt-0.5 font-semibold">
                {user.primaryRole ? (ROLE_LABELS[user.primaryRole] ?? user.primaryRole) : 'Not selected'}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-xs text-ink-muted">LOCATION / PHONE</dt>
              <dd className="m-0 mt-0.5">
                {[user.location, user.phone].filter(Boolean).join(' · ') || 'Not provided'}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-xs text-ink-muted">ONBOARDING</dt>
              <dd className="m-0 mt-0.5">{user.onboardingCompleted ? 'Completed' : 'In progress'}</dd>
            </div>
            <div>
              <dt className="font-mono text-xs text-ink-muted">POLICY CONSENTS</dt>
              <dd className="m-0 mt-0.5">{user.policyAccepted ? 'Accepted current terms' : 'Pending'}</dd>
            </div>
          </dl>
        </div>

        <div className="flex flex-col gap-4 border border-line-strong bg-sunken p-5">
          <SectionHead title="Admin actions" />
          <TextField
            id="admin-action-reason"
            label="Audit note / reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Support ticket #42 or scholarship grant"
          />
          <div className="flex flex-wrap gap-2.5 pt-1">
            <Button
              variant="secondary"
              size="sm"
              loading={busyAction === 'plan'}
              onClick={() => void handlePlanToggle()}
            >
              <Sparkles className="size-4" strokeWidth={1.75} aria-hidden="true" />
              {user.plan === 'pro' ? 'Switch to Free' : 'Grant Pro plan'}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              loading={busyAction === 'quota'}
              onClick={() => void handleResetQuota()}
            >
              <RotateCcw className="size-4" strokeWidth={1.75} aria-hidden="true" />
              Reset monthly quota
            </Button>

            <Button
              variant={user.status === 'suspended' ? 'secondary' : 'danger'}
              size="sm"
              disabled={isSelf}
              loading={busyAction === 'suspend'}
              onClick={() => void handleSuspensionToggle()}
            >
              <Ban className="size-4" strokeWidth={1.75} aria-hidden="true" />
              {user.status === 'suspended' ? 'Unsuspend account' : 'Suspend account'}
            </Button>

            <Button
              variant="danger"
              size="sm"
              disabled={isSelf}
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
              Delete account
            </Button>
          </div>
          {isSelf && (
            <p className="m-0 text-xs text-ink-muted">
              Self-suspension and self-deletion are disabled in the admin console.
            </p>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-5">
        <Tabs<InspectorTab>
          idBase="user-inspector"
          label="User records"
          value={tab}
          onChange={setTab}
          className="px-0 sm:px-0"
          items={[
            { value: 'sources', label: `Sources (${user.sources.length})` },
            { value: 'resumes', label: `Resumes (${user.resumes.length})` },
            { value: 'jobs', label: `Jobs (${user.recentJobs.length})` },
            { value: 'payments', label: `Payments (${user.payments.length})` },
            { value: 'audit', label: `Audit trail (${user.auditEvents.length})` },
          ]}
        />

        <TabPanel idBase="user-inspector" value="sources" active={tab === 'sources'}>
          {user.sources.length === 0 ? (
            <p className="m-0 text-sm text-ink-muted">No connected sources.</p>
          ) : (
            <ScrollTable minWidth={640} caption="User connected sources">
              <thead>
                <tr>
                  <th scope="col" className={thClass}>Provider</th>
                  <th scope="col" className={thClass}>Handle / detail</th>
                  <th scope="col" className={thClass}>Status</th>
                  <th scope="col" className={thClass}>Last synced</th>
                  <th scope="col" className={thClass}>Last error</th>
                </tr>
              </thead>
              <tbody>
                {user.sources.map((src) => (
                  <tr key={src.id}>
                    <td className={`${tdClass} font-semibold`}>
                      {SOURCE_LABELS[src.provider as SourceProvider] ?? src.provider}
                    </td>
                    <td className={`${tdClass} font-mono text-xs`}>{src.handle ?? '—'}</td>
                    <td className={tdClass}>
                      <Tag tone={src.status === 'error' ? 'danger' : 'muted'}>{src.status}</Tag>
                    </td>
                    <td className={`${tdClass} font-mono text-xs text-ink-muted`}>
                      {src.lastSyncAt ? formatStamp(src.lastSyncAt) : 'Never'}
                    </td>
                    <td className={`${tdClass} font-mono text-xs text-danger-ink`}>
                      {src.lastErrorCode ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </ScrollTable>
          )}
        </TabPanel>

        <TabPanel idBase="user-inspector" value="resumes" active={tab === 'resumes'}>
          {user.resumes.length === 0 ? (
            <p className="m-0 text-sm text-ink-muted">No resumes generated yet.</p>
          ) : (
            <ScrollTable minWidth={680} caption="User resumes">
              <thead>
                <tr>
                  <th scope="col" className={thClass}>Title</th>
                  <th scope="col" className={thClass}>Company</th>
                  <th scope="col" className={thClass}>Length</th>
                  <th scope="col" className={thClass}>Status</th>
                  <th scope="col" className={thClass}>Engine</th>
                  <th scope="col" className={thClass}>Created</th>
                  <th scope="col" className={thClass}>Exported</th>
                </tr>
              </thead>
              <tbody>
                {user.resumes.map((r) => (
                  <tr key={r.id}>
                    <td className={`${tdClass} font-semibold`}>{r.title}</td>
                    <td className={tdClass}>{r.company ?? '—'}</td>
                    <td className={`${tdClass} font-mono text-xs`}>{r.length}</td>
                    <td className={tdClass}>
                      <Tag tone={r.status === 'failed' ? 'danger' : 'muted'}>{r.status}</Tag>
                    </td>
                    <td className={`${tdClass} font-mono text-xs`}>{r.engine}</td>
                    <td className={`${tdClass} font-mono text-xs text-ink-muted`}>{formatStamp(r.createdAt)}</td>
                    <td className={`${tdClass} font-mono text-xs text-ink-muted`}>
                      {r.lastExportedAt ? formatStamp(r.lastExportedAt) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </ScrollTable>
          )}
        </TabPanel>

        <TabPanel idBase="user-inspector" value="jobs" active={tab === 'jobs'}>
          {user.recentJobs.length === 0 ? (
            <p className="m-0 text-sm text-ink-muted">No background jobs recorded for this user.</p>
          ) : (
            <ScrollTable minWidth={720} caption="User background jobs">
              <thead>
                <tr>
                  <th scope="col" className={thClass}>Type</th>
                  <th scope="col" className={thClass}>Status</th>
                  <th scope="col" className={thClass}>Step</th>
                  <th scope="col" className={thClass}>Attempts</th>
                  <th scope="col" className={thClass}>Error</th>
                  <th scope="col" className={thClass}>Created</th>
                </tr>
              </thead>
              <tbody>
                {user.recentJobs.map((job) => (
                  <tr key={job.id}>
                    <td className={`${tdClass} font-mono text-xs font-semibold`}>{job.jobType}</td>
                    <td className={tdClass}>
                      <Tag tone={job.status === 'failed' ? 'danger' : job.status === 'succeeded' ? 'signal' : 'muted'}>
                        {job.status}
                      </Tag>
                    </td>
                    <td className={`${tdClass} font-mono text-xs`}>{job.step ?? '—'}</td>
                    <td className={`${tdClass} font-mono text-xs`}>{job.attemptCount}</td>
                    <td className={`${tdClass} text-xs text-danger-ink`}>
                      {job.errorCode ? `${job.errorCode}: ${job.safeErrorMessage ?? ''}` : '—'}
                    </td>
                    <td className={`${tdClass} font-mono text-xs text-ink-muted`}>{formatStamp(job.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </ScrollTable>
          )}
        </TabPanel>

        <TabPanel idBase="user-inspector" value="payments" active={tab === 'payments'}>
          {user.payments.length === 0 ? (
            <p className="m-0 text-sm text-ink-muted">No payment records found.</p>
          ) : (
            <ScrollTable minWidth={640} caption="User payments">
              <thead>
                <tr>
                  <th scope="col" className={thClass}>Reference</th>
                  <th scope="col" className={thClass}>Amount</th>
                  <th scope="col" className={thClass}>Status</th>
                  <th scope="col" className={thClass}>Paid at</th>
                </tr>
              </thead>
              <tbody>
                {user.payments.map((p) => (
                  <tr key={p.id}>
                    <td className={`${tdClass} font-mono text-xs`}>{p.reference}</td>
                    <td className={`${tdClass} font-mono text-sm`}>
                      {p.currency} {(p.amountMinor / 100).toFixed(2)}
                    </td>
                    <td className={tdClass}>
                      <Tag tone={p.status === 'succeeded' ? 'signal' : p.status === 'failed' ? 'danger' : 'muted'}>
                        {p.status}
                      </Tag>
                    </td>
                    <td className={`${tdClass} font-mono text-xs text-ink-muted`}>
                      {p.paidAt ? formatStamp(p.paidAt) : formatStamp(p.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </ScrollTable>
          )}
        </TabPanel>

        <TabPanel idBase="user-inspector" value="audit" active={tab === 'audit'}>
          {user.auditEvents.length === 0 ? (
            <p className="m-0 text-sm text-ink-muted">No audit events recorded for this user.</p>
          ) : (
            <ScrollTable minWidth={720} caption="User audit events">
              <thead>
                <tr>
                  <th scope="col" className={thClass}>When</th>
                  <th scope="col" className={thClass}>Event</th>
                  <th scope="col" className={thClass}>Actor</th>
                  <th scope="col" className={thClass}>Metadata</th>
                </tr>
              </thead>
              <tbody>
                {user.auditEvents.map((ev) => (
                  <tr key={ev.id}>
                    <td className={`${tdClass} font-mono text-xs text-ink-muted`}>{formatStamp(ev.createdAt)}</td>
                    <td className={`${tdClass} font-mono text-xs font-semibold`}>{ev.eventType}</td>
                    <td className={`${tdClass} font-mono text-xs text-ink-muted`}>{ev.actor ?? 'system'}</td>
                    <td className={`${tdClass} font-mono text-xs text-ink-muted`}>
                      {Object.keys(ev.metadata).length > 0 ? JSON.stringify(ev.metadata) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </ScrollTable>
          )}
        </TabPanel>
      </section>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        title="Delete user account"
      >
        <div className="flex flex-col gap-4">
          <h2 className="t-h3 m-0">Delete {user.name || user.email || 'this account'}?</h2>
          <p className="m-0 text-sm leading-6 text-ink-muted">
            This dispatches the permanent account deletion job: active Paystack subscriptions are cancelled, stored CV
            and export files are wiped, and the account and its Career Graph are erased. This cannot be undone.
          </p>
          <div className="flex justify-end gap-2.5 pt-2">
            <Button variant="secondary" size="md" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger-solid"
              size="md"
              loading={busyAction === 'delete'}
              onClick={() => void handleDeleteUser()}
            >
              Delete account permanently
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
