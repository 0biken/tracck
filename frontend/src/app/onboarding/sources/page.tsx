import Link from 'next/link'
import { Eyebrow } from '@/components/page-header'
import { Tag } from '@/components/ui/badge'
import { Button, buttonClass } from '@/components/ui/button'

export const metadata = { title: 'Connect your sources' }

const rowClass = 'grid grid-cols-1 items-center gap-4 border-b border-line py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-5 sm:py-[22px]'

export default function OnboardSourcesPage() {
  return (
    <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-14">
      <div className="flex flex-col gap-4">
        <Eyebrow>Step 2 of 3</Eyebrow>
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

      <div className="min-w-0">
        <div className={`${rowClass} border-t-2 border-t-ink`}>
          <div className="flex flex-col gap-1">
            <span className="flex flex-wrap items-center gap-2.5">
              <span className="text-lg font-bold">GitHub</span>
              <Tag tone="signal">CONNECTED</Tag>
            </span>
            <span className="text-sm leading-[21px] text-ink-muted">@toluadebayo. Collecting full history now.</span>
          </div>
          <Button variant="secondary">Change</Button>
        </div>

        <div className={rowClass}>
          <div className="flex flex-col gap-1">
            <span className="flex flex-wrap items-center gap-2.5">
              <span className="text-lg font-bold">CV or resume</span>
              <Tag tone="signal">UPLOADED</Tag>
            </span>
            <span className="text-sm leading-[21px] text-ink-muted">
              Tolu_CV_2026.pdf · 184 KB. We will also give you feedback on it.
            </span>
          </div>
          <Button variant="secondary">Replace</Button>
        </div>

        <div className={rowClass}>
          <div className="flex flex-col gap-1.5">
            <span className="text-lg font-bold">LinkedIn</span>
            <span className="text-sm leading-[21px] text-ink-muted">
              Upload your data export ZIP (Settings › Data privacy › Get a copy of your data), a profile PDF, or paste
              your profile text.
            </span>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button variant="secondary">Upload ZIP or PDF</Button>
            <Button variant="secondary">Paste</Button>
          </div>
        </div>

        <div className={rowClass}>
          <div className="flex flex-col gap-2">
            <label htmlFor="portfolio" className="text-lg font-bold">
              Portfolio or personal site
            </label>
            <input
              id="portfolio"
              type="url"
              placeholder="https://"
              className="min-h-11 w-full max-w-105 rounded-sm border border-line-input bg-canvas px-3 text-[15px] hover:border-ink"
            />
          </div>
          <Button variant="secondary">Add link</Button>
        </div>

        <div className={rowClass}>
          <div className="flex flex-col gap-1">
            <span className="flex flex-wrap items-center gap-2.5">
              <span className="text-lg font-bold">X</span>
              <Tag>LIMITED</Tag>
            </span>
            <span className="text-sm leading-[21px] text-ink-muted">Upload your X archive or paste key posts.</span>
          </div>
          <Button variant="secondary">Upload archive</Button>
        </div>

        <div className={rowClass}>
          <div className="flex flex-col gap-1">
            <span className="text-lg font-bold">Manual entry</span>
            <span className="text-sm leading-[21px] text-ink-muted">
              Little public presence? Describe your work and Tracck helps with the wording.
            </span>
          </div>
          <Button variant="secondary">Add manually</Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-6">
          <Link href="/onboarding/role" className="inline-flex min-h-11 items-center text-sm font-semibold">
            Back
          </Link>
          <Link href="/onboarding/status" className={buttonClass('primary', 'lg')}>
            Continue with 2 sources
          </Link>
        </div>
      </div>
    </div>
  )
}
