import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/ui/skeleton'

export const metadata = { title: 'Sources | Tracck' }

export default function SourcesPage() {
  return (
    <>
      <PageHeader title="Sources">
        A source is a place Tracck reads from, such as GitHub, a CV, or a portfolio. You choose what is
        imported, and nothing reaches a resume until you confirm it.
      </PageHeader>

      {/* Sources are listed only once they work, so there is nothing to connect yet. */}
      <EmptyState title="No sources can be added yet">
        Importing is still being built. CV upload and GitHub will appear here first.
      </EmptyState>
    </>
  )
}
