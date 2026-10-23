import Link from 'next/link'
import { Eyebrow } from '@/components/page-header'
import { buttonClass } from '@/components/ui/button'
import { serverApi } from '@/lib/api/server'
import { formatStamp } from '@/lib/format'
import { ReviewControl } from './review-control'

export const metadata = { title: 'CV feedback' }

const ROLE_NAMES = {
  dev: 'Developer',
  devrel: 'Developer Relations',
  smm: 'Social media',
  va: 'Virtual assistant',
  ux: 'Product design',
  da: 'Data',
} as const

export default async function CvFeedbackPage() {
  const api = serverApi()
  const [review, sources] = await Promise.all([api.cvReview.latest(), api.sources.list()])
  const hasCv = sources.some((source) => source.provider === 'cv')

  if (!review) {
    return (
      <div className="flex max-w-[880px] flex-col gap-7">
        <div className="flex flex-col gap-2 border-b-2 border-ink pb-5">
          <h1 className="t-h2 m-0">CV feedback</h1>
          <p className="m-0 text-base leading-6 text-ink-muted">
            {hasCv
              ? 'Tracck can read the CV you uploaded and tell you what weakens it. This is feedback only; it does not rewrite your file.'
              : 'Upload a CV and Tracck will tell you what weakens it, with the line each point is about.'}
          </p>
        </div>
        {hasCv ? (
          <ReviewControl label="Review my CV" />
        ) : (
          <div>
            <Link href="/dashboard/sources" className={buttonClass('primary', 'md')}>
              Upload a CV
            </Link>
          </div>
        )}
      </div>
    )
  }

  const count = review.issues.length
  const eyebrow = [
    review.file,
    review.roleFamily && `Read against the ${ROLE_NAMES[review.roleFamily]} profile`,
    `Read ${formatStamp(review.readAt)} UTC`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="flex max-w-[880px] flex-col gap-7">
      <div className="flex flex-col gap-2 border-b-2 border-ink pb-5">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="t-h2 m-0">CV feedback</h1>
        <p className="m-0 text-base leading-6 text-ink-muted">
          {count === 0
            ? 'We found nothing that weakens this CV.'
            : `${count === 1 ? 'One thing weakens' : `${count} things weaken`} this CV. This is feedback only. Tracck does not rewrite your file; your next generated resume already avoids ${count === 1 ? 'it' : 'these'}.`}
        </p>
      </div>

      {review.stats.length > 0 && (
        <dl
          aria-label="Summary"
          className="m-0 grid grid-cols-[repeat(auto-fit,minmax(min(100%,160px),1fr))] gap-px border border-line bg-line"
        >
          {review.stats.map((stat) => (
            <div key={stat.label} className="flex flex-col gap-1 bg-canvas p-[18px]">
              <dd className="m-0 font-mono text-[28px]">{stat.n}</dd>
              <dt className="text-[13px] text-ink-muted">{stat.label}</dt>
            </div>
          ))}
        </dl>
      )}

      <ol className="m-0 list-none p-0">
        {review.issues.map((issue, index) => (
          <li
            key={issue.title}
            className={`grid grid-cols-[40px_minmax(0,1fr)] gap-3 border-t border-line py-6 sm:grid-cols-[56px_minmax(0,1fr)] sm:gap-5 ${
              index === review.issues.length - 1 ? 'border-b' : ''
            }`}
          >
            <span className="font-mono text-[13px] text-danger-ink">{String(index + 1).padStart(2, '0')}</span>
            <div className="flex flex-col gap-2.5">
              <h2 className="t-claim m-0">{issue.title}</h2>
              <p className="m-0 text-[15px] leading-[23px] text-ink-muted">{issue.body}</p>
              {issue.quote && (
                <blockquote className="m-0 border border-line bg-sunken px-3.5 py-3 text-sm leading-[21px]">
                  {issue.quote}
                </blockquote>
              )}
              {issue.fix && <span className="text-sm">{issue.fix}</span>}
            </div>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-start gap-3">
        <Link href="/dashboard/resumes/new" className={buttonClass('primary', 'md')}>
          Generate a resume for a job
        </Link>
        <Link href="/dashboard/sources" className={buttonClass('secondary', 'md')}>
          Upload a newer CV
        </Link>
        {hasCv && <ReviewControl label="Review again" />}
      </div>
    </div>
  )
}
