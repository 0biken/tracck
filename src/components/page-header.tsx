import type { ReactNode } from 'react'

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="font-display text-h1 font-semibold tracking-tight md:text-h1-wide">{title}</h1>
      {children && <p className="mt-2 max-w-[62ch] text-ink-muted">{children}</p>}
    </div>
  )
}
