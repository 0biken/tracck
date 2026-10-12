'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { isSupabaseConfigured } from '@/utils/supabase/config'
import { toAuthErrorCode, type AuthErrorCode } from '@/lib/auth-errors'

function fail(page: '/login' | '/signup', code: AuthErrorCode): never {
  redirect(`${page}?error=${code}`)
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
  redirect('/dashboard')
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
