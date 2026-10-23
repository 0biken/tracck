'use client'

import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import type { ConsentRequestView, KeyScope } from '@tracck/shared'
import { ErrorNotice } from '@/components/sources/dialogs'
import { Button, buttonClass } from '@/components/ui/button'
import { api } from '@/lib/api/client'
import { formatDate } from '@/lib/format'

function Frame({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <div className="flex w-full max-w-140 flex-col gap-5 border-t-2 border-ink pt-7">
      <div className="t-eyebrow text-ink-muted">{eyebrow}</div>
      <h1 className="t-h2 m-0 text-balance">{title}</h1>
      {children}
    </div>
  )
}

const STATUS_COPY = {
  granted: 'You already answered this request and allowed access. You can take it back any time in Settings.',
  denied: 'You already declined this request. Nothing was shared.',
  expired: 'This request has expired. Ask the organisation to send a new link if you still want to share.',
} as const

/** A student chooses exactly what an organisation may do. Nothing is shared until they allow it. */
export function ConsentForm({ token, request, email }: { token: string; request: ConsentRequestView | null; email: string | null }) {
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries((request?.scopes ?? []).map((scope) => [scope.id, true])))
  const [busy, setBusy] = useState<'allow' | 'deny' | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [outcome, setOutcome] = useState<'allowed' | 'denied' | null>(null)

  if (!request) {
    return (
      <Frame eyebrow="ACCESS REQUEST" title="This link is not valid">
        <p className="m-0 text-base leading-6 text-ink-muted">
          It may have been copied incompletely. Ask the organisation to send the link again.
        </p>
        <div>
          <Link href="/" className={buttonClass('secondary', 'lg')}>
            Go to Tracck
          </Link>
        </div>
      </Frame>
    )
  }

  const org = request.orgName
  const chosen = request.scopes.filter((scope) => on[scope.id]).map((scope) => scope.id as KeyScope)

  async function answer(kind: 'allow' | 'deny') {
    setBusy(kind)
    setError(null)
    try {
      if (kind === 'allow') await api.consent.grant(token, chosen)
      else await api.consent.deny(token)
      setOutcome(kind === 'allow' ? 'allowed' : 'denied')
    } catch (failure) {
      setError(failure)
    } finally {
      setBusy(null)
    }
  }

  if (outcome) {
    return (
      <Frame eyebrow="ACCESS REQUEST" title={outcome === 'allowed' ? `${org} now has the access you chose` : 'Request declined'}>
        <p className="m-0 text-base leading-6 text-ink-muted">
          {outcome === 'allowed'
            ? `${org} can use only what you allowed. You can take access back any time in Settings, under Organisations with access.`
            : `Nothing was shared with ${org}.`}
        </p>
        <div>
          <Link href="/dashboard/settings" className={buttonClass('primary', 'lg')}>
            Open settings
          </Link>
        </div>
      </Frame>
    )
  }

  if (request.status !== 'pending') {
    return (
      <Frame eyebrow={`ACCESS REQUEST · ${formatDate(request.requestedAt)}`} title={`${org} asked for access`}>
        <p className="m-0 text-base leading-6 text-ink-muted">{STATUS_COPY[request.status]}</p>
      </Frame>
    )
  }

  return (
    <Frame eyebrow={`ACCESS REQUEST · ${formatDate(request.requestedAt)}`} title={`${org} wants access to your Tracck record`}>
      <p className="m-0 text-base leading-6 text-ink-muted">
        {email ? `Signed in as ${email}. ` : ''}Choose what {org} may do. Nothing is shared until you allow it.
      </p>

      <fieldset className="m-0 border-0 border-t border-line p-0" disabled={!email}>
        <legend className="sr-only">Permissions</legend>
        {request.scopes.map((scope) => (
          <label key={scope.id} className="grid cursor-pointer grid-cols-[24px_minmax(0,1fr)] gap-3 border-b border-line py-4">
            <input
              type="checkbox"
              checked={on[scope.id] ?? false}
              onChange={(event) => setOn({ ...on, [scope.id]: event.target.checked })}
              className="mt-0.5 size-5 cursor-pointer accent-ink"
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-semibold">{scope.label}</span>
              <span className="font-mono text-xs text-ink-muted">{scope.id}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-1.5 border border-line-strong bg-sunken p-4 text-sm leading-[21px]">
        <strong>{org} will not be able to</strong>
        <span>
          See your uploaded CV, your sources or your account details. Pass your data to recruiters or job boards beyond these
          permissions.
        </span>
      </div>
      <span className="text-sm leading-[21px] text-ink-muted">
        You can revoke access any time in Settings › Organisations with access. This request expires {formatDate(request.expiresAt)}.
      </span>

      {error !== null && <ErrorNotice error={error} />}

      {email ? (
        <div className="flex flex-wrap gap-3">
          <Button size="lg" loading={busy === 'allow'} disabled={chosen.length === 0 || busy === 'deny'} onClick={() => answer('allow')}>
            Allow selected
          </Button>
          <Button size="lg" variant="secondary" loading={busy === 'deny'} disabled={busy === 'allow'} onClick={() => answer('deny')}>
            Deny
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-[15px] leading-[22px]">Sign in to answer. You will come back to this page.</p>
          <div className="flex flex-wrap gap-3">
            <Link href={`/login?next=${encodeURIComponent(`/consent/${token}`)}`} className={buttonClass('primary', 'lg')}>
              Log in
            </Link>
            <Link href="/signup" className={buttonClass('secondary', 'lg')}>
              Create an account
            </Link>
          </div>
        </div>
      )}
    </Frame>
  )
}
