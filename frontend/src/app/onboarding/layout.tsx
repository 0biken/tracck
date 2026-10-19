import type { ReactNode } from 'react'
import { Logo } from '@/components/logo'
import { SetupSteps } from '@/components/onboarding/setup-steps'

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4 sm:px-8">
          <Logo href={null} />
          <SetupSteps />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col gap-9 px-5 py-12 sm:px-8 sm:py-16">
        {children}
      </main>
    </div>
  )
}
