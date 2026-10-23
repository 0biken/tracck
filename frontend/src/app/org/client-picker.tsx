'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import type { ClientView } from '@tracck/shared'
import { ErrorNotice } from '@/components/sources/dialogs'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { BareSelect, TextField } from '@/components/ui/field'
import { api } from '@/lib/api/client'

/** Which organisation the console is showing, and a way to add a new one. */
export function ClientPicker({ clients, current }: { clients: ClientView[]; current: string | null }) {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  async function create(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const client = await api.admin.createClient({ name: name.trim(), ...(email.trim() && { contactEmail: email.trim() }) })
      setOpen(false)
      setName('')
      setEmail('')
      router.push(`${pathname}?client=${client.id}`)
      router.refresh()
    } catch (failure) {
      setError(failure)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {clients.length > 0 && (
          <BareSelect
            aria-label="Organisation"
            value={current ?? ''}
            onChange={(event) => router.push(`${pathname}?client=${event.target.value}`)}
            className="w-56"
          >
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
                {client.status === 'suspended' ? ' (suspended)' : ''}
              </option>
            ))}
          </BareSelect>
        )}
        <Button variant="secondary" className="min-h-10" onClick={() => setOpen(true)}>
          New organisation
        </Button>
      </div>

      <Dialog open={open} onClose={() => setOpen(false)} title="New organisation">
        <form onSubmit={create} className="flex flex-col gap-4 pr-8">
          <h2 className="t-claim m-0">New organisation</h2>
          <TextField id="org-name" label="Name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required />
          <TextField
            id="org-email"
            label="Contact email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            help="Optional. Where Tracck reaches the people who run the integration."
          />
          {error !== null && <ErrorNotice error={error} />}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={busy} disabled={name.trim().length < 2}>
              Create organisation
            </Button>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  )
}
