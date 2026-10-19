import { PageHeader } from '@/components/page-header'
import { ACCOUNT } from '@/lib/mock/account'
import { SourcesManager } from './sources-manager'

export const metadata = { title: 'Sources' }

export default function SourcesPage() {
  return (
    <>
      <PageHeader
        eyebrow={`${ACCOUNT.sourcesTotal} connected · Next scheduled refresh ${ACCOUNT.nextRefresh}`}
        title="Sources"
      >
        Where your evidence comes from. Collection runs in the background; you never need to wait here.
      </PageHeader>
      <SourcesManager />
    </>
  )
}
