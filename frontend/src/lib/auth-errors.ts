// Auth failures travel in the URL as a short code, never as free text.
// Each one says what happened and what to do.

export type AuthErrorCode =
  | 'missing_fields'
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'user_already_exists'
  | 'weak_password'
  | 'password_mismatch'
  | 'same_password'
  | 'rate_limited'
  | 'not_configured'
  | 'unknown'

type Message = { title: string; body: string }

const messages: Record<AuthErrorCode, Message> = {
  missing_fields: {
    title: 'Some details are missing',
    body: 'Fill in every field, then try again.',
  },
  invalid_credentials: {
    title: 'That email and password do not match',
    body: 'Check both and try again.',
  },
  email_not_confirmed: {
    title: 'Confirm your email first',
    body: 'Open the link we sent when you created your account, then sign in.',
  },
  user_already_exists: {
    title: 'An account with that email already exists',
    body: 'Sign in instead, or use a different email.',
  },
  weak_password: {
    title: 'That password is too weak',
    body: 'Use at least 10 characters that mix letters, numbers, and symbols.',
  },
  password_mismatch: {
    title: 'The two passwords differ',
    body: 'Type the same new password in both fields.',
  },
  same_password: {
    title: 'That is your current password',
    body: 'Choose a new one.',
  },
  rate_limited: {
    title: 'Too many attempts',
    body: 'Wait a few minutes, then try again.',
  },
  not_configured: {
    title: 'Sign-in is not set up on this server',
    body: 'Add the Supabase URL and key from .env.example, then restart the app.',
  },
  unknown: {
    title: 'We could not complete that',
    body: 'Try again. If it keeps happening, contact support.',
  },
}

const supabaseCodes: Record<string, AuthErrorCode> = {
  invalid_credentials: 'invalid_credentials',
  email_not_confirmed: 'email_not_confirmed',
  user_already_exists: 'user_already_exists',
  email_exists: 'user_already_exists',
  weak_password: 'weak_password',
  same_password: 'same_password',
  over_request_rate_limit: 'rate_limited',
  over_email_send_rate_limit: 'rate_limited',
}

export function toAuthErrorCode(supabaseCode: string | undefined): AuthErrorCode {
  return (supabaseCode && supabaseCodes[supabaseCode]) || 'unknown'
}

export function authErrorMessage(code: string | undefined): Message | null {
  if (!code) return null
  return messages[code as AuthErrorCode] ?? messages.unknown
}
