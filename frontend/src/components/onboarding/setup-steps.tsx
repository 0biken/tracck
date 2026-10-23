'use client'

import { usePathname } from 'next/navigation'

const steps = [
  { href: '/onboarding/role', label: '01 ROLE' },
  { href: '/onboarding/details', label: '02 DETAILS' },
  { href: '/onboarding/sources', label: '03 SOURCES' },
  { href: '/onboarding/status', label: '04 STATUS' },
]

export function SetupSteps() {
  const pathname = usePathname()
  return (
    <ol aria-label="Setup steps" className="m-0 flex list-none gap-4 p-0 font-mono text-xs tracking-[0.12em] sm:gap-6">
      {steps.map((step) => {
        const current = pathname.startsWith(step.href)
        return (
          <li
            key={step.href}
            aria-current={current ? 'step' : undefined}
            className={`pb-1 ${current ? 'border-b-2 border-ink' : 'text-ink-muted'}`}
          >
            {step.label}
          </li>
        )
      })}
    </ol>
  )
}
