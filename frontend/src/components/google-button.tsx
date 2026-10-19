import { signInWithGoogle } from '@/app/auth/actions'
import { SubmitButton } from '@/components/submit-button'

/** "Continue with Google". A form of its own so it can sit beside the email form. */
export function GoogleButton({ page, next }: { page: 'login' | 'signup'; next?: string }) {
  return (
    <form action={signInWithGoogle}>
      <input type="hidden" name="page" value={page} />
      {next && <input type="hidden" name="next" value={next} />}
      <SubmitButton variant="secondary" size="lg" className="w-full">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="square"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 12h8" />
        </svg>
        Continue with Google
      </SubmitButton>
    </form>
  )
}

export function OrDivider({ children = 'or' }: { children?: string }) {
  return (
    <div className="flex items-center gap-3 text-[13px] text-ink-muted" role="separator">
      <span className="h-px flex-1 bg-line" />
      {children}
      <span className="h-px flex-1 bg-line" />
    </div>
  )
}
