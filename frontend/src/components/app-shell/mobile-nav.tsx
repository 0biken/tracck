'use client'

import { Menu, X } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Below 1024px the side menu lives in a drawer opened from the top bar. The
 * drawer is the same menu content the desktop sidebar shows, passed in as
 * children, and it closes itself when you navigate.
 */
export function MobileNav({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  // The drawer is open for the page it was opened on. Navigating changes the
  // path, which closes it without any effect.
  const [openPath, setOpenPath] = useState<string | null>(null)
  const open = openPath === pathname
  const setOpen = (next: boolean) => setOpenPath(next ? pathname : null)
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])


  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="grid size-11 cursor-pointer place-items-center rounded-md border border-line-input bg-transparent text-ink hover:bg-sunken"
      >
        <Menu className="size-5" strokeWidth={1.75} aria-hidden="true" />
      </button>

      <dialog
        ref={ref}
        aria-label="Menu"
        onClose={() => setOpen(false)}
        onClick={(event) => {
          // A click on the backdrop lands on the dialog element itself.
          if (event.target === ref.current) setOpen(false)
        }}
        className="m-0 mr-auto h-dvh max-h-none w-[19rem] max-w-[88vw] border-0 border-r border-line bg-sunken p-0 text-ink backdrop:bg-scrim"
      >
        <div className="relative flex h-full flex-col overflow-y-auto">
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="absolute right-2 top-2 z-10 grid size-11 cursor-pointer place-items-center rounded-md border-0 bg-transparent hover:opacity-70"
          >
            <X className="size-5" strokeWidth={1.75} aria-hidden="true" />
          </button>
          {open && children}
        </div>
      </dialog>
    </>
  )
}
