import type { ReactNode } from 'react'

export type Stat = { label: string; value: ReactNode; note?: ReactNode }

/**
 * A row of big mono numbers separated by 1px rules. The rules are the grid gap
 * showing the border colour through, so they stay correct however it wraps.
 */
export function StatGrid({ stats, label }: { stats: Stat[]; label: string }) {
  return (
    <dl
      aria-label={label}
      className="m-0 grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-px border border-line bg-line"
    >
      {stats.map((stat) => (
        <div key={stat.label} className="flex flex-col gap-1.5 bg-canvas p-5">
          <dt className="t-eyebrow text-ink-muted">{stat.label}</dt>
          <dd className="m-0 font-mono text-[32px] leading-[38px]">{stat.value}</dd>
          {stat.note && <dd className="m-0 text-[13px] text-ink-muted">{stat.note}</dd>}
        </div>
      ))}
    </dl>
  )
}
