'use server'

import { ORG_TYPES, type OrgType } from '@tracck/shared'
import { publicApi } from '@/lib/api/server'
import { ApiClientError } from '@/lib/api/errors'
import type { WaitlistField, WaitlistState } from '@/lib/waitlist'

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

  // Catch the common mistakes here so the person sees which field to fix. The API checks again.
  const fields: Partial<Record<WaitlistField, string>> = {}
  if (!values.org_name) fields.org_name = 'Tell us the organisation name.'
  if (!values.contact_name) fields.contact_name = 'Tell us who to contact.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) fields.email = 'Enter a work email address, like name@school.edu.ng.'
  if (!ORG_TYPES.some((type) => type.value === values.org_type)) fields.org_type = 'Choose the closest match.'

  if (Object.keys(fields).length > 0) return { status: 'error', fields, values }

  try {
    await publicApi().waitlist.join({
      orgName: values.org_name,
      contactName: values.contact_name,
      email: values.email,
      orgType: values.org_type as OrgType,
      volume: values.volume || undefined,
      message: values.message || undefined,
    })
  } catch (error) {
    const message =
      error instanceof ApiClientError
        ? error.message
        : 'We could not reach the server. Check your connection and try again.'
    return { status: 'error', fields: {}, values, message }
  }

  return { status: 'joined', email: values.email }
}
