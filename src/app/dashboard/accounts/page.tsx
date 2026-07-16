import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import AccountsClient from './AccountsClient';

export default async function AccountsPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login');
  }

  // Fetch connected accounts
  const { data: connectedAccounts } = await supabase
    .from('connected_accounts')
    .select('id, platform, username, status')
    .eq('user_id', user.id);

  // Fetch recent raw posts to build the history of URL fetches
  const { data: rawPosts } = await supabase
    .from('raw_posts')
    .select('platform, fetched_at, source_method')
    .eq('user_id', user.id)
    .order('fetched_at', { ascending: false });

  // Compute fetch history
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const historyMap = new Map<string, any>();
  if (rawPosts) {
    for (const post of rawPosts) {
      if (!historyMap.has(post.platform)) {
        historyMap.set(post.platform, {
          platform: post.platform,
          lastFetchedAt: post.fetched_at,
          lastFetchedTitle: 'Extracted Content',
        });
      }
    }
  }
  const fetchHistory = Array.from(historyMap.values());

  return <AccountsClient initialAccounts={connectedAccounts || []} fetchHistory={fetchHistory} />;
}
