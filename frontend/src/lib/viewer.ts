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

/** The signed-in person from their Supabase session, for pages that do not load the profile. */
export async function getViewer(): Promise<Viewer> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      return viewerFromMe({
        name: (user.user_metadata?.full_name as string | undefined) ?? null,
        email: user.email ?? null,
      })
    }
  }
  return { name: 'You', email: '', initials: 'Y' }
}
