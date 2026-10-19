'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { SubmitButton } from '@/components/submit-button'
import { Alert } from '@/components/ui/alert'
import { buttonClass } from '@/components/ui/button'
import { SelectField, TextAreaField, TextField } from '@/components/ui/field'
import { ORG_TYPES, type WaitlistState } from '@/lib/waitlist'
import { joinWaitlist } from './actions'

const initial: WaitlistState = { status: 'idle' }

export function WaitlistForm() {
  const [state, action] = useActionState(joinWaitlist, initial)

  if (state.status === 'joined') {
    return (
      <div className="flex flex-col gap-5">
        <Alert tone="success" title="You are on the list">
          We will write to {state.email} when API access opens for your organisation.
        </Alert>
        <div>
          <Link href="/" className={buttonClass('secondary', 'md')}>
            Back to Tracck
          </Link>
        </div>
      </div>
    )
  }

  const error = state.status === 'error' ? state : null
  const value = (key: string) => error?.values[key] ?? ''

  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      {error?.message && (
        <Alert tone="danger" title="Not sent">
          {error.message}
        </Alert>
      )}

      <TextField
        id="org_name"
        label="Organisation"
        size="lg"
        autoComplete="organization"
        defaultValue={value('org_name')}
        error={error?.fields.org_name}
        required
      />
      <SelectField
        // Remounted with the returned value: React resets uncontrolled forms after an action.
        key={value('org_type')}
        id="org_type"
        label="Type of organisation"
        size="lg"
        defaultValue={value('org_type')}
        error={error?.fields.org_type}
        required
      >
        <option value="">Choose one</option>
        {ORG_TYPES.map((type) => (
          <option key={type.value} value={type.value}>
            {type.label}
          </option>
        ))}
      </SelectField>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          id="contact_name"
          label="Your name"
          size="lg"
          autoComplete="name"
          defaultValue={value('contact_name')}
          error={error?.fields.contact_name}
          required
        />
        <TextField
          id="email"
          label="Work email"
          type="email"
          size="lg"
          autoComplete="email"
          defaultValue={value('email')}
          error={error?.fields.email}
          required
        />
      </div>
      <TextField
        id="volume"
        label={
          <>
            Students or applicants per year <span className="font-normal text-ink-muted">(optional)</span>
          </>
        }
        size="lg"
        placeholder="e.g. about 3,000"
        defaultValue={value('volume')}
        maxLength={100}
      />
      <TextAreaField
        id="message"
        label={
          <>
            What would you use it for? <span className="font-normal text-ink-muted">(optional)</span>
          </>
        }
        rows={4}
        defaultValue={value('message')}
        maxLength={2000}
      />
      <div className="flex flex-col gap-3">
        <SubmitButton size="lg" className="self-start">
          Join the waitlist
        </SubmitButton>
        <p className="m-0 text-[13px] leading-[19px] text-ink-muted">
          We use this only to contact you about API access. See the <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </div>
    </form>
  )
}
