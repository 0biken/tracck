import { PageHeader } from '@/components/page-header'
import { ApiClientError } from '@/lib/api/errors'
import { serverApi } from '@/lib/api/server'
import { SettingsForm, type Notice } from './settings-form'

export const metadata = { title: 'Settings and plan' }

const STUDENT_NOTICE: Record<string, Notice> = {
  verified: { tone: 'ok', text: 'Student email confirmed. You can now get the student price.' },
  invalid: { tone: 'error', text: 'That confirmation link has expired or was already used. Request a new one.' },
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; student?: string }>
}) {
  const api = serverApi()
  const params = await searchParams

  // Paystack sends the person back here after paying. Asking it for the outcome settles the plan even if its webhook is late.
  let notice: Notice | null = params.student ? (STUDENT_NOTICE[params.student] ?? null) : null
  if (params.reference) {
    try {
      const result = await api.billing.verify(params.reference)
      notice =
        result.status === 'succeeded'
          ? { tone: 'ok', text: 'Payment received. Your plan is now active.' }
          : result.status === 'pending'
            ? { tone: 'ok', text: 'Your payment is still being confirmed. Refresh in a moment.' }
            : { tone: 'error', text: 'That payment did not go through. You have not been charged for a plan.' }
    } catch (error) {
      notice = { tone: 'error', text: error instanceof ApiClientError ? error.message : 'We could not check that payment.' }
    }
  }

  const [me, billing, consents] = await Promise.all([api.me.get(), api.billing.get(), api.me.consents()])
  const planLabel = me.plan === 'pro' ? (me.priceTier === 'student' ? 'Student Plus' : 'Pro') : 'Free'

  return (
    <div className="flex flex-col">
      <PageHeader eyebrow={`Account · ${planLabel} plan`} title="Settings and plan" />
      <SettingsForm me={me} billing={billing} consents={consents} notice={notice} />
    </div>
  )
}
