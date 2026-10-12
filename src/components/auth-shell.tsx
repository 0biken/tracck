import type { ReactNode } from 'react'

/** Shared frame for the sign-in and create-account pages. */
export function AuthShell({
  title,
  lede,
  children,
  footer,
}: {
  title: string
  lede: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-110 flex-col justify-center px-4 py-10">
      <p className="font-display text-h3 font-bold">Tracck</p>
      <div className="mt-4 rounded-lg border border-line bg-surface p-6">
        <h1 className="font-display text-h1 font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-ink-muted">{lede}</p>
        <div className="mt-6 flex flex-col gap-4">{children}</div>
      </div>
      {footer && <p className="mt-4 text-ink-muted">{footer}</p>}
    </main>
  )
}
