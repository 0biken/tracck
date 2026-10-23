import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { AppShell } from '@/components/app-shell/app-shell'
import { serverApi } from '@/lib/api/server'
import { viewerFromMe } from '@/lib/viewer'

export default async function ShellLayout({ children }: { children: ReactNode }) {
  const api = serverApi()
  const [me, summary] = await Promise.all([api.me.get(), api.me.summary()])

  // A new account finishes setup (role, sources, agreement) before the product opens.
  if (!me.onboardingCompleted) redirect('/onboarding/role')

  const planName = me.plan === 'pro' ? (me.priceTier === 'student' ? 'Student Plus' : 'Pro') : 'Free'

  return (
    <AppShell
      viewer={viewerFromMe(me)}
      counts={{ resumes: summary.resumes, evidence: summary.entries, sources: summary.sourcesTotal }}
      plan={{
        name: planName,
        used: summary.resumesThisMonth,
        limit: summary.resumesLimit,
        resetsOn: summary.periodResetsOn,
      }}
    >
      {children}
    </AppShell>
  )
}
