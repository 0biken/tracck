import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/ui/skeleton'

export const metadata = { title: 'Resumes | Tracck' }

export default function ResumesPage() {
  return (
    <>
      <PageHeader title="Resumes">
        Every build and every edit is saved as a version, so you can always go back.
      </PageHeader>

      <EmptyState title="No resumes yet">
        Resumes you build for a role are listed here, with each version.
      </EmptyState>
    </>
  )
}
