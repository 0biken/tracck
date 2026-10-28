'use client'

import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Bullet, EditBulletRequest, EvidenceRef, PlanId, ResumeDetailView, ResumeSection } from '@tracck/shared'
import type { ComponentType } from 'react'
import { Markdown } from '@/components/markdown'
import { ErrorNotice } from '@/components/sources/dialogs'
import { TEMPLATE_RENDERERS } from '@/components/resumes/templates'
import type { TemplateProps } from '@/components/resumes/templates/classic-red'
import { Button, buttonClass } from '@/components/ui/button'
import { TabPanel, Tabs } from '@/components/ui/tabs'
import { api } from '@/lib/api/client'
import { ApiClientError } from '@/lib/api/errors'
import { apiBase } from '@/lib/api/transport'
import { formatDate, formatStamp } from '@/lib/format'
import { LENGTH_LABEL, roleName } from '@/lib/resumes'
import { useJob } from '@/lib/use-job'

type Tab = 'evidence' | 'match' | 'job'
type Format = 'pdf' | 'docx'

function allBullets(sections: ResumeSection[]) {
  return sections.flatMap((section) => (section.kind === 'groups' ? section.groups.flatMap((group) => group.bullets) : []))
}

/** Where a bullet sits: its section, group and place in the group. */
function locate(sections: ResumeSection[], id: string) {
  for (const [s, section] of sections.entries()) {
    if (section.kind !== 'groups') continue
    for (const [g, group] of section.groups.entries()) {
      const b = group.bullets.findIndex((bullet) => bullet.id === id)
      if (b !== -1) return { s, g, b }
    }
  }
  return null
}

