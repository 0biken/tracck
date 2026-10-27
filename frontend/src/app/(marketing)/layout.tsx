import type { ReactNode } from 'react'
import { MarketingFooter } from '@/components/marketing/footer'
import { MarketingHeader } from '@/components/marketing/header'
import { getViewer } from '@/lib/viewer'

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const viewer = await getViewer()
  return (
    <div className="min-h-dvh">
      <MarketingHeader viewer={viewer} />
      {children}
      <MarketingFooter />
    </div>
  )
}
