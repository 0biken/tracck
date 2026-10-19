import { Logo } from '@/components/logo'
import { getViewer } from '@/lib/viewer'
import { ConsentForm } from './consent-form'

export const metadata = { title: 'Access request' }

export default async function ConsentPage() {
  const viewer = await getViewer()

  return (
    <div className="flex min-h-dvh flex-col px-5 py-7 sm:px-10">
      <div className="self-start">
        <Logo href={null} />
      </div>
      <main className="flex flex-1 items-center justify-center py-12">
        <ConsentForm email={viewer.email} />
      </main>
    </div>
  )
}
