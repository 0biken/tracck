'use client'

import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

/**
 * A modal built on the native <dialog>: focus is trapped, Escape closes it, and
 * focus returns to what opened it. `tone="inverse"` is the dark one used when a
 * secret is shown once.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  tone = 'default',
  closable = true,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  tone?: 'default' | 'inverse'
  /** False when the user has to make a choice before leaving. */
  closable?: boolean
  size?: 'md' | 'lg'
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const surface =
    tone === 'inverse'
      ? 'border-inverse-line bg-inverse text-on-inverse'
      : 'border-line-strong bg-canvas text-ink'

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onCancel={(event) => {
        if (!closable) event.preventDefault()
      }}
      className={`m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto border p-0 backdrop:bg-scrim ${
        size === 'lg' ? 'max-w-[640px]' : 'max-w-[520px]'
      } ${surface}`}
    >
      {open && (
        <div className="relative p-6 sm:p-8">
          {closable && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-2 top-2 grid size-11 cursor-pointer place-items-center rounded-md border-0 bg-transparent hover:opacity-70"
            >
              <X className="size-5" strokeWidth={1.75} aria-hidden="true" />
            </button>
          )}
          {children}
        </div>
      )}
    </dialog>
  )
}
