import { PageHeader } from '@/components/page-header'
import { serverApi } from '@/lib/api/server'
import { ClientPicker } from '../client-picker'
import { loadClients } from '../clients'
import { KeysManager } from './keys-manager'

export const metadata = { title: 'API keys' }

export default async function OrgKeysPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const { clients, current } = await loadClients((await searchParams).client)
  const keys = current ? await serverApi().admin.keys(current.id) : []

  return (
    <>
      <PageHeader
        eyebrow={current ? `${current.name} · ${current.status} · monthly quota ${current.monthlyQuota}` : 'No organisation yet'}
        title="API keys"
        actions={<ClientPicker clients={clients} current={current?.id ?? null} />}
      >
        Keys belong to one organisation and can reach only its data. A key is shown once; Tracck stores a hash and the prefix.
      </PageHeader>
      {current ? (
        <KeysManager key={current.id} client={current} initial={keys} />
      ) : (
        <p className="m-0 border border-line p-6 text-[15px] text-ink-muted">
          Add the first organisation to create keys. Use &ldquo;New organisation&rdquo; above.
        </p>
      )}
    </>
  )
}
