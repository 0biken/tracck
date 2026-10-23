'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { KEY_SCOPES, type ApiKeyView, type ClientView, type CreatedKeyResponse, type KeyScope } from '@tracck/shared'
import { ErrorNotice } from '@/components/sources/dialogs'
import { Tag } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { CheckField, SelectField, TextField } from '@/components/ui/field'
import { ScrollTable, tdClass, thClass } from '@/components/ui/table'
import { api } from '@/lib/api/client'
import { formatDate, formatStamp } from '@/lib/format'

const EXPIRES: Record<string, number | null> = { Never: null, '90 days': 90, '1 year': 365 }

/** What the person sees once: a secret that cannot be shown again. */
type Shown = { title: string; label: string; secret: string; environment: string; scopes: KeyScope[]; limit: number; kind: 'key' | 'webhook'; note?: string }

const noteFor = (key: ApiKeyView) =>
  key.state === 'rotating'
    ? `OLD KEY STOPS ${formatStamp(key.stopsAt)} UTC`
    : key.state === 'revoked'
      ? key.revokedAt
        ? `REVOKED ${formatDate(key.revokedAt)}`
        : 'STOPPED'
      : `${key.mode === 'live' ? 'LIVE' : 'SANDBOX'} · CREATED ${formatDate(key.createdAt)}`

