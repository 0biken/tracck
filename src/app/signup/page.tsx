import Link from 'next/link'
import { signup } from '../auth/actions'
import { AuthShell } from '@/components/auth-shell'
import { Alert } from '@/components/ui/alert'
import { Button, buttonClass } from '@/components/ui/button'
import { TextField } from '@/components/ui/field'
import { authErrorMessage } from '@/lib/auth-errors'

export const metadata = { title: 'Create account | Tracck' }

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>
}) {
  const params = await searchParams
  const error = authErrorMessage(params.error)

  if (params.sent) {
    return (
      <AuthShell title="Check your email" lede="One more step before you can sign in.">
        <Alert tone="info" title="We sent you a confirmation link">
          Open the link in that email to confirm your address, then sign in.
        </Alert>
        <Link href="/login" className={buttonClass('secondary', 'lg', 'w-full')}>
          Go to sign in
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Create account"
      lede="Build resumes from work you can show, with a source behind every claim."
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-accent-ink underline">
            Sign in
          </Link>
        </>
      }
    >
      {error && (
        <Alert tone="danger" title={error.title}>
          {error.body}
        </Alert>
      )}

      <form action={signup} className="flex flex-col gap-4">
        <TextField
          id="name"
          label="Full name"
          type="text"
          autoComplete="name"
          help="As you want it to appear on your resume."
          required
        />
        <TextField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
        />
        <TextField
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          required
        />
        <Button type="submit" size="lg" className="mt-2 w-full">
          Create account
        </Button>
      </form>
    </AuthShell>
  )
}
