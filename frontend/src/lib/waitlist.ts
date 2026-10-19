export const ORG_TYPES = [
  { value: 'university', label: 'University or careers office' },
  { value: 'bootcamp', label: 'Bootcamp or training programme' },
  { value: 'job_platform', label: 'Job platform or recruiter' },
  { value: 'other', label: 'Something else' },
] as const

export type WaitlistField = 'org_name' | 'contact_name' | 'email' | 'org_type'

export type WaitlistState =
  | { status: 'idle' }
  | { status: 'joined'; email: string }
  | {
      status: 'error'
      /** Per-field problems, shown under the field. */
      fields: Partial<Record<WaitlistField, string>>
      /** A problem with the request as a whole. */
      message?: string
      /** What the person typed, so a failed submit does not clear the form. */
      values: Record<string, string>
    }
