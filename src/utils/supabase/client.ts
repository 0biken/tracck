import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !key) {
    // Return a mock client to allow viewing dashboard without Supabase configured
    return {
      auth: {
        getUser: async () => ({ data: { user: { id: 'mock-user-id', email: 'developer@tracck.io' } }, error: null }),
        getSession: async () => ({ data: { session: { user: { id: 'mock-user-id', email: 'developer@tracck.io' } } }, error: null }),
        signInWithPassword: async () => ({ data: { user: { id: 'mock-user-id', email: 'developer@tracck.io' } }, error: null }),
        signUp: async () => ({ data: { user: { id: 'mock-user-id', email: 'developer@tracck.io' } }, error: null }),
        signOut: async () => ({ error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any
  }

  return createBrowserClient(url, key)
}

