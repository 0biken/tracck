'use client'

import Link from 'next/link'
import { useState } from 'react'
import { buttonClass } from '@/components/ui/button'
import { CONSENT_REQUEST } from '@/lib/mock/org'

/** A student chooses exactly what an organisation may do. Nothing is shared until they allow it. */
export function ConsentForm({ email }: { email: string }) {
  const [on, setOn] = useState<Record<string, boolean>>(
    Object.fromEntries(CONSENT_REQUEST.scopes.map((scope) => [scope.id, scope.on])),
  )
  const chosen = Object.values(on).some(Boolean)

  return (
    <div className="flex w-full max-w-140 flex-col gap-5 border-t-2 border-ink pt-7">
      <div className="t-eyebrow text-ink-muted">ACCESS REQUEST · {CONSENT_REQUEST.date}</div>
      <h1 className="t-h2 m-0 text-balance">{CONSENT_REQUEST.org} wants access to your Tracck record</h1>
      <p className="m-0 text-base leading-6 text-ink-muted">
        Signed in as {email}. Choose what {CONSENT_REQUEST.org} may do. Nothing is shared until you allow it.
      </p>

      <fieldset className="m-0 border-0 border-t border-line p-0">
        <legend className="sr-only">Permissions</legend>
        {CONSENT_REQUEST.scopes.map((scope) => (
          <label
            key={scope.id}
            className="grid cursor-pointer grid-cols-[24px_minmax(0,1fr)] gap-3 border-b border-line py-4"
          >
            <input
              type="checkbox"
              checked={on[scope.id]}
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
        <strong>{CONSENT_REQUEST.org} will not be able to</strong>
        <span>
          See your uploaded CV, your sources or your account details. Pass your data to recruiters or job boards beyond
          these permissions.
        </span>
      </div>
      <span className="text-sm leading-[21px] text-ink-muted">
        You can revoke access any time in Settings › Organisations with access.
      </span>

      <div className="flex flex-wrap gap-3">
        {chosen ? (
          <Link href="/dashboard/settings" className={buttonClass('primary', 'lg')}>
            Allow selected
          </Link>
        ) : (
          <span aria-disabled="true" className={`${buttonClass('primary', 'lg')} opacity-50`}>
            Allow selected
          </span>
        )}
        <Link href="/dashboard/settings" className={buttonClass('secondary', 'lg')}>
          Deny
        </Link>
      </div>
    </div>
  )
}
