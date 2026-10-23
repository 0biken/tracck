import { Eyebrow } from '@/components/page-header'
import { serverApi } from '@/lib/api/server'
import { DetailsForm } from './details-form'

export const metadata = { title: 'Your details' }

export default async function OnboardDetailsPage() {
  const me = await serverApi().me.get()

  return (
    <>
      <div className="flex max-w-180 flex-col gap-3">
        <Eyebrow>Step 2 of 4</Eyebrow>
        <h1 className="t-h1 m-0 text-balance">How can employers reach you?</h1>
        <p className="m-0 text-lg leading-7 text-ink-muted">
          These go at the top of every resume. Phone and location are needed. The rest only appears if you fill it in.
        </p>
      </div>
      <DetailsForm me={me} />
    </>
  )
}
