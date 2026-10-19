import type { ReactNode } from 'react'

/** Small mono line above a title: counts, dates, context. */
export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`t-eyebrow text-ink-muted ${className}`}>{children}</div>
}

/**
 * The title block at the top of every product screen: eyebrow, serif title,
 * optional lede, and actions on the right (wrapping under on narrow screens).
 */
export function PageHeader({
  eyebrow,
  title,
  children,
  actions,
}: {
  eyebrow?: ReactNode
  title: string
  children?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-5">
      <div className="flex min-w-0 flex-col gap-2">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className="t-h2 m-0 text-balance">{title}</h1>
        {children && <p className="m-0 max-w-160 text-base leading-6 text-ink-muted">{children}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

/** A section title with an optional link on the right. */
export function SectionHead({
  id,
  title,
  action,
}: {
  id?: string
  title: string
  action?: ReactNode
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <h2 id={id} className="t-claim m-0">
        {title}
      </h2>
      {action && <div className="text-sm font-semibold">{action}</div>}
    </div>
  )
}

/** A bold uppercase column title with a heavy rule under it (lists and tables). */
export function ColumnHead({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`t-colhead border-b-2 border-ink pb-2 ${className}`}>{children}</div>
}
