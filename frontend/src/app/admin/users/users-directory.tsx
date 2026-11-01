'use client'

import { Ban, CheckCircle2, Clock, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import {
  ROLES,
  ROLE_LABELS,
  type AdminUserStatus,
  type AdminUserSummaryView,
  type Page,
  type PlanId,
  type RoleId,
} from '@tracck/shared'
import { Alert } from '@/components/ui/alert'
import { Badge, Tag } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BareSelect } from '@/components/ui/field'
import { ScrollTable, tdClass, thClass } from '@/components/ui/table'
import { api, messageOf } from '@/lib/api/client'

import { formatCount, formatDate } from '@/lib/format'

function StatusBadge({ status }: { status: AdminUserStatus }) {
  if (status === 'suspended') {
    return (
      <Badge tone="danger" icon={Ban}>
        Suspended
      </Badge>
    )
  }
  if (status === 'onboarding') {
    return (
      <Badge tone="warning" icon={Clock}>
        Onboarding
      </Badge>
    )
  }
  return (
    <Badge tone="success" icon={CheckCircle2}>
      Active
    </Badge>
  )
}

export function UsersDirectory({ initial }: { initial: Page<AdminUserSummaryView> }) {
  const [items, setItems] = useState<AdminUserSummaryView[]>(initial.items)
  const [nextCursor, setNextCursor] = useState<string | null>(initial.nextCursor)
  const [q, setQ] = useState('')
  const [plan, setPlan] = useState<PlanId | 'all'>('all')
  const [status, setStatus] = useState<AdminUserStatus | 'all'>('all')
  const [role, setRole] = useState<RoleId | 'all'>('all')
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchUsers(opts: {
    q: string
    plan: PlanId | 'all'
    status: AdminUserStatus | 'all'
    role: RoleId | 'all'
    cursor?: string
    append?: boolean
  }) {
    setError(null)
    if (opts.append) setLoadingMore(true)
    else setLoading(true)

    try {
      const page = await api.admin.users({
        q: opts.q.trim() || undefined,
        plan: opts.plan === 'all' ? undefined : opts.plan,
        status: opts.status === 'all' ? undefined : opts.status,
        role: opts.role === 'all' ? undefined : opts.role,
        cursor: opts.cursor,
        limit: 25,
      })
      setItems((prev) => (opts.append ? [...prev, ...page.items] : page.items))
      setNextCursor(page.nextCursor)
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  function handleSearchSubmit(event: React.FormEvent) {
    event.preventDefault()
    void fetchUsers({ q, plan, status, role })
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3 border border-line bg-sunken p-4">
        <div className="min-w-60 flex-1">
          <label htmlFor="admin-user-search" className="sr-only">
            Search by name, email, or user ID
          </label>
          <input
            id="admin-user-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, or UUID…"
            className="min-h-10 w-full rounded-sm border border-line-input bg-canvas px-3.5 text-sm text-ink placeholder:text-ink-muted/80 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-signal"
          />
        </div>

        <BareSelect
          aria-label="Filter by plan"
          value={plan}
          onChange={(e) => {
            const next = e.target.value as PlanId | 'all'
            setPlan(next)
            void fetchUsers({ q, plan: next, status, role })
          }}
        >
          <option value="all">All plans</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
        </BareSelect>

        <BareSelect
          aria-label="Filter by status"
          value={status}
          onChange={(e) => {
            const next = e.target.value as AdminUserStatus | 'all'
            setStatus(next)
            void fetchUsers({ q, plan, status: next, role })
          }}
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="onboarding">Onboarding</option>
          <option value="suspended">Suspended</option>
        </BareSelect>

        <BareSelect
          aria-label="Filter by role"
          value={role}
          onChange={(e) => {
            const next = e.target.value as RoleId | 'all'
            setRole(next)
            void fetchUsers({ q, plan, status, role: next })
          }}
        >
          <option value="all">All roles</option>
          {ROLES.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </BareSelect>

        <Button type="submit" variant="primary" size="sm" loading={loading}>
          Search
        </Button>
      </form>

      {error && <Alert tone="danger" title="Could not load users">{error}</Alert>}

      {items.length === 0 ? (
        <div className="border border-line p-8 text-center text-ink-muted">
          No users matched the current search or filter criteria.
        </div>
      ) : (
        <ScrollTable minWidth={860} caption="Users directory">
          <thead>
            <tr>
              <th scope="col" className={thClass}>User</th>
              <th scope="col" className={thClass}>Role</th>
              <th scope="col" className={thClass}>Plan</th>
              <th scope="col" className={thClass}>Status</th>
              <th scope="col" className={thClass}>Sources</th>
              <th scope="col" className={thClass}>Resumes</th>
              <th scope="col" className={thClass}>Joined</th>
              <th scope="col" className={thClass}>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((user) => (
              <tr key={user.id}>
                <td className={tdClass}>
                  <div className="flex flex-col gap-0.5">
                    <Link href={`/admin/users/${user.id}`} className="font-semibold text-ink hover:underline">
                      {user.name || 'Unnamed user'}
                    </Link>
                    <span className="font-mono text-xs text-ink-muted">{user.email ?? user.id}</span>
                  </div>
                </td>
                <td className={tdClass}>
                  {user.primaryRole ? (
                    <Tag tone="muted">{ROLE_LABELS[user.primaryRole] ?? user.primaryRole}</Tag>
                  ) : (
                    <span className="text-xs text-ink-muted">Unset</span>
                  )}
                </td>
                <td className={tdClass}>
                  {user.plan === 'pro' ? (
                    <Badge tone="accent" icon={Sparkles}>
                      Pro
                    </Badge>
                  ) : (
                    <Tag tone="muted">Free</Tag>
                  )}
                </td>
                <td className={tdClass}>
                  <StatusBadge status={user.status} />
                </td>
                <td className={`${tdClass} font-mono text-sm`}>{formatCount(user.sourcesCount)}</td>
                <td className={`${tdClass} font-mono text-sm`}>{formatCount(user.resumesCount)}</td>
                <td className={`${tdClass} font-mono text-xs text-ink-muted`}>{formatDate(user.createdAt)}</td>
                <td className={tdClass}>
                  <Link href={`/admin/users/${user.id}`} className="text-sm font-semibold">
                    Inspect →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </ScrollTable>
      )}

      {nextCursor && (
        <div className="flex justify-center pt-2">
          <Button
            variant="secondary"
            size="md"
            loading={loadingMore}
            onClick={() => void fetchUsers({ q, plan, status, role, cursor: nextCursor, append: true })}
          >
            Load more users
          </Button>
        </div>
      )}
    </div>
  )
}
