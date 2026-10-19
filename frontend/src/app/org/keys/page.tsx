import { PageHeader } from '@/components/page-header'
import { MOCK_ORG } from '@/lib/mock/account'
import { KeysManager } from './keys-manager'

export const metadata = { title: 'API keys' }

export default function OrgKeysPage() {
  return (
    <>
      <PageHeader eyebrow={`${MOCK_ORG.name} · ${MOCK_ORG.plan} · client ${MOCK_ORG.clientId}`} title="API keys">
        Keys belong to this organisation only and can reach only its data. A key is shown once; Tracck stores a hash and
        the prefix.
      </PageHeader>
      <KeysManager />
    </>
  )
}
