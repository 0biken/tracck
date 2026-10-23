import Link from 'next/link'
import { login } from '../auth/actions'
import { GoogleButton, OrDivider } from '@/components/google-button'
import { Logo } from '@/components/logo'
import { SubmitButton } from '@/components/submit-button'
import { Alert } from '@/components/ui/alert'
import { TextField } from '@/components/ui/field'
import { authErrorMessage } from '@/lib/auth-errors'

export const metadata = { title: 'Log in' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>
}) {
  const params = await searchParams
  const error = authErrorMessage(params.error)
  // Only a path on this site: the same rule the sign-in action applies.
  const next = params.next?.startsWith('/') && !params.next.startsWith('//') ? params.next : undefined

  return (
    <div className="flex min-h-dvh flex-col px-5 py-7 sm:px-10">
      <div className="self-start">
        <Logo />
      </div>

      <main className="flex flex-1 items-center justify-center py-12">
        <div className="flex w-full max-w-105 flex-col gap-4 border-t-2 border-ink pt-7">
          <h1 className="t-h2 m-0">Log in</h1>

          {error && (
            <Alert tone="danger" title={error.title}>
              {error.body}
            </Alert>
          )}

          <form action={login} className="flex flex-col gap-4">
            {next && <input type="hidden" name="next" value={next} />}
            <TextField id="email" label="Email" type="email" size="lg" autoComplete="email" placeholder="you@ui.edu.ng" required />
            <div className="flex flex-col gap-1.5">
              <TextField id="password" label="Password" type="password" size="lg" autoComplete="current-password" required />
              <Link href="/forgot-password" className="inline-flex min-h-8 items-center self-end text-sm">
                Forgot password
              </Link>
            </div>
            <SubmitButton size="lg" className="w-full">
              Log in
            </SubmitButton>
          </form>

          <OrDivider />
          <GoogleButton page="login" next={next} />

          <p className="m-0 border-t border-line pt-4 text-[15px]">
            New to Tracck?{' '}
            <Link href="/signup" className="font-semibold">
              Create an account
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
