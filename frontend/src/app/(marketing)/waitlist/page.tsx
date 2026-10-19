import { Eyebrow } from '@/components/page-header'
import { WaitlistForm } from './waitlist-form'

export const metadata = { title: 'API waitlist' }

const points = [
  ['Scoped keys', 'Each organisation gets its own keys, limits and usage dashboard.'],
  ['Consent first', 'You read a person’s data only after they consent, for the permissions they choose.'],
  ['Verified resumes', 'Every line in a resume traces back to evidence in that person’s record.'],
]

export default function WaitlistPage() {
  return (
    <main className="mx-auto grid w-full max-w-[1200px] items-start gap-12 px-5 pb-24 pt-14 sm:px-8 sm:pt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-20">
      <div className="flex flex-col gap-6">
        <Eyebrow>For universities, bootcamps and job platforms</Eyebrow>
        <h1 className="t-h1 m-0 text-balance">Join the API waitlist.</h1>
        <p className="m-0 text-lg leading-7 text-ink-muted">
          The Tracck API lets your students or applicants generate verified resumes without leaving your product. Tell us
          about your organisation and we will be in touch when access opens.
        </p>
        <dl className="m-0 flex flex-col border-t-2 border-ink">
          {points.map(([title, body]) => (
            <div key={title} className="flex flex-col gap-1 border-b border-line py-4">
              <dt className="font-bold">{title}</dt>
              <dd className="m-0 text-[15px] leading-[22px] text-ink-muted">{body}</dd>
            </div>
          ))}
        </dl>
      </div>

      <section aria-labelledby="waitlist-form" className="flex flex-col gap-5 border-t-2 border-ink pt-7">
        <h2 id="waitlist-form" className="t-claim m-0">
          Tell us about your organisation
        </h2>
        <WaitlistForm />
      </section>
    </main>
  )
}
