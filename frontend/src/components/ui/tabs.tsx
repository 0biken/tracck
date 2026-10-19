'use client'

import type { KeyboardEvent, ReactNode } from 'react'

export type TabItem<T extends string> = { value: T; label: string }

/**
 * Tabs with a heavy underline, for switching panels in place. Pair with
 * `TabPanel` using the same `idBase` so each tab names its panel.
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  idBase,
  className = '',
}: {
  items: TabItem<T>[]
  value: T
  onChange: (value: T) => void
  label: string
  idBase: string
  className?: string
}) {
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    event.preventDefault()
    const nextIndex = (index + step + items.length) % items.length
    onChange(items[nextIndex].value)
    const list = event.currentTarget.parentElement
    requestAnimationFrame(() => list?.querySelectorAll<HTMLButtonElement>('[role=tab]')[nextIndex]?.focus())
  }

  return (
    <div role="tablist" aria-label={label} className={`flex gap-1 border-b-2 border-ink px-4 sm:px-6 ${className}`}>
      {items.map((item, index) => {
        const selected = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            id={`${idBase}-tab-${item.value}`}
            aria-selected={selected}
            aria-controls={`${idBase}-panel-${item.value}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`-mb-0.5 min-h-12 cursor-pointer border-0 border-b-4 bg-transparent px-3.5 text-sm font-semibold tracking-[0.02em] ${
              selected ? 'border-ink text-ink' : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

export function TabPanel({
  idBase,
  value,
  active,
  children,
}: {
  idBase: string
  value: string
  active: boolean
  children: ReactNode
}) {
  return (
    <div
      role="tabpanel"
      id={`${idBase}-panel-${value}`}
      aria-labelledby={`${idBase}-tab-${value}`}
      hidden={!active}
      tabIndex={0}
    >
      {active ? children : null}
    </div>
  )
}
