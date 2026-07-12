'use client'

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [userEmail, setUserEmail] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email ?? null);
      }
    }
    getUser();
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const navItems = [
    {
      name: 'Overview',
      path: '/dashboard',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="square">
          <line x1="4" y1="20" x2="20" y2="20" />
          <line x1="7" y1="20" x2="7" y2="12" />
          <line x1="12" y1="20" x2="12" y2="7" />
          <line x1="17" y1="20" x2="17" y2="3" />
        </svg>
      ),
    },
    {
      name: 'Accounts & Ingestion',
      path: '/dashboard/accounts',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="square">
          <rect x="3" y="3" width="18" height="18" rx="0" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      ),
    },
    {
      name: 'Ledger Queue',
      path: '/dashboard/queue',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="square">
          <polyline points="9 11 12 14 22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      ),
    },
    {
      name: 'Resume Tailoring',
      path: '/dashboard/tailoring',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="square">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex min-h-screen bg-paper text-ink font-archivo">
      {/* Sidebar navigation */}
      <aside className="w-80 bg-paper-warm border-r border-hairline flex flex-col justify-between shrink-0">
        <div className="flex flex-col">
          {/* Logo brand signature */}
          <div className="p-8 border-b border-hairline flex items-center gap-3">
            {/* Minimal Brand Mark: 3 ascending entries on single baseline */}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-ink shrink-0">
              {/* Baseline */}
              <line x1="3" y1="20" x2="21" y2="20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" />
              {/* Entry 1 */}
              <line x1="7" y1="20" x2="7" y2="13" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" />
              {/* Entry 2 */}
              <line x1="12" y1="20" x2="12" y2="8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" />
              {/* Entry 3 - Highlighted Accent final bar */}
              <line x1="17" y1="20" x2="17" y2="3" stroke="#1F6F4A" strokeWidth="2.5" strokeLinecap="square" />
            </svg>
            <span className="font-fraunces font-bold text-2xl tracking-tight">Tracck</span>
          </div>

          <nav className="p-4 flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex items-center gap-4 px-4 py-3 border-r-2 transition-all duration-150 ${
                    isActive
                      ? 'bg-paper border-ink font-semibold text-ink'
                      : 'border-transparent text-neutral hover:bg-paper/50 hover:text-ink'
                  }`}
                >
                  <span className="shrink-0">{item.icon}</span>
                  <span className="text-sm uppercase tracking-wider font-mono">{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Footer Profile */}
        <div className="p-6 border-t border-hairline flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase font-mono text-neutral">Logged In As</span>
            <span className="text-sm font-semibold truncate text-ink">{userEmail ?? 'Loading...'}</span>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full py-2.5 border border-hairline hover:border-ink rounded-[4px] text-xs font-semibold uppercase tracking-wider font-mono text-ink bg-transparent transition-colors cursor-pointer text-center"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content frame */}
      <main className="flex-1 min-w-0 flex flex-col overflow-y-auto">
        <header className="h-20 border-b border-hairline flex items-center justify-between px-12 bg-paper shrink-0">
          <div className="flex flex-col">
            <span className="text-xs uppercase font-mono text-neutral">System Location</span>
            <h2 className="text-sm font-semibold tracking-wide font-mono uppercase text-ink">
              {pathname === '/dashboard' ? 'Overview' : pathname.replace('/dashboard/', '').replace('/', ' / ')}
            </h2>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono text-neutral">
            <span>VERSION 1.0</span>
            <span>•</span>
            <span>SYSTEM READY</span>
          </div>
        </header>

        <div className="p-12 max-w-7xl w-full mx-auto flex-1 flex flex-col">
          {children}
        </div>
      </main>
    </div>
  );
}
