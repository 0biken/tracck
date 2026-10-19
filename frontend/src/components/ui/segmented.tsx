'use client'

import type { KeyboardEvent } from 'react'

export type SegmentOption<T extends string> = { value: T; label: string }

/**
 * Two to four mutually exclusive choices, shown side by side (design system,
 * "Segmented control"). Arrow keys move the selection; Tab leaves the group.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'md',
  className = '',
}: {
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  label: string
  size?: 'sm' | 'md'
  className?: string
}) {
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0
    if (!step) return
    event.preventDefault()
    const nextIndex = (index + step + options.length) % options.length
    onChange(options[nextIndex].value)
    const group = event.currentTarget.parentElement
    requestAnimationFrame(() => group?.querySelectorAll<HTMLButtonElement>('[role=radio]')[nextIndex]?.focus())
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`inline-flex overflow-hidden rounded-md border border-line-input ${className}`}
    >
      {options.map((option, index) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`cursor-pointer border-0 font-semibold tracking-[0.02em] focus-visible:outline-offset-[-2px] ${
              size === 'sm' ? 'min-h-10 px-3.5 text-[13px]' : 'min-h-11 px-5 text-sm'
            } ${selected ? 'bg-ink text-canvas' : 'bg-transparent text-ink hover:bg-sunken'}`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
