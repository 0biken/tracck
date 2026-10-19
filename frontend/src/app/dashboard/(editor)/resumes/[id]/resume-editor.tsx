'use client'

import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useRef, useState } from 'react'
import { Button, buttonClass } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { TabPanel, Tabs } from '@/components/ui/tabs'
import {
  EVIDENCE_REFS,
  JOB_DESCRIPTION,
  JOB_FOCUS,
  REQUIREMENTS,
  RESUME_HEADER,
  RESUME_SECTIONS,
  SAVED_AT,
  type Bullet,
  type ResumeSection,
  type ResumeSummary,
} from '@/lib/mock/resumes'

type Tab = 'evidence' | 'match' | 'job'
type Length = 'one' | 'full'
type Removed = { bullet: Bullet; s: number; g: number; b: number }

// ---------------------------------------------------------------------------
// Pure helpers over the section tree

function allBullets(sections: ResumeSection[]) {
  return sections.flatMap((section) => (section.kind === 'groups' ? section.groups.flatMap((group) => group.bullets) : []))
}

function locate(sections: ResumeSection[], id: string) {
  for (let s = 0; s < sections.length; s++) {
    const section = sections[s]
    if (section.kind !== 'groups') continue
    for (let g = 0; g < section.groups.length; g++) {
      const b = section.groups[g].bullets.findIndex((bullet) => bullet.id === id)
      if (b !== -1) return { s, g, b }
    }
  }
  return null
}

function withBullets(sections: ResumeSection[], s: number, g: number, change: (bullets: Bullet[]) => Bullet[]) {
  return sections.map((section, si) => {
    if (si !== s || section.kind !== 'groups') return section
    return {
      ...section,
      groups: section.groups.map((group, gi) => (gi === g ? { ...group, bullets: change(group.bullets) } : group)),
    }
  })
}

const hasFigure = (text: string) => /\d/.test(text)

// ---------------------------------------------------------------------------

