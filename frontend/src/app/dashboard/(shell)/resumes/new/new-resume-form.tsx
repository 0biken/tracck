'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { Button, buttonClass } from '@/components/ui/button'
import { CheckField, SelectField, TextAreaField } from '@/components/ui/field'
import { Segmented } from '@/components/ui/segmented'
import { Tag } from '@/components/ui/badge'
import { Eyebrow } from '@/components/page-header'
import { ACCOUNT, ROLES } from '@/lib/mock/account'
import { JOB_DESCRIPTION, JOB_FOCUS, JOB_READING } from '@/lib/mock/resumes'

const MAX = 15000

function formatCount(n: number) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function Chips({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <Tag key={item}>{item}</Tag>
      ))}
    </div>
  )
}

/**
 * Paste a job, choose length, role and focus. The sample job below is
 * prefilled; generation is not wired yet, so submitting opens the sample resume.
 */
export function NewResumeForm() {
  const router = useRouter()
  const [job, setJob] = useState(JOB_DESCRIPTION)
  const [length, setLength] = useState<'one' | 'full'>('one')
  const [sources, setSources] = useState({ github: true, cv: true })
  const [touched, setTouched] = useState(false)

  const isSample = job === JOB_DESCRIPTION
  const empty = job.trim().length === 0
  const noSource = !sources.github && !sources.cv
  const freePlan = true

  function submit(event: FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (empty || noSource) return
    router.push('/dashboard/resumes/kora-payments/generating')
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-start gap-10">
      <form onSubmit={submit} noValidate className="flex min-w-0 flex-col gap-7">
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor="jd" className="t-label">
              Job description
            </label>
            <span className="font-mono text-xs text-ink-muted" aria-live="polite">
              {formatCount(job.length)} / {formatCount(MAX)}
            </span>
          </div>
          <TextAreaFieldBare
            id="jd"
            value={job}
            onChange={setJob}
            invalid={touched && empty}
            describedBy="jd-help"
          />
          <span id="jd-help" className={`text-[13px] leading-[19px] ${touched && empty ? 'text-danger-ink' : 'text-ink-muted'}`}>
            {touched && empty ? 'Paste the job description to continue.' : 'Paste text only. Links are not read yet.'}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <span className="t-label" id="len-l">
            Length
          </span>
          <Segmented
            label="Length"
            value={length}
            onChange={setLength}
            options={[
              { value: 'one', label: 'One page' },
              { value: 'full', label: 'Full' },
            ]}
            className="self-start"
          />
          {length === 'full' && freePlan ? (
            <span className="text-[13px] leading-[19px] text-danger-ink">
              Full is on Pro. Your plan exports one page only. <Link href="/dashboard/settings">Upgrade</Link>
            </span>
          ) : (
            <span className="text-[13px] leading-[19px] text-ink-muted">
              One page: fewer, stronger bullets chosen for this job.
            </span>
          )}
        </div>

        <SelectField
          id="role"
          label="Role"
          className="max-w-90"
          defaultValue="dev"
          help="Detected from the job. Sets section order, wording and scoring."
        >
          {ROLES.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
              {role.id === 'dev' ? ' (detected)' : ''}
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
          defaultValue={JOB_FOCUS}
          help="Your focus takes priority when choosing what to include."
        />

        <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0" aria-describedby={touched && noSource ? 'src-error' : undefined}>
          <legend className="t-label mb-2.5 p-0">Sources to use</legend>
          <CheckField
            checked={sources.github}
            onChange={(event) => setSources({ ...sources, github: event.target.checked })}
            className="min-h-8 text-[15px]"
          >
            GitHub <span className="font-mono text-xs text-ink-muted">{ACCOUNT.bySource.github} ENTRIES</span>
          </CheckField>
          <CheckField
            checked={sources.cv}
            onChange={(event) => setSources({ ...sources, cv: event.target.checked })}
            className="min-h-8 text-[15px]"
          >
            CV <span className="font-mono text-xs text-ink-muted">{ACCOUNT.bySource.cv} ENTRIES</span>
          </CheckField>
          <label className="flex min-h-8 items-center gap-3 text-[15px] text-ink-muted">
            <input type="checkbox" disabled className="size-5 shrink-0" />
            LinkedIn export <span className="font-mono text-xs">STILL COLLECTING</span>
          </label>
          {touched && noSource && (
            <span id="src-error" className="text-[13px] text-danger-ink">
              Choose at least one source.
            </span>
          )}
        </fieldset>

        <div className="flex flex-wrap gap-3 border-t border-line pt-6">
          <Button type="submit" size="lg">
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
          {isSample ? (
            <div className="flex flex-col gap-2.5">
              <div className="text-xs font-bold tracking-[0.08em]">REQUIRED</div>
              <Chips items={JOB_READING.required} />
              <div className="mt-1.5 text-xs font-bold tracking-[0.08em]">PREFERRED</div>
              <Chips items={JOB_READING.preferred} />
            </div>
          ) : (
            <p className="m-0 text-sm leading-5 text-ink-muted">
              Requirements are read from your text when you generate.
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
            <li>Checking against your role</li>
            <li>Formatting to length</li>
          </ol>
          <span className="text-[13px] leading-[19px] text-ink-muted">
            Usually under 90 seconds. You can leave; we email you when it is ready.
          </span>
        </section>
      </aside>
    </div>
  )
}

/** The big job textarea. Kept here so the counter and the field share one value. */
function TextAreaFieldBare({
  id,
  value,
  onChange,
  invalid,
  describedBy,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  invalid: boolean
  describedBy: string
}) {
  return (
    <textarea
      id={id}
      name={id}
      rows={12}
      maxLength={MAX}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className="min-h-65 w-full resize-y rounded-sm border border-line-input bg-canvas px-3.5 py-3 text-[15px] leading-[22px] hover:border-ink aria-invalid:border-danger"
    />
  )
}
