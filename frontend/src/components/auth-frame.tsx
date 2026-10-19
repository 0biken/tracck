import type { ReactNode } from 'react'
import { Logo } from '@/components/logo'

/** The centred single-column frame used by the small account pages. */
export function AuthFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col px-5 py-7 sm:px-10">
      <div className="self-start">
        <Logo />
      </div>
      <main className="flex flex-1 items-center justify-center py-12">
        <div className="flex w-full max-w-105 flex-col gap-4 border-t-2 border-ink pt-7">
          <h1 className="t-h2 m-0">{title}</h1>
          {children}
        </div>
      </main>
    </div>
  )
}
