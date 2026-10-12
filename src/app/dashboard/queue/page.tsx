import Link from 'next/link'
import { PageHeader } from '@/components/page-header'
import { buttonClass } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/skeleton'

export const metadata = { title: 'Review | Tracck' }

export default function ReviewPage() {
  return (
    <>
      <PageHeader title="Review">
        Confirm, edit, or reject the entries Tracck suggests. Each one shows the source it came from.
      </PageHeader>

      <EmptyState
        title="Nothing to review"
        action={
          <Link href="/dashboard/accounts" className={buttonClass('secondary', 'sm')}>
            Go to sources
          </Link>
        }
      >
        New entries from your sources show up here.
      </EmptyState>
    </>
  )
}
