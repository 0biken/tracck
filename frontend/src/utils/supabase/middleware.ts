import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isSupabaseConfigured } from './config'

/** Pages anyone can open without signing in. */
function isPublicPath(pathname: string) {
  return (
    pathname === '/' ||
    pathname.startsWith('/pricing') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/terms') ||
    pathname.startsWith('/privacy') ||
    pathname.startsWith('/data-deletion') ||
    pathname.startsWith('/waitlist') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/auth')
  )
}

function redirectToLogin(request: NextRequest) {
  const url = request.nextUrl.clone()
  const back = request.nextUrl.pathname + request.nextUrl.search
  url.pathname = '/login'
  url.search = ''
  // Come back to the page that was asked for once signed in.
  if (back !== '/') url.searchParams.set('next', back)
  return NextResponse.redirect(url)
}

export async function updateSession(request: NextRequest) {
  // Without Supabase credentials nobody can be signed in, so only public pages load.
  if (!isSupabaseConfigured()) {
    return isPublicPath(request.nextUrl.pathname) ? NextResponse.next({ request }) : redirectToLogin(request)
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    return redirectToLogin(request)
  }

  return supabaseResponse
}
