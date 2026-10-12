import Link from 'next/link'
import { login } from '../auth/actions'
import { AuthShell } from '@/components/auth-shell'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { TextField } from '@/components/ui/field'
import { authErrorMessage } from '@/lib/auth-errors'

export const metadata = { title: 'Sign in | Tracck' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const error = authErrorMessage((await searchParams).error)

  return (
    <AuthShell
      title="Sign in"
      lede="Pick up where you left off."
      footer={
        <>
          New to Tracck?{' '}
          <Link href="/signup" className="font-semibold text-accent-ink underline">
            Create an account
          </Link>
        </>
      }
    >
      {error && (
        <Alert tone="danger" title={error.title}>
          {error.body}
        </Alert>
      )}

      <form action={login} className="flex flex-col gap-4">
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
          autoComplete="current-password"
          required
        />
        <Button type="submit" size="lg" className="mt-2 w-full">
          Sign in
        </Button>
      </form>
    </AuthShell>
  )
}
