import Link from 'next/link'
import { buttonClass } from '@/components/ui/button'
import { Eyebrow } from '@/components/page-header'
import { CV_FEEDBACK } from '@/lib/mock/record'

export const metadata = { title: 'CV feedback' }

export default function CvFeedbackPage() {
  return (
    <div className="flex max-w-[880px] flex-col gap-7">
      <div className="flex flex-col gap-2 border-b-2 border-ink pb-5">
        <Eyebrow>
          {CV_FEEDBACK.file} · Read against the Developer profile · {CV_FEEDBACK.read}
        </Eyebrow>
        <h1 className="t-h2 m-0">CV feedback</h1>
        <p className="m-0 text-base leading-6 text-ink-muted">
          Four things weaken this CV for developer roles. This is feedback only. Tracck does not rewrite your file; your
          next generated resume already avoids these.
        </p>
      </div>

      <dl
        aria-label="Summary"
        className="m-0 grid grid-cols-[repeat(auto-fit,minmax(min(100%,160px),1fr))] gap-px border border-line bg-line"
      >
        {CV_FEEDBACK.stats.map((stat) => (
          <div key={stat.label} className="flex flex-col gap-1 bg-canvas p-[18px]">
            <dd className="m-0 font-mono text-[28px]">{stat.n}</dd>
            <dt className="text-[13px] text-ink-muted">{stat.label}</dt>
          </div>
        ))}
      </dl>

      <ol className="m-0 list-none p-0">
        {CV_FEEDBACK.issues.map((issue, index) => (
          <li
            key={issue.title}
            className={`grid grid-cols-[40px_minmax(0,1fr)] gap-3 border-t border-line py-6 sm:grid-cols-[56px_minmax(0,1fr)] sm:gap-5 ${
              index === CV_FEEDBACK.issues.length - 1 ? 'border-b' : ''
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

      <div className="flex flex-wrap gap-3">
        <Link href="/dashboard/resumes/new" className={buttonClass('primary', 'md')}>
          Generate a resume for a job
        </Link>
        <Link href="/dashboard/sources" className={buttonClass('secondary', 'md')}>
          Upload a newer CV
        </Link>
      </div>
    </div>
  )
}
