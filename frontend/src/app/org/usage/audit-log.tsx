'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { BareSelect } from '@/components/ui/field'
import { ScrollTable, thClass } from '@/components/ui/table'
import { AUDIT_LOG } from '@/lib/mock/org'

const cell = 'whitespace-nowrap border-b border-line px-3 py-3 font-mono text-[13px]'

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`
}

/** The audit trail, filterable by key, downloadable as CSV. */
export function AuditLog() {
  const [key, setKey] = useState('all')

  const rows = useMemo(() => {
    if (key === 'all') return AUDIT_LOG
    const prefix = key === 'production' ? 'trk_live' : 'trk_test'
    return AUDIT_LOG.filter((row) => row.key.startsWith(prefix))
  }, [key])

  function download() {
    const lines = [['Time', 'Event', 'Key', 'By', 'Source address'], ...rows.map((r) => [r.time, r.event, r.key, r.by, r.from])]
    const blob = new Blob([lines.map((line) => line.map(csvCell).join(',')).join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'tracck-audit-2026-10.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Audit log options">
        <BareSelect aria-label="Key" value={key} onChange={(event) => setKey(event.target.value)} className="w-40">
          <option value="all">All keys</option>
          <option value="production">Production</option>
          <option value="sandbox">Sandbox</option>
        </BareSelect>
        <Button variant="secondary" onClick={download} className="min-h-10">
          Download CSV
        </Button>
      </div>

      <section aria-label="Audit log" className="flex flex-col gap-3">
        <h2 className="t-claim m-0">Audit log</h2>
        <ScrollTable caption="Audit log" minWidth={820}>
          <thead>
            <tr>
              {['Time', 'Event', 'Key', 'By', 'Source address'].map((heading) => (
                <th key={heading} className={thClass}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.time}-${row.event}`}>
                <td className={cell}>{row.time}</td>
                <td className={`${cell} ${'alert' in row && row.alert ? 'text-danger-ink' : ''}`}>{row.event}</td>
                <td className={cell}>{row.key}</td>
                <td className={cell}>{row.by}</td>
                <td className={cell}>{row.from}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-[15px] text-ink-muted">
                  No events for this key.
                </td>
              </tr>
            )}
          </tbody>
        </ScrollTable>
      </section>
    </>
  )
}
