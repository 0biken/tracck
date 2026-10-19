import Link from 'next/link'
import { PageHeader } from '@/components/page-header'
import { buttonClass } from '@/components/ui/button'
import { ACCOUNT } from '@/lib/mock/account'
import { EvidenceLibrary } from './evidence-library'

export const metadata = { title: 'Evidence library' }

export default function EvidencePage() {
  return (
    <>
      <PageHeader
        eyebrow={`${ACCOUNT.entries} entries · ${ACCOUNT.pinned} pinned · ${ACCOUNT.excluded} excluded`}
        title="Evidence library"
        actions={
          <Link href="/dashboard/sources" className={buttonClass('primary', 'md')}>
            Add an entry
          </Link>
        }
      >
        Correct your record here. Pinned entries are always considered. Excluded entries are never used.
      </PageHeader>
      <EvidenceLibrary />
    </>
  )
}
