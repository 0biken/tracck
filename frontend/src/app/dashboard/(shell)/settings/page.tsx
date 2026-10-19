import { PageHeader } from '@/components/page-header'
import { getViewer } from '@/lib/viewer'
import { SettingsForm } from './settings-form'

export const metadata = { title: 'Settings and plan' }

export default async function SettingsPage() {
  const viewer = await getViewer()

  return (
    <div className="flex flex-col">
      <PageHeader eyebrow="Account · Free plan" title="Settings and plan" />
      <SettingsForm name={viewer.name} email={viewer.email} />
    </div>
  )
}
