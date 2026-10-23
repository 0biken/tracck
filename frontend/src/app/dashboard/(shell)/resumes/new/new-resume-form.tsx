'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState, type FormEvent } from 'react'
import { ROLES, type ParseJobResponse, type PlanId, type ResumeLength, type RoleId, type SourceProvider, type SourceView } from '@tracck/shared'
import { Eyebrow } from '@/components/page-header'
import { ErrorNotice } from '@/components/sources/dialogs'
import { Tag } from '@/components/ui/badge'
import { Button, buttonClass } from '@/components/ui/button'
import { CheckField, SelectField, TextAreaField, TextField } from '@/components/ui/field'
import { Segmented } from '@/components/ui/segmented'
import { api } from '@/lib/api/client'
import { formatCount } from '@/lib/format'

const MAX = 15000
const MIN = 40

function Chips({ items }: { items: string[] }) {
  return items.length === 0 ? (
    <span className="text-sm text-ink-muted">None found</span>
  ) : (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <Tag key={item}>{item}</Tag>
      ))}
    </div>
  )
}

/** Paste a job, choose length, role and focus. The job is read as you type, so you can see what Tracck will look for. */
export function NewResumeForm({
  plan,
  defaultRole,
  sources,
  entries,
  atLimit,
  resetsOn,
}: {
  plan: PlanId
  defaultRole: RoleId | null
  sources: SourceView[]
  entries: Record<SourceProvider, number>
  atLimit: boolean
  resetsOn: string
}) {
  const router = useRouter()
  const [job, setJob] = useState('')
  const [company, setCompany] = useState('')
  const [focus, setFocus] = useState('')
  const [length, setLength] = useState<ResumeLength>('one_page')
  const [role, setRole] = useState<RoleId | ''>(defaultRole ?? '')
  const [roleTouched, setRoleTouched] = useState(false)
  const [reading, setReading] = useState<ParseJobResponse | null>(null)
  const [reads, setReads] = useState(false)
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const timer = useRef<number | undefined>(undefined)
  const ticket = useRef(0)

  const usable = sources.filter((source) => source.state !== 'problem' && source.provider !== 'manual')
  const manual = entries.manual > 0
  const providers = [...new Set(usable.map((source) => source.provider))]
  const [chosen, setChosen] = useState<Set<SourceProvider>>(
    () => new Set([...usable.filter((source) => source.state === 'ready').map((source) => source.provider), ...(manual ? (['manual'] as const) : [])]),
  )

  const tooShort = job.trim().length < MIN
  const noSource = chosen.size === 0
  const free = plan === 'free'
  const fullBlocked = length === 'full' && free

  /** Reads the job a moment after the person stops typing. */
  function edit(text: string) {
    setJob(text)
    window.clearTimeout(timer.current)
    if (text.trim().length < MIN) {
      setReading(null)
      return
    }
    timer.current = window.setTimeout(async () => {
      const mine = ++ticket.current
      setReads(true)
      try {
        const result = await api.resumes.parseJob(text)
        if (mine !== ticket.current) return
        setReading(result)
        if (!roleTouched && result.roleId) setRole(result.roleId)
      } catch {
        // Reading is a preview. The real reading happens when the resume is written.
      } finally {
        if (mine === ticket.current) setReads(false)
      }
    }, 700)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (tooShort || noSource || fullBlocked || atLimit) return
    setBusy(true)
    setError(null)
    try {
      const allReady = [...chosen].length === providers.filter((p) => usable.some((s) => s.provider === p && s.state === 'ready')).length + (manual ? 1 : 0)
      const created = await api.resumes.create({
        jobDescription: job.trim(),
        length,
        ...(company.trim() && { company: company.trim() }),
        ...(focus.trim() && { focus: focus.trim() }),
        ...(role && { roleId: role }),
        ...(!allReady && { sources: [...chosen] }),
      })
      router.push(`/dashboard/resumes/${created.resumeId}/generating`)
    } catch (failure) {
      setError(failure)
      setBusy(false)
    }
  }

  const toggle = (provider: SourceProvider, on: boolean) =>
    setChosen((current) => {
      const next = new Set(current)
      if (on) next.add(provider)
      else next.delete(provider)
      return next
    })

  const label = (provider: SourceProvider) => usable.find((source) => source.provider === provider)?.name ?? 'Manual entries'

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-start gap-10">
      <form onSubmit={submit} noValidate className="flex min-w-0 flex-col gap-7">
        {atLimit && (
          <div role="alert" className="border border-danger bg-danger-tint px-4 py-3 text-sm">
            You have used every resume your plan includes this month. They reset on {resetsOn}.{' '}
            <Link href="/dashboard/settings" className="font-semibold">
              See plans
            </Link>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor="jd" className="t-label">
              Job description
            </label>
            <span className="font-mono text-xs text-ink-muted" aria-live="polite">
              {formatCount(job.length)} / {formatCount(MAX)}
            </span>
          </div>
          <textarea
            id="jd"
            name="jd"
            rows={12}
            maxLength={MAX}
            value={job}
            onChange={(event) => edit(event.target.value)}
            aria-invalid={(touched && tooShort) || undefined}
            aria-describedby="jd-help"
            className="min-h-65 w-full resize-y rounded-sm border border-line-input bg-canvas px-3.5 py-3 text-[15px] leading-[22px] hover:border-ink aria-invalid:border-danger"
          />
          <span id="jd-help" className={`text-[13px] leading-[19px] ${touched && tooShort ? 'text-danger-ink' : 'text-ink-muted'}`}>
            {touched && tooShort ? 'Paste the whole job description to continue.' : 'Paste text only. Links are not read yet.'}
          </span>
        </div>

        <TextField id="company" label={<>Company <span className="font-normal text-ink-muted">(optional)</span></>} className="max-w-90" value={company} onChange={(event) => setCompany(event.target.value)} maxLength={120} />

        <div className="flex flex-col gap-2">
          <span className="t-label">Length</span>
          <Segmented
            label="Length"
            value={length}
            onChange={setLength}
            options={[
              { value: 'one_page', label: 'One page' },
              { value: 'full', label: 'Full' },
            ]}
            className="self-start"
          />
          {fullBlocked ? (
            <span className="text-[13px] leading-[19px] text-danger-ink">
              Full is on Pro. Your plan exports one page only. <Link href="/dashboard/settings">Upgrade</Link>
            </span>
          ) : (
            <span className="text-[13px] leading-[19px] text-ink-muted">
              {length === 'one_page' ? 'One page: fewer, stronger bullets chosen for this job.' : 'Full: every relevant entry, in as many pages as it takes.'}
            </span>
          )}
        </div>

        <SelectField
          id="role"
          label="Role"
          className="max-w-90"
          value={role}
          onChange={(event) => {
            setRole(event.target.value as RoleId | '')
            setRoleTouched(true)
          }}
          help="Detected from the job. Sets section order, wording and scoring."
        >
          <option value="">Let Tracck decide</option>
          {ROLES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
              {reading?.roleId === item.id ? ' (detected)' : ''}
            </option>
          ))}
        </SelectField>

        <TextAreaField
          id="focus"
          label={
            <>
              Focus <span className="font-normal text-ink-muted">(optional)</span>
            </>
          }
          rows={3}
          value={focus}
          onChange={(event) => setFocus(event.target.value)}
          maxLength={600}
          help="Your focus takes priority when choosing what to include."
        />

        <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0" aria-describedby={touched && noSource ? 'src-error' : undefined}>
          <legend className="t-label mb-2.5 p-0">Sources to use</legend>
          {providers.map((provider) => {
            const source = usable.find((s) => s.provider === provider)!
            const collecting = usable.filter((s) => s.provider === provider).every((s) => s.state === 'collecting')
            return collecting ? (
              <label key={provider} className="flex min-h-8 items-center gap-3 text-[15px] text-ink-muted">
                <input type="checkbox" disabled className="size-5 shrink-0" />
                {source.name} <span className="font-mono text-xs">STILL COLLECTING</span>
              </label>
            ) : (
              <CheckField key={provider} checked={chosen.has(provider)} onChange={(event) => toggle(provider, event.target.checked)} className="min-h-8 text-[15px]">
                {label(provider)} <span className="font-mono text-xs text-ink-muted">{entries[provider]} ENTRIES</span>
              </CheckField>
            )
          })}
          {manual && (
            <CheckField checked={chosen.has('manual')} onChange={(event) => toggle('manual', event.target.checked)} className="min-h-8 text-[15px]">
              Manual entries <span className="font-mono text-xs text-ink-muted">{entries.manual} ENTRIES</span>
            </CheckField>
          )}
          {providers.length === 0 && !manual && (
            <span className="text-sm text-ink-muted">
              No sources yet. <Link href="/dashboard/sources">Connect one</Link> first.
            </span>
          )}
          {touched && noSource && (
            <span id="src-error" className="text-[13px] text-danger-ink">
              Choose at least one source.
            </span>
          )}
        </fieldset>

        {error !== null && <ErrorNotice error={error} />}

        <div className="flex flex-wrap gap-3 border-t border-line pt-6">
          <Button type="submit" size="lg" loading={busy} disabled={atLimit || fullBlocked}>
            Generate resume
          </Button>
          <Link href="/dashboard" className={buttonClass('secondary', 'lg')}>
            Cancel
          </Link>
        </div>
      </form>

      <aside className="flex min-w-0 flex-col gap-5">
        <section className="flex flex-col gap-4 border border-line-strong bg-sunken p-6" aria-labelledby="read-job">
          <Eyebrow>
            <span id="read-job">Read from the job</span>
          </Eyebrow>
          {reading ? (
            <div className="flex flex-col gap-2.5">
              <div className="text-xs font-bold tracking-[0.08em]">REQUIRED</div>
              <Chips items={reading.required} />
              <div className="mt-1.5 text-xs font-bold tracking-[0.08em]">PREFERRED</div>
              <Chips items={reading.preferred} />
            </div>
          ) : (
            <p className="m-0 text-sm leading-5 text-ink-muted" aria-live="polite">
              {reads ? 'Reading the job…' : 'Paste the job and the skills it asks for show up here.'}
            </p>
          )}
        </section>

        <section className="flex flex-col gap-3 border border-line p-6" aria-labelledby="next">
          <Eyebrow>
            <span id="next">What happens next</span>
          </Eyebrow>
          <ol className="m-0 flex list-decimal flex-col gap-2 pl-5 text-[15px] leading-[22px]">
            <li>Reading the job</li>
            <li>Finding your evidence</li>
            <li>Writing</li>
            <li>Checking every claim against your entries</li>
          </ol>
          <span className="text-[13px] leading-[19px] text-ink-muted">You can leave while it runs; we tell you when it is ready.</span>
        </section>
      </aside>
    </div>
  )
}
