import { Eyebrow } from '@/components/page-header'
import { PricingSection } from '@/components/ui/pricing-section'
import type { PricingTier } from '@/components/ui/pricing-card'
import { PLAN_CARDS } from '@tracck/shared'

export const metadata = { title: 'Pricing' }

const PAYMENT_FREQUENCIES = ['monthly', 'yearly']

const TRACCK_TIERS: PricingTier[] = [
  {
    id: 'free',
    name: PLAN_CARDS.free.name,
    price: {
      monthly: '₦0',
      yearly: '₦0',
    },
    description: PLAN_CARDS.free.blurb,
    features: [...PLAN_CARDS.free.features],
    cta: 'Start Free',
    href: '/signup',
  },
  {
    id: 'pro',
    name: PLAN_CARDS.pro.name,
    price: {
      monthly: 2500,
      yearly: 2000,
    },
    currency: 'NGN',
    description: PLAN_CARDS.pro.blurb,
    features: [...PLAN_CARDS.pro.features],
    cta: 'Start Pro',
    href: '/signup',
    popular: true,
    highlighted: true,
  },
]

const faqs = [
  {
    q: 'What counts as a resume?',
    a: 'One job description generation. Edits, rewrites, and re-exports are free.',
  },
  {
    q: 'Can I pay with a Nigerian card or transfer?',
    a: 'Yes. Cards, bank transfers, and USSD are supported via Paystack.',
  },
  {
    q: 'What happens to my data if I cancel?',
    a: 'Your projects and resumes stay on the Free tier. You can delete anything at any time.',
  },
]

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

      <div className="relative w-full overflow-hidden rounded-xl border border-line bg-canvas p-4 sm:p-8">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="h-full w-full bg-[linear-gradient(to_right,#4f4f4f1a_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f1a_1px,transparent_1px)] bg-[size:35px_35px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]" />
        </div>
        <PricingSection
          title="Simple Pricing"
          subtitle="Choose the best plan for your needs"
          frequencies={PAYMENT_FREQUENCIES}
          tiers={TRACCK_TIERS}
        />
      </div>

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
