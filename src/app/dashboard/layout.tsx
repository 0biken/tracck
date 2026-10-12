import type { ReactNode } from 'react'
import { signout } from '../auth/actions'
import { SidebarNav, TabBarNav } from '@/components/app-nav'
import { Button } from '@/components/ui/button'

function SignOut() {
  return (
    <form action={signout}>
      <Button type="submit" variant="ghost" size="sm">
        Sign out
      </Button>
    </form>
  )
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh lg:flex">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-60 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-r border-line bg-surface p-4 lg:flex">
        <p className="px-3 font-display text-h3 font-bold">Tracck</p>
        <SidebarNav />
        <div className="mt-auto">
          <SignOut />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-2 lg:hidden">
          <p className="font-display text-h3 font-bold">Tracck</p>
          <SignOut />
        </header>

        <main id="content" className="mx-auto w-full max-w-280 px-4 pb-24 pt-6 md:px-10 lg:pb-10 lg:pt-10">
          {children}
        </main>
      </div>

      <TabBarNav />
    </div>
  )
}
