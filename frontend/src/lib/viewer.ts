import { MOCK_USER } from '@/lib/mock/account'
import { isSupabaseConfigured } from '@/utils/supabase/config'
import { createClient } from '@/utils/supabase/server'

export type Viewer = { name: string; email: string; initials: string }

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? '?').slice(0, 2)
  return letters.toUpperCase()
}

/**
 * The signed-in person, for the side menu. Without a Supabase project (local UI
 * work) it returns the sample user, so every screen still renders.
 */
export async function getViewer(): Promise<Viewer> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const email = user.email ?? ''
      const name = (user.user_metadata?.full_name as string | undefined) || email.split('@')[0] || 'You'
      return { name, email, initials: initialsOf(name) }
    }
  }
  return { name: MOCK_USER.name, email: MOCK_USER.email, initials: MOCK_USER.initials }
}
