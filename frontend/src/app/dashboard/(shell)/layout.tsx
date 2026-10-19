import type { ReactNode } from 'react'
import { AppShell } from '@/components/app-shell/app-shell'
import { getViewer } from '@/lib/viewer'

export default async function ShellLayout({ children }: { children: ReactNode }) {
  const viewer = await getViewer()
  return <AppShell viewer={viewer}>{children}</AppShell>
}
