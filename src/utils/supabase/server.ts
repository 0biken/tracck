import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !key) {
    // Return mock server client
    return {
      auth: {
        getUser: async () => ({ data: { user: { id: 'mock-user-id', email: 'developer@tracck.io' } }, error: null }),
        getSession: async () => ({ data: { session: { user: { id: 'mock-user-id', email: 'developer@tracck.io' } } }, error: null }),
        signInWithPassword: async () => ({ data: { user: { id: 'mock-user-id', email: 'developer@tracck.io' } }, error: null }),
        signUp: async () => ({ data: { user: { id: 'mock-user-id', email: 'developer@tracck.io' } }, error: null }),
        signOut: async () => ({ error: null }),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any
  }

  const cookieStore = await cookies()

  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