export function ResumeEditor({ initial, plan }: { initial: ResumeDetailView; plan: PlanId }) {
  const router = useRouter()
  const [resume, setResume] = useState(initial)
  const content = resume.content!
  const [selectedId, setSelectedId] = useState<string | null>(() => allBullets(content.sections)[0]?.id ?? null)
  const [tab, setTab] = useState<Tab>('evidence')
  const [rewriting, setRewriting] = useState<string | null>(null)
  const [figure, setFigure] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [notice, setNotice] = useState<string | null>(null)
  /** The version to bring back if the last removal is undone. */
  const [undoTo, setUndoTo] = useState<number | null>(null)
  const panelRef = useRef<HTMLElement>(null)

  const bullets = useMemo(() => allBullets(content.sections), [content])
  const selected = bullets.find((bullet) => bullet.id === selectedId) ?? null
  const selectedLoc = selected ? locate(content.sections, selected.id) : null
  const match = resume.match
  const flagged = bullets.filter((bullet) => bullet.needsNumber)
  const name = resume.company || resume.title

  function select(id: string) {
    setSelectedId(id)
    setTab('evidence')
    setRewriting(null)
    setFigure('')
    // On phones the review panel sits below the page: bring it into view.
    if (window.matchMedia('(max-width: 1023px)').matches) {
      requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    }
  }

  /** Runs one change on the server. The reply is the new version of the resume, so what is on screen is what is saved. */
  async function save(change: () => Promise<ResumeDetailView>, after?: (next: ResumeDetailView) => void) {
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const next = await change()
      setResume(next)
      after?.(next)
    } catch (failure) {
      if (failure instanceof ApiClientError && failure.code === 'VERSION_CONFLICT') {
        setNotice(failure.message)
        router.refresh()
      } else {
        setError(failure)
      }
    } finally {
      setSaving(false)
    }
  }

  const edit = (bulletId: string, body: Omit<EditBulletRequest, 'version'>, after?: () => void) =>
    save(() => api.resumes.editBullet(resume.id, bulletId, { ...body, version: resume.version }), after)

  function addFigure() {
    if (!selected || !figure.trim()) return
    void edit(selected.id, { figure: figure.trim() }, () => setFigure(''))
  }

  function remove() {
    if (!selected) return
    const before = resume.version
    const neighbour = bullets.find((_, i, list) => list[i + 1]?.id === selected.id || list[i - 1]?.id === selected.id)
    void save(
      () => api.resumes.removeBullet(resume.id, selected.id, resume.version),
      () => {
        setUndoTo(before)
        setSelectedId(neighbour?.id ?? null)
        setRewriting(null)
      },
    )
  }

  function undoRemove() {
    if (undoTo === null) return
    void save(
      () => api.resumes.restoreBullet(resume.id, undoTo),
      () => setUndoTo(null),
    )
  }

  /** The template to draw with, or the plain document for resumes written before templates. */
  const Template = TEMPLATE_RENDERERS[content.templateId] as ComponentType<TemplateProps> | undefined

  /** A bullet as the editor shows it: a button that selects it for review. */
  function renderBullet(bullet: Bullet) {
    const isSelected = bullet.id === selectedId
    return (
      <button
        type="button"
        onClick={() => select(bullet.id)}
        aria-pressed={isSelected}
        data-selected={isSelected || undefined}
        data-flag={bullet.needsNumber || undefined}
        className={`-mx-1.5 block w-[calc(100%+12px)] cursor-pointer border-0 px-1.5 py-[3px] text-left font-[inherit] text-[12.5px] leading-[17px] text-[#141310] ${
          bullet.needsNumber
            ? 'bg-[#F6E1DC] outline outline-1 outline-[#C4432E]'
            : isSelected
              ? 'bg-[#E3EFE8] outline outline-1 outline-[#1F6F4A]'
              : 'bg-transparent hover:bg-[#F1EEE6]'
        } ${isSelected && bullet.needsNumber ? 'outline-2' : ''}`}
      >
        {bullet.text}
        {bullet.needsNumber && (
          <span data-flag-label className="ml-1 font-mono text-[10px] text-[#A63A26]">
            [CONFIRM A NUMBER]
          </span>
        )}
      </button>
    )
  }

  const tabs = [
    { value: 'evidence' as const, label: 'Evidence' },
    { value: 'match' as const, label: 'Match report' },
    { value: 'job' as const, label: 'Job' },
  ]

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-canvas">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6">
          <Link
            href="/dashboard/resumes"
            aria-label="Back to resumes"
            className="grid size-11 shrink-0 place-items-center rounded-md border border-line-input hover:bg-sunken"
          >
            <ChevronLeft className="size-5" strokeWidth={2} aria-hidden="true" />
          </Link>
          <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-0.5">
            <h1 className="m-0 truncate font-display text-[22px] font-bold leading-7">Resume for {name}</h1>
            <span className="truncate font-mono text-xs text-ink-muted" aria-live="polite">
              {[resume.title, roleName(resume.role), LENGTH_LABEL[resume.length]].filter(Boolean).join(' · ').toUpperCase()} ·{' '}
              {saving ? 'SAVING…' : `SAVED ${formatStamp(resume.savedAt)} UTC · VERSION ${resume.version}`}
            </span>
          </div>
          <Actions resume={resume} plan={plan} onError={setError} />
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        <main id="content" aria-label="Resume" className="flex min-w-0 flex-1 flex-col items-center gap-4 bg-sunken px-3 py-6 sm:p-8">
          <div className="flex w-full max-w-190 flex-wrap justify-between gap-3 font-mono text-xs text-ink-muted">
            <span>
              {resume.length === 'one_page' ? 'A4 · HELVETICA · ATS SAFE · ONE PAGE' : 'A4 · HELVETICA · ATS SAFE · FULL LENGTH'}
              {match?.fitsOnePage === false && ' · MAY RUN OVER ONE PAGE'}
            </span>
            <span>SELECT A BULLET TO SEE ITS EVIDENCE</span>
          </div>

          {(error !== null || notice) && (
            <div className="w-full max-w-190">
              {error !== null ? <ErrorNotice error={error} /> : <p role="status" className="m-0 border border-line-strong bg-canvas px-4 py-3 text-sm">{notice}</p>}
            </div>
          )}

          <article
            aria-label={`Resume for ${name}`}
            className="print-area box-border w-full max-w-190 border border-line-strong bg-white px-5 py-8 font-[Arial,Helvetica,sans-serif] text-[#141310] sm:px-[52px] sm:py-12"
          >
            {Template ? (
              <Template content={content} renderBullet={renderBullet} />
            ) : (
              <>
                <div className="text-2xl font-bold">{content.header.name}</div>
                <div className="mt-1 text-xs leading-[17px]">{(content.header.details ?? []).map((detail) => detail.value).join(' · ')}</div>

                {content.sections.map((section) => (
                  <section key={section.id} aria-label={section.heading.toLowerCase()}>
                    <h2 className="mb-1.5 mt-3.5 border-b border-[#141310] pb-[3px] text-[11.5px] font-bold tracking-[0.06em]">
                      {section.heading.toUpperCase()}
                    </h2>
                    {section.kind === 'text' ? (
                      <p className="m-0 text-[12.5px] leading-[17px]">{section.text}</p>
                    ) : (
                      section.groups.map((group) => (
                        <div key={group.id}>
                          {group.title && (
                            <div className="flex justify-between gap-4 text-[12.5px] font-bold">
                              <span>{group.title}</span>
                              <span>{group.year}</span>
                            </div>
                          )}
                          <ul className="mb-2 mt-1 list-disc pl-[18px]">
                            {group.bullets.map((bullet) => (
                              <li key={bullet.id} className="text-[12.5px] leading-[17px]">
                                {renderBullet(bullet)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))
                    )}
                  </section>
                ))}
              </>
            )}
          </article>
        </main>

        <aside
          ref={panelRef}
          aria-label="Review panel"
          className="flex w-full shrink-0 scroll-mt-2 flex-col border-t border-line bg-canvas lg:w-[26rem] lg:border-l lg:border-t-0 xl:w-[28rem]"
        >
          <Tabs idBase="review" label="Review" items={tabs} value={tab} onChange={setTab} />

          <TabPanel idBase="review" value="evidence" active={tab === 'evidence'}>
            <div className="flex flex-col gap-5 p-4 sm:p-6">
              {undoTo !== null && (
                <div role="status" className="flex flex-wrap items-center justify-between gap-2 border border-line-strong bg-sunken px-3.5 py-2.5 text-sm">
                  <span>Bullet removed.</span>
                  <button type="button" onClick={undoRemove} disabled={saving} className="min-h-9 cursor-pointer border-0 bg-transparent font-semibold underline">
                    Undo
                  </button>
                </div>
              )}

              {selected ? (
                <>
                  <div className="flex flex-col gap-1.5">
                    <div className="t-eyebrow text-ink-muted">Selected bullet</div>
                    {rewriting === selected.id ? (
                      <RewriteBox
                        key={selected.id}
                        initial={selected.text}
                        saving={saving}
                        onSave={(text) => edit(selected.id, { text }, () => setRewriting(null))}
                        onCancel={() => setRewriting(null)}
                      />
                    ) : (
                      <Markdown className="text-[15px] leading-[22px]">{selected.text}</Markdown>
                    )}
                  </div>

                  <Evidence bullet={selected} refs={content.evidenceRefs} />

                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => setRewriting(selected.id)} disabled={saving}>
                      Rewrite this bullet
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => void save(() => api.resumes.moveBullet(resume.id, selected.id, resume.version))}
                      disabled={saving || !selectedLoc || selectedLoc.b === 0}
                    >
                      Move up
                    </Button>
                    <Button variant="danger" onClick={remove} disabled={saving}>
                      Remove
                    </Button>
                  </div>

                  {selected.needsNumber && (
                    <div className="flex flex-col gap-2.5 border border-danger bg-danger-tint p-4">
                      <div className="font-bold text-danger-ink">Confirm a number</div>
                      <div className="text-sm leading-5">
                        &ldquo;{selected.text.split(' ').slice(0, 3).join(' ')}…&rdquo; would be stronger with a figure, but your evidence
                        has none. Tracck will not invent one.
                      </div>
                      <label htmlFor="figure" className="text-[13px] font-semibold">
                        By how much, in your own words
                      </label>
                      <input
                        id="figure"
                        value={figure}
                        maxLength={120}
                        onChange={(event) => setFigure(event.target.value)}
                        placeholder="e.g. from 18% to 9% over 2 months"
                        className="min-h-11 rounded-sm border border-line-input bg-canvas px-3 text-[15px] hover:border-ink"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={addFigure} disabled={!figure.trim() || saving}>
                          Add to bullet
                        </Button>
                        <Button variant="secondary" disabled={saving} onClick={() => void edit(selected.id, { keepWithoutFigure: true })}>
                          Keep without a number
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="m-0 text-[15px] leading-[22px] text-ink-muted">Select a bullet on the page to see the evidence behind it.</p>
              )}
            </div>
          </TabPanel>

          <TabPanel idBase="review" value="match" active={tab === 'match'}>
            <MatchTab resume={resume} flagged={flagged.length} />
          </TabPanel>

          <TabPanel idBase="review" value="job" active={tab === 'job'}>
            <div className="flex flex-col gap-3 p-4 sm:p-6">
              <div className="t-eyebrow text-ink-muted">Job description · saved {formatDate(resume.createdAt)}</div>
              <Markdown className="whitespace-pre-line border border-line bg-sunken p-4 text-sm leading-[22px]">{resume.job.description}</Markdown>
              {resume.job.focus && (
                <>
                  <div className="t-eyebrow mt-2 text-ink-muted">Your focus</div>
                  <div className="text-sm leading-[21px]">{resume.job.focus}</div>
                </>
              )}
            </div>
          </TabPanel>
        </aside>
      </div>
    </div>
  )
}

/** Regenerate and the two exports. An export is a background job; when it is done the file opens. */
function Actions({ resume, plan, onError }: { resume: ResumeDetailView; plan: PlanId; onError: (error: unknown) => void }) {
  const router = useRouter()
  const [regenerating, setRegenerating] = useState(false)
  const [exporting, setExporting] = useState<{ format: Format; jobId: string } | null>(null)
  const [starting, setStarting] = useState<Format | null>(null)

  async function regenerate() {
    setRegenerating(true)
    try {
      await api.resumes.regenerate(resume.id)
      router.push(`/dashboard/resumes/${resume.id}/generating`)
    } catch (failure) {
      onError(failure)
      setRegenerating(false)
    }
  }

  async function start(format: Format) {
    setStarting(format)
    try {
      const { jobId } = await api.resumes.export(resume.id, format)
      setExporting({ format, jobId })
    } catch (failure) {
      onError(failure)
    } finally {
      setStarting(null)
    }
  }

  const busy = (format: Format) => starting === format || exporting?.format === format

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" className="min-h-10" loading={regenerating} onClick={regenerate}>
        Regenerate
      </Button>
      {plan === 'pro' ? (
        <Button variant="secondary" className="min-h-10" loading={busy('docx')} onClick={() => start('docx')}>
          Export DOCX
        </Button>
      ) : (
        <Link href="/dashboard/settings" className={buttonClass('secondary', 'md', 'min-h-10')}>
          Export DOCX <span className="font-mono text-[11px] text-ink-muted">PRO</span>
        </Link>
      )}
      {/* Prints the page exactly as it is shown: the browser lays out the same markup the editor shows. */}
      <Button className="min-h-10" variant="secondary" onClick={() => window.print()}>
        Print / Save PDF
      </Button>
      {exporting && <ExportWatcher key={exporting.jobId} resumeId={resume.id} {...exporting} onDone={() => setExporting(null)} onError={onError} />}
    </div>
  )
}

/** Follows an export job, then opens the file through a short-lived link. */
function ExportWatcher({
  resumeId,
  format,
  jobId,
  onDone,
  onError,
}: {
  resumeId: string
  format: Format
  jobId: string
  onDone: () => void
  onError: (error: unknown) => void
}) {
  const router = useRouter()
  const { job } = useJob(apiBase(), jobId)
  const status = job?.status

  useEffect(() => {
    if (status === 'succeeded') {
      void api.resumes
        .exportLink(resumeId, format)
        .then(({ url }) => {
          window.open(url, '_blank', 'noopener')
          router.refresh()
        })
        .catch(onError)
        .finally(onDone)
    } else if (status === 'failed' || status === 'cancelled') {
      onError(new ApiClientError(422, job?.error?.code ?? 'EXPORT_FAILED', job?.error?.message ?? 'We could not make that file. Try again.'))
      onDone()
    }
  }, [status, job, resumeId, format, router, onDone, onError])

  return <span className="sr-only" role="status">Preparing your {format.toUpperCase()}…</span>
}

function Evidence({ bullet, refs }: { bullet: Bullet; refs: Record<string, EvidenceRef> }) {
  if (bullet.evidence.length === 0) {
    return (
      <p className="m-0 border border-danger bg-danger-tint p-4 text-sm leading-5">
        This bullet has no evidence behind it. Add a source, or remove the bullet.
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      {bullet.evidence.map((refId, index) => {
        const ref = refs[refId]
        if (!ref) return null
        const primary = index === 0
        return (
          <div key={refId} className={`flex flex-col gap-2 border p-4 ${primary ? 'border-signal bg-signal-tint' : 'border-line'}`}>
            <div className="flex justify-between gap-2">
              <span className={`font-mono text-xs ${primary ? 'text-signal' : 'text-ink-muted'}`}>
                {ref.source}
                {ref.where && ` · ${ref.where}`}
              </span>
              <span className={`font-mono text-xs ${primary ? 'text-signal' : 'text-ink-muted'}`}>{formatDate(ref.date)}</span>
            </div>
            <Markdown className={primary ? 'font-mono text-[13px] leading-5' : 'text-sm leading-5'}>{ref.original}</Markdown>
            {primary && (
              <Link href="/dashboard/evidence" className="text-[13px] font-semibold">
                Open in evidence library
              </Link>
            )}
          </div>
        )
      })}
    </div>
  )
}

function MatchTab({ resume, flagged }: { resume: ResumeDetailView; flagged: number }) {
  const match = resume.match
  if (!match) {
    return <p className="m-0 p-4 text-[15px] text-ink-muted sm:p-6">The match report is ready once the draft is written.</p>
  }
  const lowFigures = match.measurable.total > 0 && match.measurable.withFigure / match.measurable.total < 0.5
  const rows: [string, string, string][] = [
    ['Required skills covered', `${match.required.covered} / ${match.required.total}`, ''],
    ['Preferred skills covered', `${match.preferred.covered} / ${match.preferred.total}`, ''],
    ['Claims traced to evidence', `${match.claimsTraced}%`, match.claimsTraced === 100 ? 'text-signal' : 'text-danger-ink'],
    ['Measurable outcomes', `${match.measurable.withFigure} of ${match.measurable.total} bullets`, lowFigures ? 'text-danger-ink' : ''],
    [
      'Fits one page',
      match.fitsOnePage === null ? 'Not needed' : match.fitsOnePage ? 'Yes' : 'Probably not',
      match.fitsOnePage === false ? 'text-danger-ink' : '',
    ],
  ]

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      <div className="flex items-baseline gap-2.5">
        <span className="font-mono text-5xl leading-[52px]">{match.score ?? '—'}</span>
        <span className="font-mono text-[13px] text-ink-muted">/ 100{roleName(resume.role) && ` · ${roleName(resume.role).toUpperCase()} PROFILE`}</span>
      </div>

      <dl className="m-0 flex flex-col gap-3 text-sm">
        {rows.map(([label, value, tone]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt>{label}</dt>
            <dd className={`m-0 text-right font-mono ${tone}`}>{value}</dd>
          </div>
        ))}
      </dl>

      {match.requirements.length > 0 && (
        <div>
          <div className="border-b-2 border-ink pb-1.5 text-xs font-bold tracking-[0.08em]">REQUIREMENTS</div>
          <ul className="m-0 list-none p-0">
            {match.requirements.map((requirement) => (
              <li key={requirement.label} className="flex items-start gap-2.5 border-b border-line py-2.5 text-sm leading-5">
                <span className={`min-w-16 font-mono text-xs ${requirement.covered ? 'text-signal' : 'text-danger-ink'}`}>
                  {requirement.covered ? 'COVERED' : 'MISSING'}
                </span>
                <span>
                  {requirement.label} — {requirement.detail}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(match.suggestions.length > 0 || flagged > 0) && (
        <div className="flex flex-col gap-2 border border-line-strong bg-sunken p-4">
          <div className="font-bold">What you could add</div>
          <ul className="m-0 flex list-disc flex-col gap-1 pl-[18px] text-sm leading-[21px]">
            {match.suggestions.map((suggestion) => (
              <li key={suggestion}>{suggestion}</li>
            ))}
            <li>
              <Link href="/dashboard/sources">Add a source</Link> or <Link href="/dashboard/evidence">an entry</Link> to cover more of the job.
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}

/** The person's own rewrite of a bullet. */
function RewriteBox({
  initial,
  saving,
  onSave,
  onCancel,
}: {
  initial: string
  saving: boolean
  onSave: (text: string) => void
  onCancel: () => void
}) {
  const [text, setText] = useState(initial)
  const valid = text.trim().length >= 5
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="rewrite" className="sr-only">
        Bullet text
      </label>
      <textarea
        id="rewrite"
        autoFocus
        rows={4}
        maxLength={600}
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="w-full resize-y rounded-sm border border-line-input bg-canvas p-3 text-[15px] leading-[22px] hover:border-ink"
      />
      <div className="flex gap-2">
        <Button size="sm" disabled={!valid || text.trim() === initial} loading={saving} onClick={() => onSave(text.trim())}>
          Save wording
        </Button>
        <Button size="sm" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
