import { redirect } from 'next/navigation'
import { serverApi } from '@/lib/api/server'
import { ResumeEditor } from './resume-editor'

export const metadata = { title: 'Resume editor' }

export default async function ResumeEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const api = serverApi()
  const [resume, me] = await Promise.all([api.resumes.get(id), api.me.get()])

  // A resume that is still being written, or that failed, has nothing to edit yet.
  if (!resume.content) redirect(`/dashboard/resumes/${id}/generating`)

  return <ResumeEditor key={`${resume.id}:${resume.version}`} initial={resume} plan={me.plan} />
}
