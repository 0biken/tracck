import Link from 'next/link'
import { requestPasswordReset } from '../auth/actions'
import { AuthFrame } from '@/components/auth-frame'
import { SubmitButton } from '@/components/submit-button'
import { Alert } from '@/components/ui/alert'
import { buttonClass } from '@/components/ui/button'
import { TextField } from '@/components/ui/field'
import { authErrorMessage } from '@/lib/auth-errors'

export const metadata = { title: 'Reset your password' }

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>
}) {
  const params = await searchParams
  const error = authErrorMessage(params.error)

  if (params.sent) {
    return (
      <AuthFrame title="Check your email">
        <Alert tone="success" title="If that address has an account, we sent a link">
          Open it to choose a new password. The link works once and expires after an hour.
        </Alert>
        <Link href="/login" className={buttonClass('secondary', 'lg', 'w-full')}>
          Back to log in
        </Link>
      </AuthFrame>
    )
  }

  return (
    <AuthFrame title="Reset your password">
      <p className="m-0 text-base leading-6 text-ink-muted">
        Enter the email you signed up with and we will send you a link to choose a new password.
      </p>

      {error && (
        <Alert tone="danger" title={error.title}>
          {error.body}
        </Alert>
      )}

      <form action={requestPasswordReset} className="flex flex-col gap-4">
        <TextField id="email" label="Email" type="email" size="lg" autoComplete="email" placeholder="you@ui.edu.ng" required />
        <SubmitButton size="lg" className="w-full">
          Send reset link
        </SubmitButton>
      </form>

      <p className="m-0 border-t border-line pt-4 text-[15px]">
        Remembered it?{' '}
        <Link href="/login" className="font-semibold">
          Log in
        </Link>
      </p>
    </AuthFrame>
  )
}
