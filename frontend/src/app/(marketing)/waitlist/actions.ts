'use server'

import { ORG_TYPES, type WaitlistField, type WaitlistState } from '@/lib/waitlist'
import { isSupabaseConfigured } from '@/utils/supabase/config'
import { createClient } from '@/utils/supabase/server'

const text = (data: FormData, key: string) => (typeof data.get(key) === 'string' ? (data.get(key) as string).trim() : '')

export async function joinWaitlist(_previous: WaitlistState, formData: FormData): Promise<WaitlistState> {
  const values = {
    org_name: text(formData, 'org_name'),
    contact_name: text(formData, 'contact_name'),
    email: text(formData, 'email'),
    org_type: text(formData, 'org_type'),
    volume: text(formData, 'volume'),
    message: text(formData, 'message'),
  }

  const fields: Partial<Record<WaitlistField, string>> = {}
  if (!values.org_name) fields.org_name = 'Tell us the organisation name.'
  if (!values.contact_name) fields.contact_name = 'Tell us who to contact.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) fields.email = 'Enter a work email address, like name@school.edu.ng.'
  if (!ORG_TYPES.some((type) => type.value === values.org_type)) fields.org_type = 'Choose the closest match.'

  if (Object.keys(fields).length > 0) return { status: 'error', fields, values }

  if (!isSupabaseConfigured()) {
    return {
      status: 'error',
      fields: {},
      values,
      message: 'The waitlist is not set up on this server yet. Add the Supabase URL and key from .env.example.',
    }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('org_waitlist').insert({
    org_name: values.org_name.slice(0, 200),
    contact_name: values.contact_name.slice(0, 200),
    email: values.email.slice(0, 320),
    org_type: values.org_type,
    volume: values.volume ? values.volume.slice(0, 100) : null,
    message: values.message ? values.message.slice(0, 2000) : null,
  })

  // 23505: this address is already on the list. The outcome the person wants is the same.
  if (error && error.code !== '23505') {
    return { status: 'error', fields: {}, values, message: 'We could not save that. Try again in a moment.' }
  }

  return { status: 'joined', email: values.email }
}
