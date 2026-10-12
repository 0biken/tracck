import Link from 'next/link'
import { PageHeader } from '@/components/page-header'
import { SystemCheck } from '@/components/system-check'
import { buttonClass } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/skeleton'

export const metadata = { title: 'Overview | Tracck' }

export default function OverviewPage() {
  // The test job is a development tool, shown only when an API is configured.
  const apiUrl = process.env.NODE_ENV === 'production' ? undefined : process.env.NEXT_PUBLIC_API_URL

  return (
    <>
      <PageHeader title="Overview">
        Tracck builds resumes from work you can show. Every claim on a resume comes from an entry in
        your record, and every entry shows its source.
      </PageHeader>

      <div className="flex flex-col gap-6">
        <EmptyState
          title="Your record is empty"
          action={
            <Link href="/dashboard/accounts" className={buttonClass('primary', 'sm')}>
              Go to sources
            </Link>
          }
        >
          Entries appear here after you add a source and review what we find.
        </EmptyState>

        {apiUrl && <SystemCheck apiUrl={apiUrl} />}
      </div>
    </>
  )
}
