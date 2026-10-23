import { Eyebrow } from '@/components/page-header'
import { serverApi } from '@/lib/api/server'
import { OnboardingSources } from './onboarding-sources'

export const metadata = { title: 'Connect your sources' }

export default async function OnboardSourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const [sources, params] = await Promise.all([serverApi().sources.list(), searchParams])
  const notice =
    params.error === 'github'
      ? { tone: 'error' as const, text: 'GitHub did not connect. Try again, or choose another source.' }
      : null

  return (
    <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-14">
      <div className="flex flex-col gap-4">
        <Eyebrow>Step 3 of 4</Eyebrow>
        <h1 className="m-0 text-balance font-display text-[clamp(34px,4.5vw,48px)] font-black leading-[1.08] tracking-[-0.03em]">
          Connect everything you have.
        </h1>
        <p className="m-0 text-[17px] leading-[26px] text-ink-muted">
          At least one is required. Collection starts in the background as soon as you connect, so you can keep going.
        </p>
        <div className="border border-line p-4 text-sm leading-[21px] text-ink-muted">
          Tracck reads only what you connect or upload. It never scrapes platforms or uses your logged-in sessions.
          Uploaded CVs are private.
        </div>
      </div>

      <OnboardingSources initial={sources} notice={notice} />
    </div>
  )
}
