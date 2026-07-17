import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const platform = searchParams.get('platform');
  const next = searchParams.get('next') ?? '/dashboard/accounts';
  
  const mock = searchParams.get('mock');
  
  if (!platform) {
    return NextResponse.redirect(`${origin}${next}?error=Missing+platform`);
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.redirect(`${origin}/login?next=${next}`);
  }

  // Handle mock development flow if provider isn't enabled in Supabase
  if (mock === 'true' && process.env.NODE_ENV === 'development') {
    const { error: insertError } = await supabase
      .from('connected_accounts')
      .upsert({
        user_id: user.id,
        platform: platform,
        username: `mock_${platform}_user`,
        access_token: 'mock_dev_token',
        status: 'active'
      }, {
        onConflict: 'user_id, platform'
      });

    if (insertError) {
      return NextResponse.redirect(`${origin}${next}?error=${encodeURIComponent(insertError.message)}`);
    }
    return NextResponse.redirect(`${origin}${next}`);
  }

  if (code) {
    
    // Exchange the code for a session
    const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
    
    if (sessionError) {
      return NextResponse.redirect(`${origin}${next}?error=${encodeURIComponent(sessionError.message)}`);
    }

    const session = sessionData.session;
    const user = sessionData.user;

    if (session && user) {
      const providerToken = session.provider_token;
      const providerRefreshToken = session.provider_refresh_token;

      // Try to extract a useful username from the identity
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const identity = user.identities?.find((id: any) => id.provider === platform);
      const username = identity?.identity_data?.preferred_username || 
                       identity?.identity_data?.user_name || 
                       identity?.identity_data?.name ||
                       identity?.identity_data?.email || 
                       user.email || 
                       'unknown';

      // Insert or update the connected account
      const { error: insertError } = await supabase
        .from('connected_accounts')
        .upsert({
          user_id: user.id,
          platform: platform,
          username: username,
          access_token: providerToken || 'mock_token',
          refresh_token: providerRefreshToken || null,
          status: 'active'
        }, {
          onConflict: 'user_id, platform'
        });

      if (insertError) {
        return NextResponse.redirect(`${origin}${next}?error=${encodeURIComponent(insertError.message)}`);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}${next}?error=Invalid+OAuth+callback`);
}
