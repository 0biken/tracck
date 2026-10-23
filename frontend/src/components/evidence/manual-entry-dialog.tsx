'use client'

import { useState, type FormEvent } from 'react'
import type { CreateEvidenceRequest } from '@tracck/shared'
import { ErrorNotice } from '@/components/sources/dialogs'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { SelectField, TextAreaField, TextField } from '@/components/ui/field'
import { api } from '@/lib/api/client'

const KINDS: { value: CreateEvidenceRequest['kind']; label: string }[] = [
  { value: 'experience', label: 'Work or role' },
  { value: 'project', label: 'Project' },
  { value: 'skill', label: 'Skill' },
  { value: 'education', label: 'Education' },
]

/**
 * For work with no public trace. What the person writes is stored as their own
 * statement and marked as user-confirmed, so a resume may use it.
 */
export function ManualEntryDialog({
  open,
  onClose,
  onAdded,
}: {
  open: boolean
  onClose: () => void
  onAdded: () => void
}) {
  const [kind, setKind] = useState<CreateEvidenceRequest['kind']>('experience')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [skills, setSkills] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const valid = title.trim().length > 0 && body.trim().length >= 20

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!valid) return
    setBusy(true)
    setError(null)
    try {
      await api.evidence.create({
        kind,
        title: title.trim(),
        body: body.trim(),
        skills: skills
          .split(',')
          .map((skill) => skill.trim())
          .filter(Boolean),
      })
      setTitle('')
      setBody('')
      setSkills('')
      onAdded()
      onClose()
    } catch (failure) {
      setError(failure)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Add an entry" size="lg">
      <form onSubmit={submit} className="flex flex-col gap-4 pr-8">
        <h2 className="t-claim m-0">Add an entry</h2>
        <p className="m-0 text-[15px] leading-[22px] text-ink-muted">
          Describe work that has no public trace. Say what you did, in your own words. Tracck will not add figures you
          did not give.
        </p>
        <SelectField id="entry-kind" label="Kind" value={kind} onChange={(event) => setKind(event.target.value as CreateEvidenceRequest['kind'])}>
          {KINDS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </SelectField>
        <TextField
          id="entry-title"
          label="Title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Organised the faculty hackathon"
          maxLength={160}
        />
        <TextAreaField
          id="entry-body"
          label="What you did"
          rows={5}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          help="At least a sentence or two."
          maxLength={4000}
        />
        <TextField
          id="entry-skills"
          label="Skills used (optional)"
          value={skills}
          onChange={(event) => setSkills(event.target.value)}
          help="Separate with commas."
        />
        {error !== null && <ErrorNotice error={error} />}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={!valid} loading={busy}>
            Add entry
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