/** Create, rotate and revoke keys for one organisation. A key is shown once, then only its prefix remains. */
export function KeysManager({ client, initial }: { client: ClientView; initial: ApiKeyView[] }) {
  const router = useRouter()
  const [keys, setKeys] = useState(initial)
  const [revoking, setRevoking] = useState<ApiKeyView | null>(null)
  const [shown, setShown] = useState<Shown | null>(null)
  const [stored, setStored] = useState(false)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<unknown>(null)

  const [label, setLabel] = useState('')
  const [environment, setEnvironment] = useState<'live' | 'test'>('live')
  const [expires, setExpires] = useState('1 year')
  const [rate, setRate] = useState('60')
  const [quota, setQuota] = useState('')
  const [scopes, setScopes] = useState<KeyScope[]>(['generate:resume', 'read:resume'])
  const [touched, setTouched] = useState(false)
  const [hook, setHook] = useState('')

  const rateValid = /^\d+$/.test(rate) && Number(rate) > 0
  const quotaValid = quota === '' || (/^\d+$/.test(quota) && Number(quota) > 0)
  const labelValid = label.trim().length > 0
  const scopesValid = scopes.length > 0
  const suspended = client.status === 'suspended'

  async function reload() {
    setKeys(await api.admin.keys(client.id))
  }

  function reveal(created: CreatedKeyResponse) {
    setStored(false)
    setCopied(false)
    setShown({
      title: 'Key created',
      label: created.key.label,
      secret: created.secret,
      environment: created.key.mode === 'live' ? 'Production' : 'Sandbox',
      scopes: created.key.scopes,
      limit: created.key.rateLimitPerMin,
      kind: 'key',
    })
  }

  async function run<T>(name: string, task: () => Promise<T>): Promise<T | undefined> {
    setBusy(name)
    setError(null)
    try {
      return await task()
    } catch (failure) {
      setError(failure)
      return undefined
    } finally {
      setBusy(null)
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (!rateValid || !labelValid || !scopesValid || !quotaValid) return
    const created = await run('create', () =>
      api.admin.createKey(client.id, {
        label: label.trim(),
        mode: environment,
        scopes,
        rateLimitPerMin: Number(rate),
        monthlyQuota: quota === '' ? null : Number(quota),
        expiresInDays: EXPIRES[expires],
      }),
    )
    if (created) {
      reveal(created)
      setLabel('')
      setTouched(false)
      await reload()
    }
  }

  async function rotate(key: ApiKeyView) {
    const created = await run(`rotate-${key.id}`, () => api.admin.rotateKey(client.id, key.id))
    if (created) {
      reveal(created)
      await reload()
    }
  }

  async function revoke(key: ApiKeyView) {
    const done = await run('revoke', () => api.admin.revokeKey(client.id, key.id).then(() => true))
    if (done) {
      setRevoking(null)
      await reload()
    }
  }

  async function saveWebhook() {
    const saved = await run('webhook', () => api.admin.setWebhook(client.id, hook.trim()))
    if (saved) {
      setStored(false)
      setCopied(false)
      setShown({
        title: 'Webhook saved',
        label: new URL(saved.url).host,
        secret: saved.secret,
        environment: 'Webhook signing secret',
        scopes: [],
        limit: 0,
        kind: 'webhook',
        note: 'Check the Tracck-Signature header of each delivery against this secret.',
      })
      setHook('')
    }
  }

  async function toggleSuspended() {
    const updated = await run('suspend', () => api.admin.updateClient(client.id, { status: suspended ? 'active' : 'suspended' }))
    if (updated) router.refresh()
  }

  async function copy() {
    if (!shown) return
    try {
      await navigator.clipboard.writeText(shown.secret)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <>
      {error !== null && <ErrorNotice error={error} />}
      {suspended && (
        <p role="status" className="m-0 border border-danger bg-danger-tint px-4 py-3 text-sm">
          {client.name} is suspended: every key is refused and no new keys can be made.
        </p>
      )}

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
                  <div className="mt-1 font-mono text-[11px] text-ink-muted">{noteFor(key)}</div>
                </td>
                <td className={`${tdClass} align-top font-mono text-[13px] ${revokedRow ? 'line-through' : ''}`}>{key.display}</td>
                <td className={`${tdClass} align-top`}>
                  {key.scopes.length && !revokedRow ? (
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
                  {revokedRow ? (
                    '—'
                  ) : (
                    <>
                      <div>{key.rateLimitPerMin} / min</div>
                      <div>{key.monthlyQuota ? `${key.monthlyQuota} / month` : 'org quota'}</div>
                    </>
                  )}
                </td>
                <td className={`${tdClass} align-top font-mono text-xs`}>
                  {key.lastUsedAt ? formatStamp(key.lastUsedAt) : 'Never'}
                  {key.lastUsedIp && <div className="text-ink-muted">{key.lastUsedIp}</div>}
                </td>
                <td className={`${tdClass} align-top font-mono text-xs`}>{key.expiresAt ? formatDate(key.expiresAt) : revokedRow ? '—' : 'Never'}</td>
                <td className={`${tdClass} align-top`}>
                  {revokedRow ? null : (
                    <div className="flex gap-1.5">
                      {key.state === 'active' && (
                        <Button size="sm" variant="secondary" loading={busy === `rotate-${key.id}`} disabled={suspended} onClick={() => rotate(key)}>
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
          {keys.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-6 text-center text-[15px] text-ink-muted">
                No keys yet. Create the first one below.
              </td>
            </tr>
          )}
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
              placeholder="Careers portal"
              error={touched && !labelValid ? 'Give the key a label.' : undefined}
            />
            <SelectField id="key-env" label="Environment" value={environment} onChange={(event) => setEnvironment(event.target.value as 'live' | 'test')}>
              <option value="live">Production</option>
              <option value="test">Sandbox (synthetic data)</option>
            </SelectField>
            <SelectField id="key-exp" label="Expires" value={expires} onChange={(event) => setExpires(event.target.value)}>
              {Object.keys(EXPIRES).map((option) => (
                <option key={option}>{option}</option>
              ))}
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
            <TextField
              id="key-quota"
              label="Monthly quota for this key"
              inputMode="numeric"
              value={quota}
              placeholder="Organisation quota"
              onChange={(event) => setQuota(event.target.value)}
              error={touched && !quotaValid ? 'Leave empty, or enter a whole number above zero.' : undefined}
              className="[&_input]:font-mono"
            />
          </div>

          <fieldset className="m-0 flex flex-wrap gap-x-6 gap-y-2 border-0 p-0">
            <legend className="t-label mb-2.5 p-0">Scopes · grant only what this integration needs</legend>
            {KEY_SCOPES.map((scope) => (
              <CheckField
                key={scope}
                checked={scopes.includes(scope)}
                onChange={(event) => setScopes(event.target.checked ? [...scopes, scope] : scopes.filter((item) => item !== scope))}
                className="min-h-8 font-mono text-sm"
              >
                {scope}
              </CheckField>
            ))}
            {touched && !scopesValid && <span className="w-full text-[13px] text-danger-ink">Choose at least one scope.</span>}
          </fieldset>
          <p className="m-0 text-[13px] leading-[19px] text-ink-muted">
            Any key reads a student&apos;s data only after that student consents. A valid key alone grants nothing.
          </p>
          <div>
            <Button type="submit" loading={busy === 'create'} disabled={suspended}>
              Create key
            </Button>
          </div>
        </form>
      </section>

      <section aria-labelledby="wh" className="flex flex-col gap-4 border border-line p-6">
        <h2 id="wh" className="t-claim m-0">
          Webhook
        </h2>
        <p className="m-0 text-[15px] leading-[22px] text-ink-muted">
          Where Tracck tells {client.name} a resume is ready. Deliveries are signed with a secret shown once. Saving a new address
          issues a new secret.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <TextField
            id="webhook-url"
            label="Address (https only)"
            type="url"
            value={hook}
            onChange={(event) => setHook(event.target.value)}
            placeholder="https://example.edu.ng/hooks/tracck"
            className="min-w-0 flex-[1_1_320px]"
          />
          <Button variant="secondary" loading={busy === 'webhook'} disabled={!/^https:\/\/.+/.test(hook.trim())} onClick={saveWebhook}>
            Save webhook
          </Button>
        </div>
      </section>

      <div>
        <Button variant={suspended ? 'secondary' : 'danger'} loading={busy === 'suspend'} onClick={toggleSuspended}>
          {suspended ? `Reactivate ${client.name}` : `Suspend ${client.name}`}
        </Button>
      </div>

      <Dialog open={shown !== null} onClose={() => stored && setShown(null)} closable={stored} tone="inverse" size="lg" title={shown?.title ?? 'Created'}>
        {shown && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2 pr-8">
              <div className="font-mono text-xs tracking-[0.16em] text-inverse-muted">
                {shown.kind === 'key' ? 'KEY CREATED' : 'WEBHOOK SAVED'} · {formatStamp(new Date().toISOString())} UTC
              </div>
              <h2 className="m-0 font-display text-[28px] font-bold leading-[34px]">Copy this {shown.kind === 'key' ? 'key' : 'secret'} now</h2>
              <p className="m-0 text-base leading-6 text-inverse-muted">
                This is the only time it is shown. Tracck keeps {shown.kind === 'key' ? 'a hash and the prefix' : 'it encrypted, and cannot show it again'}. If you lose
                it, {shown.kind === 'key' ? 'create a new key' : 'save the webhook again to get a new one'}.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold">
                {shown.label} · {shown.environment}
              </span>
              <div className="flex flex-wrap items-stretch gap-2">
                <code className="min-w-0 flex-[1_1_300px] break-all border border-inverse-line bg-black/10 px-3.5 py-3 font-mono text-sm leading-5">
                  {shown.secret}
                </code>
                <Button variant="inverse" onClick={copy}>
                  {copied ? 'Copied' : shown.kind === 'key' ? 'Copy key' : 'Copy secret'}
                </Button>
              </div>
            </div>

            {shown.kind === 'key' ? (
              <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-3 border-t border-inverse-line pt-5 font-mono text-[13px]">
                <dt className="text-inverse-muted">SCOPES</dt>
                <dd className="m-0">{shown.scopes.join(', ')}</dd>
                <dt className="text-inverse-muted">LIMITS</dt>
                <dd className="m-0">{shown.limit} / min</dd>
                <dt className="text-inverse-muted">CONSENT</dt>
                <dd className="m-0">Required per student</dd>
              </dl>
            ) : (
              shown.note && <p className="m-0 border-t border-inverse-line pt-5 text-sm text-inverse-muted">{shown.note}</p>
            )}

            <label className="flex cursor-pointer items-center gap-2.5 text-[15px]">
              <input
                type="checkbox"
                checked={stored}
                onChange={(event) => setStored(event.target.checked)}
                className="size-[18px] accent-[var(--signal-on-inverse)]"
              />
              I have stored this somewhere safe
            </label>
            <div className="flex justify-end">
              <Button variant="inverse" onClick={() => setShown(null)} disabled={!stored}>
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
              Requests using <span className="font-mono">{revoking.display}</span> fail immediately. This cannot be undone.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="danger-solid" loading={busy === 'revoke'} onClick={() => revoke(revoking)}>
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
