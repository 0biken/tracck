import Link from 'next/link'

/** Three ledger lines; the short one is the entry you just added. */
export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="4" width="18" height="3" fill="currentColor" />
      <rect x="3" y="10.5" width="18" height="3" fill="currentColor" />
      <rect x="3" y="17" width="12" height="3" style={{ fill: 'var(--logo-accent, var(--signal))' }} />
    </svg>
  )
}

/** Mark plus wordmark. Pass `href` to make it a link; `onInverse` for dark panels. */
export function Logo({
  href = '/',
  size = 'md',
  onInverse = false,
  badge,
}: {
  href?: string | null
  size?: 'sm' | 'md'
  onInverse?: boolean
  badge?: string
}) {
  const content = (
    <span
      className="flex items-center gap-2.5"
      style={onInverse ? ({ '--logo-accent': 'var(--signal-on-inverse)' } as React.CSSProperties) : undefined}
    >
      <LogoMark size={size === 'sm' ? 22 : 24} />
      <span
        className="font-display font-black tracking-[-0.03em]"
        style={{ fontSize: size === 'sm' ? 22 : 24 }}
      >
        Tracck
      </span>
      {badge && (
        <span className="rounded-sm border border-line-input px-1.5 py-0.5 font-mono text-[11px] tracking-[0.12em] text-ink-muted">
          {badge}
        </span>
      )}
    </span>
  )

  if (href === null) return content
  return (
    <Link href={href} className="inline-flex text-inherit no-underline" aria-label="Tracck home">
      {content}
    </Link>
  )
}
