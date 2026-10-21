import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { isSupabaseConfigured } from '@/utils/supabase/config'
import { createApi, type Api } from './endpoints'
import { ApiClientError } from './errors'
import { fetchTransport } from './transport'

async function sessionToken(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const supabase = await createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

/**
 * The API for server components and server actions. It sends the signed-in
 * person's token from their cookies, never caches, and sends a person whose
 * session has ended back to sign in.
 */
export function serverApi(): Api {
  const transport = fetchTransport(sessionToken, { cache: 'no-store' })
  return createApi(async (method, path, options) => {
    try {
      return await transport(method, path, options)
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) redirect('/login')
      throw error
    }
  })
}

/** Like `serverApi`, but for pages that are public: a missing session is fine. */
export function publicApi(): Api {
  return createApi(fetchTransport(async () => null, { cache: 'no-store' }))
}
