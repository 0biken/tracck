import Link from 'next/link'
import { PageHeader } from '@/components/page-header'
import { buttonClass } from '@/components/ui/button'
import { serverApi } from '@/lib/api/server'
import { ResumesBrowser } from './resumes-browser'
import { DeleteAllResumes } from './delete-all'

export const metadata = { title: 'Resumes' }

export default async function ResumesPage() {
  const api = serverApi()
  const [page, summary] = await Promise.all([api.resumes.list(), api.me.summary()])

  return (
    <>
      <PageHeader
        eyebrow={`${summary.resumes} resumes · ${summary.exported} exported`}
        title="Resumes"
        actions={
          <Link href="/dashboard/resumes/new" className={buttonClass('primary', 'md')}>
            New resume
          </Link>
        }
      />
      <ResumesBrowser initial={page} />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="m-0 text-sm text-ink-muted">
          Each resume is saved against its job description. Deleting a resume removes it and its job text permanently.
        </p>
        {summary.resumes > 0 && <DeleteAllResumes count={summary.resumes} />}
      </div>
    </>
  )
}
