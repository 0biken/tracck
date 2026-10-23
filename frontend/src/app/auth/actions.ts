'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { isSupabaseConfigured } from '@/utils/supabase/config'
import { toAuthErrorCode, type AuthErrorCode } from '@/lib/auth-errors'

type AuthPage = '/login' | '/signup' | '/forgot-password' | '/reset-password'

function fail(page: AuthPage, code: AuthErrorCode): never {
  redirect(`${page}?error=${code}`)
}

/** Only same-site paths: never an absolute URL, never `//host`. */
function safeNext(value: FormDataEntryValue | null, fallback: string) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : fallback
}

/** The public address of this site, for links that Supabase emails or redirects to. */
async function siteOrigin() {
  const requestHeaders = await headers()
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host')
  const protocol = requestHeaders.get('x-forwarded-proto') ?? (host?.startsWith('localhost') ? 'http' : 'https')
  return `${protocol}://${host}`
}

export async function login(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) fail('/login', 'missing_fields')
  if (!isSupabaseConfigured()) fail('/login', 'not_configured')

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) fail('/login', toAuthErrorCode(error.code))

  revalidatePath('/', 'layout')
  redirect(safeNext(formData.get('next'), '/dashboard'))
}

export async function signup(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const name = formData.get('name') as string

  if (!email || !password || !name) fail('/signup', 'missing_fields')
  if (!isSupabaseConfigured()) fail('/signup', 'not_configured')

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // The profiles trigger reads `full_name`.
      data: {
        full_name: name,
      }
    }
  })

  if (error) fail('/signup', toAuthErrorCode(error.code))

  // No session means the project requires email confirmation before sign-in.
  if (!data.session) redirect('/signup?sent=1')

  revalidatePath('/', 'layout')
  // A new account starts by choosing a role.
  redirect('/onboarding/role')
}

/**
 * Starts Google sign-in. Needs the Google provider enabled in the Supabase
 * project and `<site>/auth/callback` in its redirect URLs.
 */
export async function signInWithGoogle(formData: FormData) {
  const page = formData.get('page') === 'signup' ? '/signup' : '/login'
  if (!isSupabaseConfigured()) fail(page, 'not_configured')

  const next = safeNext(formData.get('next'), '/dashboard')

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${await siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}` },
  })

  if (error || !data.url) fail(page, 'unknown')
  redirect(data.url)
}

/**
 * Emails a reset link. The answer is the same whether or not the address has an
 * account, so this page cannot be used to find out who is registered.
 */
export async function requestPasswordReset(formData: FormData) {
  const email = (formData.get('email') as string | null)?.trim()

  if (!email) fail('/forgot-password', 'missing_fields')
  if (!isSupabaseConfigured()) fail('/forgot-password', 'not_configured')

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteOrigin()}/auth/callback?next=${encodeURIComponent('/reset-password')}`,
  })

  // Only a rate limit is worth telling the person; anything else looks like success.
  if (error?.code === 'over_email_send_rate_limit' || error?.code === 'over_request_rate_limit') {
    fail('/forgot-password', 'rate_limited')
  }

  redirect('/forgot-password?sent=1')
}

/** Sets the new password for the person who followed the emailed link. */
export async function updatePassword(formData: FormData) {
  const password = formData.get('password') as string
  const confirm = formData.get('confirm') as string

  if (!password || !confirm) fail('/reset-password', 'missing_fields')
  if (password !== confirm) fail('/reset-password', 'password_mismatch')
  if (!isSupabaseConfigured()) fail('/reset-password', 'not_configured')

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) fail('/reset-password', toAuthErrorCode(error.code))

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signout() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient()
    await supabase.auth.signOut()
  }

  revalidatePath('/', 'layout')
  redirect('/login')
}
