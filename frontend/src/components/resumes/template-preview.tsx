'use client'

import Image from 'next/image'
import { X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { TemplateView } from '@tracck/shared'
import { apiBase } from '@/lib/api/transport'

const FADE_MS = 180

/**
 * The template's preview image, enlarged over the page. It fades and scales in, and closes with the
 * X at the top right, the Escape key, or a click outside the image.
 */
export function TemplatePreview({ template, onClose }: { template: TemplateView; onClose: () => void }) {
  const [shown, setShown] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  // Once mounted, the next frame switches the overlay to its shown state, so the transition runs.
  const onMount = (element: HTMLDivElement | null) => {
    if (element) requestAnimationFrame(() => setShown(true))
  }

  const close = useCallback(() => {
    setShown(false)
    timer.current = window.setTimeout(onClose, FADE_MS)
  }, [onClose])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.clearTimeout(timer.current)
    }
  }, [close])

  return (
    <div
      ref={onMount}
      role="dialog"
      aria-modal="true"
      aria-label={`${template.name} template preview`}
      onClick={close}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 transition-opacity duration-200 ease-out ${shown ? 'opacity-100' : 'opacity-0'}`}
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          close()
        }}
        aria-label="Close preview"
        className="absolute right-4 top-4 grid size-11 place-items-center rounded-full bg-canvas text-ink hover:bg-sunken"
      >
        <X className="size-5" strokeWidth={2} aria-hidden="true" />
      </button>
      <div
        onClick={(event) => event.stopPropagation()}
        className={`transition-transform duration-200 ease-out ${shown ? 'scale-100' : 'scale-95'}`}
      >
        <Image
          src={`${apiBase()}${template.previewUrl}`}
          alt={`${template.name} template`}
          width={900}
          height={1170}
          unoptimized
          className="max-h-[88vh] w-auto max-w-[92vw] bg-canvas object-contain"
        />
      </div>
    </div>
  )
}
