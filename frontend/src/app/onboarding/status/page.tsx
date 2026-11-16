import { Eyebrow } from '@/components/page-header'
import { serverApi } from '@/lib/api/server'
import { CollectionStatus } from './collection-status'

export const metadata = { title: 'Syncing your work' }

export default async function OnboardStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string }>
}) {
  const api = serverApi()
  const [sources, me] = await Promise.all([api.sources.list(), api.me.get(), searchParams])

  return (
    <>
      <div className="flex max-w-190 flex-col gap-3">
        <Eyebrow>Step 4 of 4</Eyebrow>
        <h1 className="t-h1 m-0 text-balance">Syncing your work.</h1>
      </div>
      <CollectionStatus initial={sources} email={me.email ?? ''} />
    </>
  )
}
