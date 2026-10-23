import { PageHeader } from '@/components/page-header'
import { serverApi } from '@/lib/api/server'
import { formatStamp } from '@/lib/format'
import { SourcesManager } from './sources-manager'

export const metadata = { title: 'Sources' }

export default async function SourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>
}) {
  const api = serverApi()
  const [sources, summary, params] = await Promise.all([api.sources.list(), api.me.summary(), searchParams])

  // GitHub sends the person back here with the outcome in the address.
  const notice =
    params.connected === 'github'
      ? { tone: 'ok' as const, text: 'GitHub connected. Tracck is reading your public repositories now.' }
      : params.error === 'github'
        ? { tone: 'error' as const, text: 'GitHub did not connect. Try again, or check your plan allows another source.' }
        : null

  return (
    <>
      <PageHeader
        eyebrow={`${sources.length} connected · Next scheduled refresh ${formatStamp(summary.nextRefreshAt)} UTC`}
        title="Sources"
      >
        Where your evidence comes from. Collection runs in the background; you never need to wait here.
      </PageHeader>
      <SourcesManager initial={sources} notice={notice} />
    </>
  )
}
