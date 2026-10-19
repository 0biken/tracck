import type { ReactNode } from 'react'

export const thClass =
  'whitespace-nowrap border-b-2 border-ink px-3 py-2.5 text-left text-xs font-bold uppercase tracking-[0.08em]'
export const tdClass = 'border-b border-line px-3 py-3.5 align-middle text-[15px]'

/**
 * Wide data tables scroll sideways inside their own box rather than squeezing
 * columns on narrow screens. `minWidth` is the width below which they scroll.
 */
export function ScrollTable({
  children,
  minWidth,
  caption,
}: {
  children: ReactNode
  minWidth: number
  caption: string
}) {
  return (
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={caption}>
      <table className="w-full border-collapse" style={{ minWidth }}>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  )
}
