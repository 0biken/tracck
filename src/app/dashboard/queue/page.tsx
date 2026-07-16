import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import QueueClient from './QueueClient';

export default async function QueuePage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login');
  }

  // Fetch accomplishments with their associated raw post platform and date
  const { data: accomplishmentsData } = await supabase
    .from('accomplishments')
    .select(`
      id,
      bullet_text,
      extracted_text,
      confidence_score,
      status,
      claim_category,
      raw_posts!inner ( platform, posted_at )
    `)
    .eq('user_id', user.id)
    .in('status', ['pending', 'low_confidence', 'confirmed'])
    .order('detected_at', { ascending: false });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const initialItems = (accomplishmentsData || []).map((item: any) => {
    const rawPost = Array.isArray(item.raw_posts) ? item.raw_posts[0] : item.raw_posts;
    const platformStr = rawPost ? rawPost.platform.toUpperCase() : 'UNKNOWN';
    const dateStr = rawPost ? new Date(rawPost.posted_at).toLocaleDateString().replace(/\//g, '.') : '';
    
    return {
      id: item.id,
      platform: platformStr,
      date: dateStr,
      claim: item.bullet_text,
      detail: item.extracted_text,
      confidence: item.confidence_score,
      status: item.status,
      category: item.claim_category || 'direct_achievement',
    };
  });

  return <QueueClient initialItems={initialItems} />;
}
