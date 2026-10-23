import { ROLES, type ResumeLength, type RoleId } from '@tracck/shared'

export const LENGTH_LABEL: Record<ResumeLength, string> = { one_page: 'One page', full: 'Full' }

/** "Developer", or an empty string when the role is not known. */
export const roleName = (id: RoleId | null | undefined) => ROLES.find((role) => role.id === id)?.name ?? ''
