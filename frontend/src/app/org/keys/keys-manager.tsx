'use client'

import { useState } from 'react'
import { Tag } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { CheckField, SelectField, TextField } from '@/components/ui/field'
import { ScrollTable, tdClass, thClass } from '@/components/ui/table'
import { ALL_SCOPES, API_KEYS, type ApiKey, type KeyScope } from '@/lib/mock/org'

function randomSecret(live: boolean) {
  const bytes = new Uint8Array(20)
  crypto.getRandomValues(bytes)
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `trk_${live ? 'live' : 'test'}_${hex}`
}

type Created = { secret: string; label: string; environment: 'Production' | 'Sandbox'; scopes: KeyScope[]; limit: number; expires: string }

const EXPIRES: Record<string, string> = { Never: 'Never', '90 days': '2027.01.10', '1 year': '2027.10.12' }

/** Create, rotate and revoke keys. A key is shown once, then only its prefix remains. */
export function KeysManager() {
  const [keys, setKeys] = useState<ApiKey[]>(API_KEYS)
  const [revoking, setRevoking] = useState<ApiKey | null>(null)
  const [created, setCreated] = useState<Created | null>(null)
  const [stored, setStored] = useState(false)
  const [copied, setCopied] = useState(false)

  const [label, setLabel] = useState('Careers portal')
  const [environment, setEnvironment] = useState<'Production' | 'Sandbox'>('Production')
  const [expires, setExpires] = useState('1 year')
  const [rate, setRate] = useState('60')
  const [scopes, setScopes] = useState<KeyScope[]>(['generate:resume', 'read:resume'])
  const [touched, setTouched] = useState(false)

  const rateValid = /^\d+$/.test(rate) && Number(rate) > 0
  const labelValid = label.trim().length > 0
  const scopesValid = scopes.length > 0

  function open(next: Created) {
    setStored(false)
    setCopied(false)
    setCreated(next)
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (!rateValid || !labelValid || !scopesValid) return
    open({
      secret: randomSecret(environment === 'Production'),
      label: label.trim(),
      environment,
      scopes,
      limit: Number(rate),
      expires: EXPIRES[expires],
    })
  }

  function finish() {
    if (!created) return
    setKeys((list) => [
      {
        id: `k${list.length + 1}`,
        label: created.label,
        note: `${created.environment === 'Production' ? 'LIVE' : 'SANDBOX'} · CREATED 2026.10.12`,
        prefix: `${created.secret.slice(0, 13)}…`,
        scopes: created.scopes,
        limits: [`${created.limit} / min`, 'plan quota'],
        lastUsed: 'Never',
        expires: created.expires,
        state: 'active',
      },
      ...list,
    ])
    setCreated(null)
  }

  function rotate(key: ApiKey) {
    setKeys((list) =>
      list.map((item) => (item.id === key.id ? { ...item, state: 'rotating', note: 'OLD KEY STOPS 2026.10.19' } : item)),
    )
    open({
      secret: randomSecret(key.prefix.startsWith('trk_live')),
      label: key.label,
      environment: key.prefix.startsWith('trk_live') ? 'Production' : 'Sandbox',
      scopes: key.scopes,
      limit: parseInt(key.limits[0] ?? '60', 10) || 60,
      expires: key.expires,
    })
  }

  function revoke(key: ApiKey) {
    setKeys((list) =>
      list.map((item) =>
        item.id === key.id
          ? { ...item, state: 'revoked', note: 'REVOKED 2026.10.12 BY F. LAWAL', scopes: [], limits: [], expires: '—' }
          : item,
      ),
    )
    setRevoking(null)
  }

  async function copy() {
    if (!created) return
    try {
      await navigator.clipboard.writeText(created.secret)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <>
      <ScrollTable caption="API keys" minWidth={980}>
        <thead>
          <tr>
            {['Label', 'Key', 'Scopes', 'Limits', 'Last used', 'Expires'].map((heading) => (
              <th key={heading} className={thClass}>
                {heading}
              </th>
            ))}
            <th className={thClass}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => {
            const revokedRow = key.state === 'revoked'
            return (
              <tr key={key.id} className={key.state === 'rotating' ? 'bg-sunken' : revokedRow ? 'text-ink-muted' : ''}>
                <td className={`${tdClass} align-top text-sm`}>
                  <div className="font-bold">{key.label}</div>
                  <div className="mt-1 font-mono text-[11px] text-ink-muted">{key.note}</div>
                </td>
                <td className={`${tdClass} align-top font-mono text-[13px] ${revokedRow ? 'line-through' : ''}`}>{key.prefix}</td>
                <td className={`${tdClass} align-top`}>
                  {key.scopes.length ? (
                    <div className="flex flex-wrap gap-1">
                      {key.scopes.map((scope) => (
                        <Tag key={scope} className="!px-1.5 !py-0.5 !text-[11px]">
                          {scope}
                        </Tag>
                      ))}
                    </div>
                  ) : (
                    '—'
                  )}
                </td>
                <td className={`${tdClass} align-top font-mono text-xs`}>
                  {key.limits.length ? key.limits.map((limit) => <div key={limit}>{limit}</div>) : '—'}
                </td>
                <td className={`${tdClass} align-top font-mono text-xs`}>
                  {key.lastUsed}
                  {key.lastUsedFrom && <div className="text-ink-muted">{key.lastUsedFrom}</div>}
                </td>
                <td className={`${tdClass} align-top font-mono text-xs`}>{key.expires}</td>
                <td className={`${tdClass} align-top`}>
                  {revokedRow ? null : (
                    <div className="flex gap-1.5">
                      {key.state === 'active' && (
                        <Button size="sm" variant="secondary" onClick={() => rotate(key)}>
                          Rotate
                        </Button>
                      )}
                      <Button size="sm" variant="danger" onClick={() => setRevoking(key)}>
                        {key.state === 'rotating' ? 'Revoke now' : 'Revoke'}
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </ScrollTable>

      <section aria-labelledby="nk" className="flex flex-col gap-5 border border-line p-6">
        <h2 id="nk" className="t-claim m-0">
          New key
        </h2>
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-4">
            <TextField
              id="key-label"
              label="Label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              error={touched && !labelValid ? 'Give the key a label.' : undefined}
            />
            <SelectField
              id="key-env"
              label="Environment"
              value={environment}
              onChange={(event) => setEnvironment(event.target.value as 'Production' | 'Sandbox')}
            >
              <option>Production</option>
              <option value="Sandbox">Sandbox (synthetic data)</option>
            </SelectField>
            <SelectField id="key-exp" label="Expires" value={expires} onChange={(event) => setExpires(event.target.value)}>
              <option>Never</option>
              <option>90 days</option>
              <option>1 year</option>
            </SelectField>
            <TextField
              id="key-rate"
              label="Rate limit per minute"
              inputMode="numeric"
              value={rate}
              onChange={(event) => setRate(event.target.value)}
              error={touched && !rateValid ? 'Enter a whole number above zero.' : undefined}
              className="[&_input]:font-mono"
            />
          </div>

          <fieldset className="m-0 flex flex-wrap gap-x-6 gap-y-2 border-0 p-0">
            <legend className="t-label mb-2.5 p-0">Scopes · grant only what this integration needs</legend>
            {ALL_SCOPES.map((scope) => (
              <CheckField
                key={scope}
                checked={scopes.includes(scope)}
                onChange={(event) =>
                  setScopes(event.target.checked ? [...scopes, scope] : scopes.filter((item) => item !== scope))
                }
                className="min-h-8 font-mono text-sm"
              >
                {scope}
              </CheckField>
            ))}
            {touched && !scopesValid && (
              <span className="w-full text-[13px] text-danger-ink">Choose at least one scope.</span>
            )}
          </fieldset>
          <p className="m-0 text-[13px] leading-[19px] text-ink-muted">
            Any key reads a student&apos;s data only after that student consents. A valid key alone grants nothing.
          </p>
          <div>
            <Button type="submit">Create key</Button>
          </div>
        </form>
      </section>

      <Dialog open={created !== null} onClose={() => stored && finish()} closable={stored} tone="inverse" size="lg" title="Key created">
        {created && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2 pr-8">
              <div className="font-mono text-xs tracking-[0.16em] text-inverse-muted">
                KEY CREATED · 2026.10.12 21:14 · F. LAWAL
              </div>
              <h2 className="m-0 font-display text-[28px] font-bold leading-[34px]">Copy this key now</h2>
              <p className="m-0 text-base leading-6 text-inverse-muted">
                This is the only time it is shown. Tracck keeps a hash and the prefix {created.secret.slice(0, 13)}. If you
                lose it, create a new one.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold">
                {created.label} · {created.environment}
              </span>
              <div className="flex flex-wrap items-stretch gap-2">
                <code className="min-w-0 flex-[1_1_300px] break-all border border-inverse-line bg-black/10 px-3.5 py-3 font-mono text-sm leading-5">
                  {created.secret}
                </code>
                <Button variant="inverse" onClick={copy}>
                  {copied ? 'Copied' : 'Copy key'}
                </Button>
              </div>
            </div>

            <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-3 border-t border-inverse-line pt-5 font-mono text-[13px]">
              <dt className="text-inverse-muted">SCOPES</dt>
              <dd className="m-0">{created.scopes.join(', ')}</dd>
              <dt className="text-inverse-muted">LIMITS</dt>
              <dd className="m-0">{created.limit} / min · plan quota</dd>
              <dt className="text-inverse-muted">EXPIRES</dt>
              <dd className="m-0">{created.expires}</dd>
              <dt className="text-inverse-muted">CONSENT</dt>
              <dd className="m-0">Required per student</dd>
            </dl>

            <label className="flex cursor-pointer items-center gap-2.5 text-[15px]">
              <input
                type="checkbox"
                checked={stored}
                onChange={(event) => setStored(event.target.checked)}
                className="size-[18px] accent-[var(--signal-on-inverse)]"
              />
              I have stored this key somewhere safe
            </label>
            <div className="flex justify-end">
              <Button variant="inverse" onClick={finish} disabled={!stored}>
                Done
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog open={revoking !== null} onClose={() => setRevoking(null)} title="Revoke key">
        {revoking && (
          <div className="flex flex-col gap-4 pr-8">
            <h2 className="t-claim m-0">Revoke {revoking.label}?</h2>
            <p className="m-0 text-[15px] leading-[22px] text-ink-muted">
              Requests using <span className="font-mono">{revoking.prefix}</span> fail immediately. This cannot be undone.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="danger-solid" onClick={() => revoke(revoking)}>
                Revoke key
              </Button>
              <Button variant="secondary" onClick={() => setRevoking(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  )
}
