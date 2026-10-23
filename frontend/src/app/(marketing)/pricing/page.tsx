import Link from 'next/link'
import { Eyebrow } from '@/components/page-header'
import { buttonClass } from '@/components/ui/button'
import { PLAN_CARDS } from '@tracck/shared'

export const metadata = { title: 'Pricing' }

const faqs = [
  {
    q: 'What counts as a resume?',
    a: 'One generation for one job description. Editing, rewriting a bullet and exporting the same resume again do not count.',
  },
  { q: 'Can I pay with a Nigerian card or transfer?', a: '[PAYMENT METHODS TO CONFIRM]' },
  {
    q: 'What happens to my data if I cancel?',
    a: 'Your record and resumes stay on the Free plan. You can delete any source, entry or resume, or your whole account, at any time.',
  },
]

function Tier({
  plan,
  cta,
  href,
  primary = false,
  highlighted = false,
  last = false,
  per = false,
}: {
  plan: (typeof PLAN_CARDS)[keyof typeof PLAN_CARDS]
  cta: string
  href: string
  primary?: boolean
  highlighted?: boolean
  last?: boolean
  per?: boolean
}) {
  return (
    <section
      aria-label={plan.name}
      className={`flex flex-col gap-4 border-b border-line p-8 md:border-b-0 ${last ? '' : 'md:border-r'} ${highlighted ? 'bg-sunken' : ''}`}
    >
      <Eyebrow className={highlighted ? '!text-ink' : ''}>{plan.eyebrow}</Eyebrow>
      <div className="font-mono text-[40px] leading-[44px]">
        {plan.price}
        {per && <span className="text-[15px] text-ink-muted"> / month</span>}
      </div>
      <p className="m-0 text-[15px] leading-[22px] text-ink-muted">{plan.blurb}</p>
      <Link href={href} className={buttonClass(primary ? 'primary' : 'secondary', 'md')}>
        {cta}
      </Link>
      <ul className={`m-0 flex list-none flex-col gap-2.5 border-t p-0 pt-4 ${highlighted ? 'border-line-strong' : 'border-line'}`}>
        {plan.features.map((feature) => (
          <li key={feature} className="text-[15px] leading-[22px]">
            {feature}
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function PricingPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-14 px-5 pb-24 pt-14 sm:px-8 sm:pt-20">
      <div className="flex max-w-190 flex-col gap-4">
        <Eyebrow>Pricing · Naira, billed monthly</Eyebrow>
        <h1 className="t-h1 m-0 text-balance">Pay for resumes, not for words.</h1>
        <p className="m-0 text-lg leading-7 text-ink-muted">
          Limits count resumes generated and sources connected. Cancel any time.
        </p>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] border border-line border-t-2 border-t-ink">
        <Tier plan={PLAN_CARDS.free} cta="Start free" href="/signup" />
        <Tier plan={PLAN_CARDS.pro} cta="Start Pro" href="/signup" primary highlighted last per />
      </div>

      <section className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-center gap-10 bg-inverse p-8 text-on-inverse sm:p-12">
        <div className="flex flex-col gap-3">
          <Eyebrow className="!text-inverse-muted">Organisations</Eyebrow>
          <h2 className="t-h2 m-0 text-balance">Universities, bootcamps and job platforms</h2>
          <p className="m-0 text-[17px] leading-[26px] text-inverse-muted">
            Per-client API keys, quotas set by plan, usage billed per key. People consent before you read their data.
          </p>
        </div>
        <div className="flex md:justify-end">
          <Link href="/waitlist" className={buttonClass('inverse', 'md')}>
            Join the API waitlist
          </Link>
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="faq">
        <h2 id="faq" className="t-h3 m-0">
          Questions
        </h2>
        <div className="border-t-2 border-ink">
          {faqs.map((faq) => (
            <details key={faq.q} className="border-b border-line py-[18px]">
              <summary className="min-h-6 cursor-pointer text-[17px] font-semibold">{faq.q}</summary>
              <p className="m-0 mt-3 text-[15px] leading-[23px] text-ink-muted">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  )
}
