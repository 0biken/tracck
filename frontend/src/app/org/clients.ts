import type { ClientView } from '@tracck/shared'
import { serverApi } from '@/lib/api/server'

/** The organisations to choose from, and the one the page is about (from `?client=`, else the newest). */
export async function loadClients(selected: string | undefined): Promise<{ clients: ClientView[]; current: ClientView | null }> {
  const clients = await serverApi().admin.clients()
  const current = clients.find((client) => client.id === selected) ?? clients[0] ?? null
  return { clients, current }
}
