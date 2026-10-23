import Link from 'next/link'
import { signup } from '../auth/actions'
import { GoogleButton, OrDivider } from '@/components/google-button'
import { Logo } from '@/components/logo'
import { SubmitButton } from '@/components/submit-button'
import { Alert } from '@/components/ui/alert'
import { buttonClass } from '@/components/ui/button'
import { TextField } from '@/components/ui/field'
import { authErrorMessage } from '@/lib/auth-errors'

export const metadata = { title: 'Sign up' }

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>
}) {
  const params = await searchParams
  const error = authErrorMessage(params.error)

  if (params.sent) {
    return (
      <div className="flex min-h-dvh flex-col px-5 py-7 sm:px-10">
        <div className="self-start">
          <Logo />
        </div>
        <main className="flex flex-1 items-center justify-center py-12">
          <div className="flex w-full max-w-105 flex-col gap-4 border-t-2 border-ink pt-7">
            <h1 className="t-h2 m-0">Check your email</h1>
            <Alert tone="success" title="We sent you a confirmation link">
              Open the link in that email to confirm your address, then log in.
            </Alert>
            <Link href="/login" className={buttonClass('secondary', 'lg', 'w-full')}>
              Go to log in
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-wrap bg-canvas">
      <section className="flex flex-[1_1_440px] flex-col px-5 py-7 sm:px-10">
        <div className="self-start">
          <Logo />
        </div>

        <main className="flex flex-1 items-center justify-center py-12">
          <div className="flex w-full max-w-105 flex-col gap-4">
            <h1 className="t-h2 m-0">Start your record</h1>
            <p className="m-0 mb-2 text-[17px] leading-[26px] text-ink-muted">
              Connect your work once. Generate a resume for every job.
            </p>

            {error && (
              <Alert tone="danger" title={error.title}>
                {error.body}
              </Alert>
            )}

            <GoogleButton page="signup" next="/onboarding/role" />
            <OrDivider>or with your email</OrDivider>

            <form action={signup} className="flex flex-col gap-4">
              <TextField
                id="name"
                label="Full name"
                size="lg"
                autoComplete="name"
                help="As it should appear on your resume."
                required
              />
              <TextField id="email" label="Email" type="email" size="lg" autoComplete="email" placeholder="you@ui.edu.ng" required />
              <TextField
                id="password"
                label="Password"
                type="password"
                size="lg"
                autoComplete="new-password"
                minLength={10}
                help="At least 10 characters."
                required
              />
              <SubmitButton size="lg" className="w-full">
                Create account
              </SubmitButton>
            </form>

            <p className="m-0 text-[13px] leading-[19px] text-ink-muted">
              By signing up you agree to the{' '}
              <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.
            </p>
            <p className="m-0 border-t border-line pt-4 text-[15px]">
              Already have an account?{' '}
              <Link href="/login" className="font-semibold">
                Log in
              </Link>
            </p>
          </div>
        </main>
      </section>

      <aside
        aria-label="What you get"
        className="flex flex-[1_1_440px] flex-col justify-center gap-7 bg-inverse px-5 py-14 text-on-inverse sm:px-14"
      >
        <div className="t-eyebrow text-inverse-muted">ENTRY 042 — 2026.10.12</div>
        <p className="m-0 max-w-130 font-display text-[clamp(32px,4vw,44px)] font-black leading-[1.14] tracking-[-0.03em]">
          Every line on your resume traces back to something you did.
        </p>
        <div className="flex max-w-130 flex-col gap-2.5 border border-inverse-line p-5">
          <span className="text-base leading-6">
            Built a NestJS subscription billing service that retries failed card charges through BullMQ queues.
          </span>
          <span className="font-mono text-xs text-signal-on-inverse">GITHUB — lemni-billing — 2026.08.18</span>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs text-inverse-muted">
          <span>NO SCRAPING</span>
          <span>DELETE ANY TIME</span>
          <span>NDPR</span>
        </div>
      </aside>
    </div>
  )
}
