import { notFound } from 'next/navigation'
import { getResume } from '@/lib/mock/resumes'
import { GeneratingView } from './generating-view'

export const metadata = { title: 'Generating' }

export default async function GeneratingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const resume = getResume(id)
  if (!resume) notFound()

  return (
    <GeneratingView
      resumeId={resume.id}
      lengthLabel={resume.length}
      eyebrow={`Resume for ${resume.company} · ${resume.length} · ${resume.role}`}
    />
  )
}