export function ResumeEditor({ resume }: { resume: ResumeSummary }) {
  const [sections, setSections] = useState<ResumeSection[]>(RESUME_SECTIONS)
  const [selectedId, setSelectedId] = useState<string | null>('b1')
  const [tab, setTab] = useState<Tab>('evidence')
  const [length, setLength] = useState<Length>(resume.length === 'Full' ? 'full' : 'one')
  const [edited, setEdited] = useState(false)
  const [rewriting, setRewriting] = useState<string | null>(null)
  const [figure, setFigure] = useState('')
  const [removed, setRemoved] = useState<Removed | null>(null)
  const panelRef = useRef<HTMLElement>(null)

  const bullets = useMemo(() => allBullets(sections), [sections])
  const selected = bullets.find((bullet) => bullet.id === selectedId) ?? null
  const selectedLoc = selected ? locate(sections, selected.id) : null

  const measurable = bullets.filter((bullet) => hasFigure(bullet.text)).length
  const traced = bullets.filter((bullet) => bullet.evidence.length > 0).length
  const tracedPercent = bullets.length ? Math.round((traced / bullets.length) * 100) : 100
  const lowFigures = bullets.length > 0 && measurable / bullets.length < 0.5
  const flagged = bullets.filter((bullet) => bullet.needsNumber)

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

  function change(next: ResumeSection[]) {
    setSections(next)
    setEdited(true)
  }

  function updateText(id: string, text: string, keepFlag = false) {
    const loc = locate(sections, id)
    if (!loc) return
    change(
      withBullets(sections, loc.s, loc.g, (list) =>
        list.map((bullet) => (bullet.id === id ? { ...bullet, text, needsNumber: keepFlag ? bullet.needsNumber : false } : bullet)),
      ),
    )
  }

  function addFigure() {
    if (!selected || !figure.trim()) return
    const base = selected.text.replace(/[.\s]+$/, '')
    updateText(selected.id, `${base}, ${figure.trim().replace(/[.\s]+$/, '')}.`)
    setFigure('')
  }

  function keepWithoutFigure() {
    if (!selected) return
    updateText(selected.id, selected.text)
  }

  function moveUp() {
    if (!selectedLoc || selectedLoc.b === 0) return
    const { s, g, b } = selectedLoc
    change(
      withBullets(sections, s, g, (list) => {
        const next = [...list]
        ;[next[b - 1], next[b]] = [next[b], next[b - 1]]
        return next
      }),
    )
  }

  function remove() {
    if (!selected || !selectedLoc) return
    const { s, g, b } = selectedLoc
    const neighbour = allBullets(sections).find((_, i, list) => list[i + 1]?.id === selected.id || list[i - 1]?.id === selected.id)
    setRemoved({ bullet: selected, s, g, b })
    change(withBullets(sections, s, g, (list) => list.filter((bullet) => bullet.id !== selected.id)))
    setSelectedId(neighbour?.id ?? null)
    setRewriting(null)
  }

  function undoRemove() {
    if (!removed) return
    const { bullet, s, g, b } = removed
    change(
      withBullets(sections, s, g, (list) => {
        const next = [...list]
        next.splice(Math.min(b, next.length), 0, bullet)
        return next
      }),
    )
    setSelectedId(bullet.id)
    setRemoved(null)
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
            <h1 className="m-0 truncate font-display text-[22px] font-bold leading-7">Resume for {resume.company}</h1>
            <span className="truncate font-mono text-xs text-ink-muted" aria-live="polite">
              {resume.title.toUpperCase()} · {resume.role.toUpperCase()} ·{' '}
              {edited ? 'UNSAVED CHANGES' : `SAVED ${SAVED_AT}`}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              label="Length"
              size="sm"
              value={length}
              onChange={setLength}
              options={[
                { value: 'one', label: 'One page' },
                { value: 'full', label: 'Full' },
              ]}
            />
            <Link href={`/dashboard/resumes/${resume.id}/generating`} className={buttonClass('secondary', 'md', 'min-h-10')}>
              Regenerate
            </Link>
            <Link href="/dashboard/settings" className={buttonClass('secondary', 'md', 'min-h-10')}>
              Export DOCX <span className="font-mono text-[11px] text-ink-muted">PRO</span>
            </Link>
            <Button onClick={() => window.print()} className="min-h-10">
              Export PDF
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        <main id="content" aria-label="Resume" className="flex min-w-0 flex-1 flex-col items-center gap-4 bg-sunken px-3 py-6 sm:p-8">
          <div className="flex w-full max-w-190 flex-wrap justify-between gap-3 font-mono text-xs text-ink-muted">
            <span>
              {length === 'one' ? 'A4 · ARIAL 11 PT · ATS SAFE · FITS 1 PAGE' : 'A4 · ARIAL 11 PT · ATS SAFE · FULL LENGTH'}
            </span>
            <span>SELECT A BULLET TO SEE ITS EVIDENCE</span>
          </div>

          <article
            aria-label={`Resume for ${resume.company}`}
            className="print-area box-border w-full max-w-190 border border-line-strong bg-white px-5 py-8 font-[Arial,Helvetica,sans-serif] text-[#141310] sm:px-[52px] sm:py-12"
          >
            <div className="text-2xl font-bold">{RESUME_HEADER.name}</div>
            <div className="mt-1 text-xs leading-[17px]">{RESUME_HEADER.contact}</div>

            {sections.map((section) => (
              <section key={section.id} aria-label={section.heading.toLowerCase()}>
                <h2 className="mb-1.5 mt-3.5 border-b border-[#141310] pb-[3px] text-[11.5px] font-bold tracking-[0.06em]">
                  {section.heading}
                </h2>
                {section.kind === 'text' ? (
                  <p className="m-0 text-[12.5px] leading-[17px]">{section.text}</p>
                ) : (
                  section.groups.map((group, gi) => (
                    <div key={group.title ?? gi}>
                      {group.title && (
                        <div className="flex justify-between gap-4 text-[12.5px] font-bold">
                          <span>{group.title}</span>
                          <span>{group.year}</span>
                        </div>
                      )}
                      <ul className="mb-2 mt-1 list-disc pl-[18px]">
                        {group.bullets.map((bullet) => {
                          const isSelected = bullet.id === selectedId
                          return (
                            <li key={bullet.id} className="text-[12.5px] leading-[17px]">
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
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  ))
                )}
              </section>
            ))}
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
              {removed && (
                <div role="status" className="flex flex-wrap items-center justify-between gap-2 border border-line-strong bg-sunken px-3.5 py-2.5 text-sm">
                  <span>Bullet removed.</span>
                  <button type="button" onClick={undoRemove} className="min-h-9 cursor-pointer border-0 bg-transparent font-semibold underline">
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
                        initial={selected.text}
                        onSave={(text) => {
                          updateText(selected.id, text, true)
                          setRewriting(null)
                        }}
                        onCancel={() => setRewriting(null)}
                      />
                    ) : (
                      <div className="text-[15px] leading-[22px]">{selected.text}</div>
                    )}
                  </div>

                  {selected.evidence.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {selected.evidence.map((refId, index) => {
                        const ref = EVIDENCE_REFS[refId]
                        const primary = index === 0
                        return (
                          <div
                            key={refId}
                            className={`flex flex-col gap-2 border p-4 ${primary ? 'border-signal bg-signal-tint' : 'border-line'}`}
                          >
                            <div className="flex justify-between gap-2">
                              <span className={`font-mono text-xs ${primary ? 'text-signal' : 'text-ink-muted'}`}>
                                {ref.source} · {ref.where}
                              </span>
                              <span className={`font-mono text-xs ${primary ? 'text-signal' : 'text-ink-muted'}`}>{ref.date}</span>
                            </div>
                            <div className={primary ? 'font-mono text-[13px] leading-5' : 'text-sm leading-5'}>{ref.original}</div>
                            {primary && (
                              <Link href="/dashboard/evidence" className="text-[13px] font-semibold">
                                Open in evidence library
                              </Link>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="m-0 border border-danger bg-danger-tint p-4 text-sm leading-5">
                      This bullet has no evidence behind it. Add a source, or remove the bullet.
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => setRewriting(selected.id)}>
                      Rewrite this bullet
                    </Button>
                    <Button variant="secondary" onClick={moveUp} disabled={!selectedLoc || selectedLoc.b === 0}>
                      Move up
                    </Button>
                    <Button variant="danger" onClick={remove}>
                      Remove
                    </Button>
                  </div>

                  {selected.needsNumber && (
                    <div className="flex flex-col gap-2.5 border border-danger bg-danger-tint p-4">
                      <div className="font-bold text-danger-ink">Confirm a number</div>
                      <div className="text-sm leading-5">
                        &ldquo;{selected.text.split(' ').slice(0, 3).join(' ')}…&rdquo; would be stronger with a figure,
                        but your evidence has none. Tracck will not invent one.
                      </div>
                      <label htmlFor="figure" className="text-[13px] font-semibold">
                        By how much, in your own words
                      </label>
                      <input
                        id="figure"
                        value={figure}
                        onChange={(event) => setFigure(event.target.value)}
                        placeholder="e.g. from 18% to 9% over 2 months"
                        className="min-h-11 rounded-sm border border-line-input bg-canvas px-3 text-[15px] hover:border-ink"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={addFigure} disabled={!figure.trim()}>
                          Add to bullet
                        </Button>
                        <Button variant="secondary" onClick={keepWithoutFigure}>
                          Keep without a number
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="m-0 text-[15px] leading-[22px] text-ink-muted">
                  Select a bullet on the page to see the evidence behind it.
                </p>
              )}
            </div>
          </TabPanel>

          <TabPanel idBase="review" value="match" active={tab === 'match'}>
            <div className="flex flex-col gap-5 p-4 sm:p-6">
              <div className="flex items-baseline gap-2.5">
                <span className="font-mono text-5xl leading-[52px]">{resume.score ?? 82}</span>
                <span className="font-mono text-[13px] text-ink-muted">/ 100 · {resume.role.toUpperCase()} PROFILE</span>
              </div>

              <dl className="m-0 flex flex-col gap-3 text-sm">
                {[
                  ['Required skills covered', '6 / 6', ''],
                  ['Preferred skills covered', '1 / 2', ''],
                  ['Claims traced to evidence', `${tracedPercent}%`, tracedPercent === 100 ? 'text-signal' : 'text-danger-ink'],
                  ['Technical specificity', 'Strong', ''],
                  ['Measurable outcomes', `${measurable} of ${bullets.length} bullets`, lowFigures ? 'text-danger-ink' : ''],
                  ['Fits one page', length === 'one' ? 'Yes' : 'Not needed', ''],
                ].map(([label, value, tone]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <dt>{label}</dt>
                    <dd className={`m-0 text-right font-mono ${tone}`}>{value}</dd>
                  </div>
                ))}
              </dl>

              <div>
                <div className="border-b-2 border-ink pb-1.5 text-xs font-bold tracking-[0.08em]">REQUIREMENTS</div>
                <ul className="m-0 list-none p-0">
                  {REQUIREMENTS.map((requirement) => (
                    <li key={requirement.label} className="flex items-start gap-2.5 border-b border-line py-2.5 text-sm leading-5">
                      <span
                        className={`min-w-16 font-mono text-xs ${requirement.covered ? 'text-signal' : 'text-danger-ink'}`}
                      >
                        {requirement.covered ? 'COVERED' : 'MISSING'}
                      </span>
                      <span>
                        {requirement.label} — {requirement.detail}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col gap-2 border border-line-strong bg-sunken p-4">
                <div className="font-bold">What you could add</div>
                <ul className="m-0 flex list-disc flex-col gap-1 pl-[18px] text-sm leading-[21px]">
                  <li>
                    A project deployed to Kubernetes, if you have one. <Link href="/dashboard/sources">Add a source</Link>
                  </li>
                  {flagged.length > 0 && <li>Numbers for the renewal and report-speed bullets.</li>}
                </ul>
              </div>
            </div>
          </TabPanel>

          <TabPanel idBase="review" value="job" active={tab === 'job'}>
            <div className="flex flex-col gap-3 p-4 sm:p-6">
              <div className="t-eyebrow text-ink-muted">Job description · pasted 2026.10.12</div>
              <div className="whitespace-pre-line border border-line bg-sunken p-4 text-sm leading-[22px]">
                {JOB_DESCRIPTION}
              </div>
              <div className="t-eyebrow mt-2 text-ink-muted">Your focus</div>
              <div className="text-sm leading-[21px]">{JOB_FOCUS}</div>
            </div>
          </TabPanel>
        </aside>
      </div>
    </div>
  )
}

/** Manual rewrite until the AI rewrite is wired: edit the text, then save. */
function RewriteBox({
  initial,
  onSave,
  onCancel,
}: {
  initial: string
  onSave: (text: string) => void
  onCancel: () => void
}) {
  const [text, setText] = useState(initial)
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="rewrite" className="sr-only">
        Bullet text
      </label>
      <textarea
        id="rewrite"
        autoFocus
        rows={4}
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="w-full resize-y rounded-sm border border-line-input bg-canvas p-3 text-[15px] leading-[22px] hover:border-ink"
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => onSave(text.trim() || initial)}>
          Save wording
        </Button>
        <Button size="sm" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
