import { Eyebrow } from '@/components/page-header'
import { serverApi } from '@/lib/api/server'
import { RolePicker } from './role-picker'

export const metadata = { title: 'Choose your role' }

export default async function OnboardRolePage() {
  const me = await serverApi().me.get()

  return (
    <>
      <div className="flex max-w-180 flex-col gap-3">
        <Eyebrow>Step 1 of 4</Eyebrow>
        <h1 className="t-h1 m-0 text-balance">What kind of work do you do?</h1>
        <p className="m-0 text-lg leading-7 text-ink-muted">
          Pick one or more. Each role has its own resume conventions: section order, verbs and what counts as strong.
          You can change this per job.
        </p>
      </div>
      <RolePicker initial={me.roles} />
    </>
  )
}
