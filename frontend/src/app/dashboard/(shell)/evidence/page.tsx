import { PageHeader } from '@/components/page-header'
import { serverApi } from '@/lib/api/server'
import { AddEntryButton } from './add-entry-button'
import { EvidenceLibrary } from './evidence-library'

export const metadata = { title: 'Evidence library' }

export default async function EvidencePage() {
  const page = await serverApi().evidence.list()
  const { counts } = page

  return (
    <>
      <PageHeader
        eyebrow={`${counts.all} entries · ${counts.pinned} pinned · ${counts.excluded} excluded`}
        title="Evidence library"
        actions={<AddEntryButton />}
      >
        Correct your record here. Pinned entries are always considered. Excluded entries are never used.
      </PageHeader>
      <EvidenceLibrary initial={page} />
    </>
  )
}
