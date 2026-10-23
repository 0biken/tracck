'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ROLES, type RoleId } from '@tracck/shared'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { api, messageOf } from '@/lib/api/client'

/** Pick one or more roles. Each role has its own resume conventions. */
export function RolePicker({ initial }: { initial: RoleId[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<RoleId>>(new Set(initial))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle(id: RoleId) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      // Keep the catalogue order, so the first role listed is the primary one.
      await api.me.setRoles(ROLES.map((role) => role.id).filter((id) => selected.has(id)))
      router.push('/onboarding/sources')
    } catch (failure) {
      setError(messageOf(failure))
      setSaving(false)
    }
  }

  const count = selected.size

  return (
    <>
      <div
        role="group"
        aria-label="Roles"
        className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-4"
      >
        {ROLES.map((role) => {
          const on = selected.has(role.id)
          return (
            <button
              key={role.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(role.id)}
              className={`flex min-h-30 cursor-pointer flex-col items-start gap-2.5 rounded-md p-[22px] text-left text-ink ${
                on ? 'border-2 border-ink bg-sunken p-[21px]' : 'm-px border border-line-input bg-canvas hover:bg-sunken'
              }`}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="text-lg font-bold">{role.name}</span>
                <span className="font-mono text-xs tracking-[0.12em]">{on ? 'SELECTED' : ''}</span>
              </span>
              <span className="text-sm leading-[21px] text-ink-muted">
                Leads with {role.leads}. {role.emphasis}
              </span>
            </button>
          )
        })}
      </div>

      {error && (
        <Alert tone="danger" title="We could not save your roles">
          {error}
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
        <span className="font-mono text-[13px] text-ink-muted" role="status">
          {count} {count === 1 ? 'ROLE SELECTED' : 'ROLES SELECTED'}
        </span>
        <Button size="lg" disabled={count === 0} loading={saving} onClick={save}>
          Continue
        </Button>
      </div>
    </>
  )
}
