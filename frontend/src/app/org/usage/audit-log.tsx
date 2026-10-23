'use client'

import { useState } from 'react'
import type { ApiKeyView, AuditEventView } from '@tracck/shared'
import { ErrorNotice } from '@/components/sources/dialogs'
import { Button } from '@/components/ui/button'
import { BareSelect } from '@/components/ui/field'
import { ScrollTable, thClass } from '@/components/ui/table'
import { api } from '@/lib/api/client'
import { formatStamp } from '@/lib/format'

const cell = 'whitespace-nowrap border-b border-line px-3 py-3 font-mono text-[13px]'

/** Spreadsheet programs run text that starts with these as a formula, so such cells are marked as text. */
function csvCell(value: string) {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return `"${safe.replace(/"/g, '""')}"`
}

/** The audit trail for one organisation, filterable by key, downloadable as CSV. */
export function AuditLog({ clientId, initial, keys }: { clientId: string; initial: AuditEventView[]; keys: ApiKeyView[] }) {
  const [rows, setRows] = useState(initial)
  const [key, setKey] = useState('all')
  const [error, setError] = useState<unknown>(null)

  async function choose(next: string) {
    setKey(next)
    try {
      setRows(await api.admin.audit(clientId, next === 'all' ? {} : { key: next }))
      setError(null)
    } catch (failure) {
      setError(failure)
    }
  }

  function download() {
    const lines = [['Time', 'Event', 'Key', 'By', 'Source address'], ...rows.map((r) => [formatStamp(r.at) + ' UTC', r.event, r.keyPrefix ?? '', r.by ?? '', r.ip ?? ''])]
    const blob = new Blob([lines.map((line) => line.map(csvCell).join(',')).join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'tracck-audit.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Audit log options">
        <BareSelect aria-label="Key" value={key} onChange={(event) => void choose(event.target.value)} className="w-56">
          <option value="all">All keys</option>
          {keys.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label} · {item.display}
            </option>
          ))}
        </BareSelect>
        <Button variant="secondary" onClick={download} className="min-h-10">
          Download CSV
        </Button>
      </div>

      {error !== null && <ErrorNotice error={error} />}

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
            {rows.map((row, index) => (
              <tr key={`${row.at}-${row.event}-${index}`}>
                <td className={cell}>{formatStamp(row.at)}</td>
                <td className={`${cell} ${row.alert ? 'text-danger-ink' : ''}`}>{row.event}</td>
                <td className={cell}>{row.keyPrefix ?? '—'}</td>
                <td className={cell}>{row.by ?? '—'}</td>
                <td className={cell}>{row.ip ?? '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-[15px] text-ink-muted">
                  No events yet.
                </td>
              </tr>
            )}
          </tbody>
        </ScrollTable>
      </section>
    </>
  )
}
