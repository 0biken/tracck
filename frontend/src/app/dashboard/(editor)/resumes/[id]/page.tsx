import { notFound } from 'next/navigation'
import { getResume } from '@/lib/mock/resumes'
import { ResumeEditor } from './resume-editor'

export const metadata = { title: 'Resume editor' }

export default async function ResumeEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const resume = getResume(id)
  if (!resume) notFound()

  return <ResumeEditor resume={resume} />
}
