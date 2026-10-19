import Link from 'next/link'
import { PageHeader } from '@/components/page-header'
import { buttonClass } from '@/components/ui/button'
import { RESUMES } from '@/lib/mock/resumes'
import { ResumesBrowser } from './resumes-browser'

export const metadata = { title: 'Resumes' }

export default function ResumesPage() {
  const exported = RESUMES.filter((resume) => resume.status === 'exported').length

  return (
    <>
      <PageHeader
        eyebrow={`${RESUMES.length} resumes · ${exported} exported`}
        title="Resumes"
        actions={
          <Link href="/dashboard/resumes/new" className={buttonClass('primary', 'md')}>
            New resume
          </Link>
        }
      />
      <ResumesBrowser resumes={RESUMES} />
      <p className="m-0 text-sm text-ink-muted">
        Each resume is saved against its job description. Deleting a resume removes it and its job text permanently.
      </p>
    </>
  )
}
