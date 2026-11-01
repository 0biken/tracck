'use client'

import Link from 'next/link'
import { useState } from 'react'
import type {
  AdminAuditEventView,
  AdminDeletionRequestView,
  AdminWaitlistEntryView,
  Page,
} from '@tracck/shared'
import { Tag } from '@/components/ui/badge'
import { ScrollTable, tdClass, thClass } from '@/components/ui/table'
import { TabPanel, Tabs } from '@/components/ui/tabs'
import { formatDate, formatStamp } from '@/lib/format'

type ActivityTab = 'audit' | 'deletions' | 'waitlist'

export function ActivityViews({
  initialAudit,
  deletions,
  waitlist,
}: {
  initialAudit: Page<AdminAuditEventView>
  deletions: AdminDeletionRequestView[]
  waitlist: AdminWaitlistEntryView[]
}) {
  const [tab, setTab] = useState<ActivityTab>('audit')

  return (
    <div className="flex flex-col gap-6">
      <Tabs<ActivityTab>
        idBase="admin-activity"
        label="Platform activity and queues"
        value={tab}
        onChange={setTab}
        className="px-0 sm:px-0"
        items={[
          { value: 'audit', label: `Audit log (${initialAudit.items.length})` },
          { value: 'deletions', label: `Deletion requests (${deletions.length})` },
          { value: 'waitlist', label: `Waitlist (${waitlist.length})` },
        ]}
      />

      <TabPanel idBase="admin-activity" value="audit" active={tab === 'audit'}>
        {initialAudit.items.length === 0 ? (
          <p className="m-0 text-sm text-ink-muted">No audit events recorded yet.</p>
        ) : (
          <ScrollTable minWidth={820} caption="Platform audit events">
            <thead>
              <tr>
                <th scope="col" className={thClass}>Timestamp</th>
                <th scope="col" className={thClass}>Event</th>
                <th scope="col" className={thClass}>Target user</th>
                <th scope="col" className={thClass}>Actor</th>
                <th scope="col" className={thClass}>Metadata</th>
              </tr>
            </thead>
            <tbody>
              {initialAudit.items.map((ev) => (
                <tr key={ev.id}>
                  <td className={`${tdClass} font-mono text-xs text-ink-muted`}>{formatStamp(ev.createdAt)}</td>
                  <td className={`${tdClass} font-mono text-xs font-semibold`}>{ev.eventType}</td>
                  <td className={tdClass}>
                    {ev.userId ? (
                      <Link href={`/admin/users/${ev.userId}`} className="font-mono text-xs hover:underline">
                        {ev.userEmail ?? ev.userId}
                      </Link>
                    ) : (
                      <span className="text-xs text-ink-muted">—</span>
                    )}
                  </td>
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

      <TabPanel idBase="admin-activity" value="deletions" active={tab === 'deletions'}>
        {deletions.length === 0 ? (
          <p className="m-0 text-sm text-ink-muted">No account deletion requests recorded.</p>
        ) : (
          <ScrollTable minWidth={720} caption="Account deletion requests">
            <thead>
              <tr>
                <th scope="col" className={thClass}>User</th>
                <th scope="col" className={thClass}>Status</th>
                <th scope="col" className={thClass}>Requested at</th>
                <th scope="col" className={thClass}>Due by</th>
                <th scope="col" className={thClass}>Completed at</th>
              </tr>
            </thead>
            <tbody>
              {deletions.map((req) => (
                <tr key={req.id}>
                  <td className={`${tdClass} font-mono text-xs`}>{req.userEmail ?? req.userId}</td>
                  <td className={tdClass}>
                    <Tag
                      tone={
                        req.status === 'completed'
                          ? 'signal'
                          : req.status === 'failed'
                            ? 'danger'
                            : 'ink'
                      }
                    >
                      {req.status}
                    </Tag>
                  </td>
                  <td className={`${tdClass} font-mono text-xs text-ink-muted`}>{formatStamp(req.requestedAt)}</td>
                  <td className={`${tdClass} font-mono text-xs text-ink-muted`}>{formatDate(req.dueAt)}</td>
                  <td className={`${tdClass} font-mono text-xs text-ink-muted`}>
                    {req.completedAt ? formatStamp(req.completedAt) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </ScrollTable>
        )}
      </TabPanel>

      <TabPanel idBase="admin-activity" value="waitlist" active={tab === 'waitlist'}>
        {waitlist.length === 0 ? (
          <p className="m-0 text-sm text-ink-muted">No organisation waitlist entries yet.</p>
        ) : (
          <ScrollTable minWidth={780} caption="Organisation waitlist entries">
            <thead>
              <tr>
                <th scope="col" className={thClass}>Organisation</th>
                <th scope="col" className={thClass}>Contact</th>
                <th scope="col" className={thClass}>Type</th>
                <th scope="col" className={thClass}>Volume</th>
                <th scope="col" className={thClass}>Message</th>
                <th scope="col" className={thClass}>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {waitlist.map((entry) => (
                <tr key={entry.id}>
                  <td className={`${tdClass} font-semibold`}>{entry.orgName}</td>
                  <td className={tdClass}>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{entry.contactName}</span>
                      <span className="font-mono text-xs text-ink-muted">{entry.email}</span>
                    </div>
                  </td>
                  <td className={tdClass}>
                    <Tag tone="muted">{entry.orgType}</Tag>
                  </td>
                  <td className={`${tdClass} font-mono text-xs`}>{entry.volume ?? '—'}</td>
                  <td className={`${tdClass} max-w-80 text-xs text-ink-muted`}>{entry.message ?? '—'}</td>
                  <td className={`${tdClass} font-mono text-xs text-ink-muted`}>{formatDate(entry.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </ScrollTable>
        )}
      </TabPanel>
    </div>
  )
}
