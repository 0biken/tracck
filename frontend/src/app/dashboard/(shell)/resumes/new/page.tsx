import { Eyebrow } from '@/components/page-header'
import { ACCOUNT } from '@/lib/mock/account'
import { NewResumeForm } from './new-resume-form'

export const metadata = { title: 'New resume' }

export default function NewResumePage() {
  return (
    <>
      <div className="flex flex-col gap-2 border-b-2 border-ink pb-5">
        <Eyebrow>
          New resume · Uses {ACCOUNT.resumesUsed} of {ACCOUNT.resumesLimit} this month
        </Eyebrow>
        <h1 className="t-h2 m-0 text-balance">Paste the job. Tracck finds your evidence.</h1>
      </div>
      <NewResumeForm />
    </>
  )
}
