'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { signout } from '@/app/auth/actions'
import { buttonClass } from '@/components/ui/button'
import type { Viewer } from '@/lib/viewer'

/** For a signed-in visitor: a way into the dashboard, and a menu with the account and sign out. */
export function AccountMenu({ viewer }: { viewer: Viewer }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={root} className="relative flex items-center gap-2">
      <Link href="/dashboard" className={buttonClass('primary', 'md')}>
        Dashboard
      </Link>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="grid min-h-11 min-w-11 cursor-pointer place-items-center border border-line bg-canvas text-sm font-bold hover:border-ink"
      >
        <span aria-hidden="true">{viewer.initials}</span>
        <span className="sr-only">Account menu</span>
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-64 border border-line bg-canvas p-4">
          <p className="m-0 truncate text-sm font-semibold">{viewer.name}</p>
          <p className="m-0 truncate font-mono text-[11px] text-ink-muted">{viewer.email}</p>
          <form action={signout} className="mt-3 border-t border-line pt-3">
            <button
              role="menuitem"
              type="submit"
              className="min-h-9 w-full cursor-pointer border-0 bg-transparent p-0 text-left text-sm font-semibold hover:text-signal"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
