import type { MeView } from '@tracck/shared'
import { isSupabaseConfigured } from '@/utils/supabase/config'
import { createClient } from '@/utils/supabase/server'

export type Viewer = { name: string; email: string; initials: string }

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? '?').slice(0, 2)
  return letters.toUpperCase()
}

/** The signed-in person as the side menu shows them, from their profile. */
export function viewerFromMe(me: Pick<MeView, 'name' | 'email'>): Viewer {
  const email = me.email ?? ''
  const name = me.name || email.split('@')[0] || 'You'
  return { name, email, initials: initialsOf(name) }
}

/** The signed-in person from their Supabase session, or null when nobody is signed in. */
export async function getViewer(): Promise<Viewer | null> {
  if (!isSupabaseConfigured()) return null
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return viewerFromMe({
    name: (user.user_metadata?.full_name as string | undefined) ?? null,
    email: user.email ?? null,
  })
}
