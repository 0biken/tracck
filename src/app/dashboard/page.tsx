import React from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

function timeAgo(dateInput: Date | string) {
  const date = new Date(dateInput);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return `${diffInMonths} month${diffInMonths > 1 ? 's' : ''} ago`;
  
  const diffInYears = Math.floor(diffInDays / 365);
  return `${diffInYears} year${diffInYears > 1 ? 's' : ''} ago`;
}

export default async function OverviewPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login');
  }

  // Fetch counts
  const { count: channelsCount } = await supabase
    .from('connected_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'active');

  const { count: rawPostsCount } = await supabase
    .from('raw_posts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  const { count: pendingCount } = await supabase
    .from('accomplishments')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .in('status', ['pending', 'low_confidence']);

  const { count: ledgerCount } = await supabase
    .from('resume_bullets')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  const stats = [
    { name: 'Connected Channels', value: `${channelsCount ?? 0}`, detail: 'Active social connections' },
    { name: 'Raw Submissions', value: `${rawPostsCount ?? 0}`, detail: 'Ingested platform posts' },
    { name: 'Pending Review', value: `${pendingCount ?? 0}`, detail: 'Claims needing confirmation' },
    { name: 'Ledger Bullets', value: `${ledgerCount ?? 0}`, detail: 'Confirmed achievements' },
  ];

  // Fetch recent pending highlights
  const { data: accomplishmentsData } = await supabase
    .from('accomplishments')
    .select(`
      id,
      bullet_text,
      extracted_text,
      confidence_score,
      status,
      raw_posts ( platform, posted_at )
    `)
    .eq('user_id', user.id)
    .in('status', ['pending', 'low_confidence'])
    .order('detected_at', { ascending: false })
    .limit(2);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingHighlights = (accomplishmentsData || []).map((item: any) => {
    // raw_posts is an object or array depending on relation type, usually single object for this join
    const rawPost = Array.isArray(item.raw_posts) ? item.raw_posts[0] : item.raw_posts;
    const platformStr = rawPost ? `${rawPost.platform.toUpperCase()} — ${new Date(rawPost.posted_at).toLocaleDateString().replace(/\//g, '.')}` : 'UNKNOWN';
    return {
      id: item.id,
      platform: platformStr,
      claim: item.bullet_text,
      detail: item.extracted_text,
      confidence: item.confidence_score,
      status: item.status,
    };
  });

  // Fetch recent ingestion logs
  const { data: recentRawPosts } = await supabase
    .from('raw_posts')
    .select('id, platform, source_method, fetched_at')
    .eq('user_id', user.id)
    .order('fetched_at', { ascending: false })
    .limit(150);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const syncsMap = new Map<string, any>();
  if (recentRawPosts) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recentRawPosts.forEach((post: any) => {
      const date = new Date(post.fetched_at);
      const timeKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()} ${date.getHours()}:${date.getMinutes()}`;
      const key = `${post.platform}-${post.source_method}-${timeKey}`;
      
      if (!syncsMap.has(key)) {
        let eventName = 'Manual paste ingestion';
        if (post.source_method === 'oauth') eventName = 'OAuth automatic sync';
        else if (post.source_method === 'file_upload') eventName = 'Imported data archive';

        syncsMap.set(key, {
          id: key,
          platform: post.platform,
          event: eventName,
          fetchedAtDate: date,
          time: timeAgo(date),
          count: 0,
          status: 'synced'
        });
      }
      syncsMap.get(key).count += 1;
    });
  }

  const recentSyncs = Array.from(syncsMap.values()).slice(0, 5);

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
            {pendingHighlights.length === 0 ? (
              <div className="p-6 border border-hairline bg-paper-warm text-center text-neutral text-sm">
                No pending highlights right now. You're all caught up!
              </div>
            ) : (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              pendingHighlights.map((item: any) => (
                <div key={item.id} className="p-6 bg-paper-warm border border-hairline flex flex-col gap-3">
                  <div className="flex justify-between items-center text-xs font-mono text-neutral">
                    <span>{item.platform}</span>
                    <div className="flex gap-2">
                      {item.status === 'low_confidence' && (
                        <span className="px-2 py-0.5 border border-clay text-clay bg-clay/5 font-semibold text-[10px] rounded-[2px] uppercase">
                          Low Confidence
                        </span>
                      )}
                      <span className="px-2 py-0.5 border border-hairline bg-paper text-neutral font-medium rounded-[2px]">
                        CONFIDENCE: {Math.round(item.confidence * 100)}%
                      </span>
                    </div>
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
              ))
            )}
          </div>
        </div>

        {/* Sync logs history column */}
        <div className="flex flex-col gap-6">
          <div className="border-b border-hairline pb-4">
            <h3 className="font-fraunces text-2xl font-bold text-ink">Ingestion Logs</h3>
          </div>

          <div className="flex flex-col border border-hairline bg-paper-warm divide-y divide-hairline">
            {recentSyncs.length === 0 ? (
              <div className="p-5 text-center text-neutral text-sm">
                No recent ingestion events.
              </div>
            ) : (
              recentSyncs.map((sync) => (
                <div key={sync.id} className="p-5 flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="uppercase text-ink font-semibold">{sync.platform}</span>
                    <span className="text-neutral">{sync.time}</span>
                  </div>
                  <p className="text-sm text-ink">{sync.event}</p>
                  <div className="flex items-center justify-between text-xs font-mono text-neutral mt-1">
                    <span>{sync.count} items recorded</span>
                    <span className="text-[#1F6F4A] flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-[#1F6F4A] rounded-full inline-block"></span>
                      SYNCED
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          <Link href="/dashboard/accounts" className="w-full py-3 border border-hairline hover:border-ink text-xs font-semibold uppercase tracking-wider font-mono text-center text-ink rounded-[4px]">
            Ingest New Content
          </Link>
        </div>
      </div>
    </div>
  );
}
