import { Logo } from '@/components/logo'
import { ApiClientError } from '@/lib/api/errors'
import { publicApi } from '@/lib/api/server'
import { getViewer } from '@/lib/viewer'
import { ConsentForm } from './consent-form'

export const metadata = { title: 'Access request' }

export default async function ConsentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const viewer = await getViewer()

  // The link itself is the proof of who the request is for, so it can be read before signing in.
  let request = null
  if (token !== 'sandbox') {
    try {
      request = await publicApi().consent.get(token)
    } catch (error) {
      if (!(error instanceof ApiClientError) || error.status >= 500) throw error
    }
  }

  return (
    <div className="flex min-h-dvh flex-col px-5 py-7 sm:px-10">
      <div className="self-start">
        <Logo href={null} />
      </div>
      <main className="flex flex-1 items-center justify-center py-12">
        <ConsentForm token={token} request={request} email={viewer.email || null} />
      </main>
    </div>
  )
}
