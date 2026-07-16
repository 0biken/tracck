import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const platform = searchParams.get('platform');
  
  if (!platform) {
    return NextResponse.redirect(`${origin}/dashboard/accounts?error=Missing+platform`);
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.redirect(`${origin}/login?next=/dashboard/accounts`);
  }

  // Use Supabase signInWithOAuth to initiate the OAuth flow for the requested platform
  const { data, error } = await supabase.auth.signInWithOAuth({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    provider: platform as any,
    options: {
      redirectTo: `${origin}/api/auth/oauth/callback?platform=${platform}`,
    },
  });

  if (error) {
    // If the provider isn't enabled in Supabase yet, provide a seamless mock flow for development
    if (error.message.includes('provider is not enabled') && process.env.NODE_ENV === 'development') {
      return NextResponse.redirect(`${origin}/api/auth/oauth/callback?platform=${platform}&mock=true`);
    }
    return NextResponse.redirect(`${origin}/dashboard/accounts?error=${encodeURIComponent(error.message)}`);
  }

  if (data?.url) {
    return NextResponse.redirect(data.url);
  }

  return NextResponse.redirect(`${origin}/dashboard/accounts?error=Failed+to+start+OAuth`);
}
