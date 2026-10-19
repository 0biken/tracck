import type { ReactNode } from 'react'
import { MarketingFooter } from '@/components/marketing/footer'
import { MarketingHeader } from '@/components/marketing/header'

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <MarketingHeader />
      {children}
      <MarketingFooter />
    </div>
  )
}
