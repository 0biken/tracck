import Link from 'next/link'
import { updatePassword } from '../auth/actions'
import { AuthFrame } from '@/components/auth-frame'
import { SubmitButton } from '@/components/submit-button'
import { Alert } from '@/components/ui/alert'
import { TextField } from '@/components/ui/field'
import { authErrorMessage } from '@/lib/auth-errors'

export const metadata = { title: 'Choose a new password' }

// Reached from the emailed link, which signs the person in first (see /auth/callback).
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const error = authErrorMessage((await searchParams).error)

  return (
    <AuthFrame title="Choose a new password">
      {error && (
        <Alert tone="danger" title={error.title}>
          {error.body}
        </Alert>
      )}

      <form action={updatePassword} className="flex flex-col gap-4">
        <TextField
          id="password"
          label="New password"
          type="password"
          size="lg"
          autoComplete="new-password"
          minLength={10}
          help="At least 10 characters."
          required
        />
        <TextField
          id="confirm"
          label="Type it again"
          type="password"
          size="lg"
          autoComplete="new-password"
          minLength={10}
          required
        />
        <SubmitButton size="lg" className="w-full">
          Save new password
        </SubmitButton>
      </form>

      <p className="m-0 border-t border-line pt-4 text-[15px]">
        Link not working?{' '}
        <Link href="/forgot-password" className="font-semibold">
          Send a new one
        </Link>
      </p>
    </AuthFrame>
  )
}
