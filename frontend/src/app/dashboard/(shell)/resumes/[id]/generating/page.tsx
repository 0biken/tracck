import { serverApi } from '@/lib/api/server'
import { LENGTH_LABEL, roleName } from '@/lib/resumes'
import { GeneratingView } from './generating-view'

export const metadata = { title: 'Generating' }

export default async function GeneratingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const resume = await serverApi().resumes.get(id)
  const eyebrow = ['Resume for ' + (resume.company || resume.title), LENGTH_LABEL[resume.length], roleName(resume.role)]
    .filter(Boolean)
    .join(' · ')

  return <GeneratingView resume={resume} eyebrow={eyebrow} />
}
