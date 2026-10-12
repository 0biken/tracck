import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/ui/skeleton'

export const metadata = { title: 'Roles | Tracck' }

export default function RolesPage() {
  return (
    <>
      <PageHeader title="Roles">
        A role is a job you are aiming for. Tracck reads the job description, shows which requirements
        your record covers, and builds a resume for it.
      </PageHeader>

      <EmptyState title="No roles yet">
        Adding a role is still being built. You will be able to paste a job description here.
      </EmptyState>
    </>
  )
}
