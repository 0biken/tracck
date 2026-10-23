'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import type { MeView } from '@tracck/shared'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { TextField } from '@/components/ui/field'
import { api, messageOf } from '@/lib/api/client'

// Matches the API rule: digits with optional spaces, brackets and dashes, and a leading plus.
const PHONE = /^\+?[0-9 ()-]{7,20}$/

const optional = (value: string) => value.trim() || null

/** Name and email come from signup. The rest is what a resume shows, so it is asked for once, here. */
export function DetailsForm({ me }: { me: MeView }) {
  const router = useRouter()
  const [phone, setPhone] = useState(me.phone ?? '')
  const [location, setLocation] = useState(me.location ?? '')
  const [address, setAddress] = useState(me.address ?? '')
  const [dateOfBirth, setDateOfBirth] = useState(me.dateOfBirth ?? '')
  const [nationality, setNationality] = useState(me.nationality ?? '')
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const phoneError = PHONE.test(phone.trim()) ? undefined : 'Enter a phone number, with the country code if you have one.'
  const locationError = location.trim() ? undefined : 'Enter the city you live in.'

  async function save(event: FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (phoneError || locationError) return
    setSaving(true)
    setError(null)
    try {
      await api.me.update({
        phone: phone.trim(),
        location: location.trim(),
        address: optional(address),
        dateOfBirth: optional(dateOfBirth),
        nationality: optional(nationality),
      })
      router.push('/onboarding/sources')
    } catch (failure) {
      setError(messageOf(failure))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} noValidate className="grid max-w-180 gap-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <TextField id="name" label="Full name" value={me.name ?? ''} readOnly help="From your signup. Change it in settings." />
        <TextField id="email" label="Email" value={me.email ?? ''} readOnly help="Your sign-in email." />
        <TextField
          id="phone"
          label="Phone"
          type="tel"
          autoComplete="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          error={touched ? phoneError : undefined}
          maxLength={20}
        />
        <TextField
          id="location"
          label="City and country"
          autoComplete="address-level2"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          error={touched ? locationError : undefined}
          maxLength={120}
        />
      </div>

      <div className="border-t border-line pt-6">
        <span className="mb-4 block font-mono text-xs tracking-[0.12em] text-ink-muted">OPTIONAL · SHOWN ONLY IF FILLED IN</span>
        <div className="grid gap-6 sm:grid-cols-2">
          <TextField
            id="address"
            label="Street address"
            autoComplete="street-address"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            maxLength={200}
            className="sm:col-span-2"
          />
          <TextField id="dateOfBirth" label="Date of birth" type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} />
          <TextField id="nationality" label="Nationality" value={nationality} onChange={(event) => setNationality(event.target.value)} maxLength={60} />
        </div>
      </div>

      {error && (
        <Alert tone="danger" title="We could not save your details">
          {error}
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
        <span className="text-sm text-ink-muted">You can change these any time in settings.</span>
        <Button type="submit" size="lg" loading={saving}>
          Continue
        </Button>
      </div>
    </form>
  )
}
