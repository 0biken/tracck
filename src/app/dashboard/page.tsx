'use client'

import React from 'react';
import Link from 'next/link';

export default function OverviewPage() {
  // Mock data for initial rendering
  const stats = [
    { name: 'Connected Channels', value: '4 / 7', detail: 'GitHub, Figma, X, LinkedIn' },
    { name: 'Raw Submissions', value: '142', detail: 'Ingested platform posts' },
    { name: 'Pending Review', value: '12', detail: '8 pending, 4 low confidence' },
    { name: 'Ledger Bullets', value: '47', detail: 'Confirmed achievements' },
  ];

  const recentSyncs = [
    { id: '1', platform: 'github', event: 'Pulled repository commits', time: '2 hours ago', count: 14, status: 'synced' },
    { id: '2', platform: 'linkedin', event: 'Imported CSV profile data', time: 'Yesterday', count: 35, status: 'synced' },
    { id: '3', platform: 'twitter', event: 'Manual paste compilation', time: '3 days ago', count: 3, status: 'synced' },
  ];

  const pendingHighlights = [
    {
      id: 'h1',
      platform: 'GITHUB — 2026.03.11',
      claim: 'Shipped Next.js routing and supabase SSR integration',
      detail: '14 commits across auth, middleware, session handling for the Tracck platform.',
      confidence: 0.94,
    },
    {
      id: 'h2',
      platform: 'LINKEDIN — 2026.02.28',
      claim: 'Designed complete custom components library',
      detail: 'Created 32 components and design tokens matching the corporate brand strategy.',
      confidence: 0.88,
    },
  ];

  return (
    <div className="flex flex-col gap-12 animate-card-entry">
      {/* Welcome header section */}
      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase font-mono text-neutral">Dashboard / Overview</span>
        <h1 className="font-fraunces text-4xl font-bold text-ink">Your wins. Stated plainly.</h1>
        <p className="text-neutral text-sm max-w-xl">
          Tracck translates your public records and text snippets into verified resume bullets. Review suggestions below or ingest new data to get started.
        </p>
      </div>

      {/* Grid statistics metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-paper border border-hairline p-6 flex flex-col justify-between h-36">
            <span className="text-xs uppercase font-mono text-neutral">{stat.name}</span>
            <div className="flex flex-col gap-1">
              <span className="font-mono text-3xl font-bold text-ink">{stat.value}</span>
              <span className="text-xs text-neutral">{stat.detail}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Review Queue Alerts Panel */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="flex justify-between items-end border-b border-hairline pb-4">
            <h3 className="font-fraunces text-2xl font-bold text-ink">Needs Confirmation</h3>
            <Link href="/dashboard/queue" className="text-xs uppercase font-mono font-semibold text-ink underline hover:text-neutral">
              Open Queue
            </Link>
          </div>

          <div className="flex flex-col gap-4">
            {pendingHighlights.map((item) => (
              <div key={item.id} className="p-6 bg-paper-warm border border-hairline flex flex-col gap-3">
                <div className="flex justify-between items-center text-xs font-mono text-neutral">
                  <span>{item.platform}</span>
                  <span className="px-2 py-0.5 border border-hairline bg-paper text-neutral font-medium rounded-[2px]">
                    CONFIDENCE: {Math.round(item.confidence * 100)}%
                  </span>
                </div>
                <h4 className="font-fraunces text-xl font-bold text-ink">{item.claim}</h4>
                <p className="text-sm text-neutral">{item.detail}</p>
                <div className="flex gap-3 mt-2">
                  <Link href="/dashboard/queue" className="px-4 py-2 bg-ink text-paper hover:bg-[#2D2B26] text-xs font-semibold uppercase tracking-wider font-mono rounded-[4px]">
                    Confirm
                  </Link>
                  <Link href="/dashboard/queue" className="px-4 py-2 border border-hairline hover:border-ink text-xs font-semibold uppercase tracking-wider font-mono rounded-[4px] text-ink">
                    Edit
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sync logs history column */}
        <div className="flex flex-col gap-6">
          <div className="border-b border-hairline pb-4">
            <h3 className="font-fraunces text-2xl font-bold text-ink">Ingestion Logs</h3>
          </div>

          <div className="flex flex-col border border-hairline bg-paper-warm divide-y divide-hairline">
            {recentSyncs.map((sync) => (
              <div key={sync.id} className="p-5 flex flex-col gap-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="uppercase text-ink font-semibold">{sync.platform}</span>
                  <span className="text-neutral">{sync.time}</span>
                </div>
                <p className="text-sm text-ink">{sync.event}</p>
                <div className="flex items-center justify-between text-xs font-mono text-neutral mt-1">
                  <span>{sync.count} items recorded</span>
                  <span className="text-[#1F6F4A] flex items-center gap-1">
                    <span className="w-1.5 height-1.5 bg-[#1F6F4A] rounded-full inline-block"></span>
                    SYNCED
                  </span>
                </div>
              </div>
            ))}
          </div>

          <Link href="/dashboard/accounts" className="w-full py-3 border border-hairline hover:border-ink text-xs font-semibold uppercase tracking-wider font-mono text-center text-ink rounded-[4px]">
            Ingest New Content
          </Link>
        </div>
      </div>
    </div>
  );
}
