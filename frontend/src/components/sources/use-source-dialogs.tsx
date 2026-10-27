'use client'

import { useState } from 'react'
import { api } from '@/lib/api/client'
import { LinkDialog, PasteDialog, UploadDialog } from './dialogs'

export type AddKind = 'github' | 'cv' | 'linkedin-file' | 'linkedin-paste' | 'portfolio' | 'x-archive' | 'behance'

/**
 * The ways to add a source, as dialogs. A page shows its own buttons, calls
 * `start(kind)` from them, and renders `dialogs` once. GitHub has no dialog: it
 * sends the person to GitHub to approve access, then GitHub sends them back.
 */
export function useSourceDialogs({ from, onChanged }: { from: 'onboarding' | 'sources'; onChanged: () => void }) {
  const [open, setOpen] = useState<AddKind | null>(null)
  const [connectError, setConnectError] = useState<unknown>(null)

  async function start(kind: AddKind) {
    if (kind === 'github') {
      setConnectError(null)
      try {
        const { authorizeUrl } = await api.sources.githubConnect(from)
        window.location.assign(authorizeUrl)
      } catch (error) {
        setConnectError(error)
      }
      return
    }
    setOpen(kind)
  }

  const close = () => setOpen(null)
  const added = async (action: () => Promise<unknown>) => {
    await action()
    onChanged()
  }

  const dialogs = (
    <>
      <UploadDialog
        open={open === 'cv'}
        onClose={close}
        title="Upload your CV"
        intro="PDF or Word, up to 5 MB. It stays private, and Tracck will tell you where it can be stronger."
        accept=".pdf,.docx,application/pdf"
        hint="PDF or DOCX, up to 5 MB"
        onUpload={(file) => added(() => api.sources.uploadCv(file))}
      />
      <UploadDialog
        open={open === 'linkedin-file'}
        onClose={close}
        title="Upload your LinkedIn data"
        intro="Use your data export ZIP (Settings, Data privacy, Get a copy of your data) or a profile saved as PDF."
        accept=".zip,.pdf,application/zip,application/pdf"
        hint="ZIP or PDF, up to 5 MB"
        onUpload={(file) => added(() => api.sources.linkedinFile(file))}
      />
      <PasteDialog
        open={open === 'linkedin-paste'}
        onClose={close}
        title="Paste your LinkedIn profile"
        intro="Copy the text of your profile page and paste it here."
        label="Profile text"
        help="At least a few sentences. Only what you paste is read."
        onSubmit={(text) => added(() => api.sources.linkedinText(text))}
      />
      <LinkDialog
        open={open === 'portfolio'}
        onClose={close}
        title="Add a portfolio or site"
        intro="Tracck reads the public page at this address. It never signs in as you."
        onSubmit={(url) => added(() => api.sources.portfolio(url))}
      />
      <UploadDialog
        open={open === 'x-archive'}
        onClose={close}
        title="Upload your X archive"
        intro="Request your archive in X under Settings and privacy, then Your account, then Download an archive of your data. Upload the ZIP here."
        accept=".zip,application/zip"
        hint="ZIP file"
        onUpload={(file) => added(() => api.sources.xArchive(file))}
      />
      <PasteDialog
        open={open === 'behance'}
        onClose={close}
        title="Paste your Behance projects"
        intro="Paste project titles, descriptions and links."
        label="Projects"
        help="Separate projects with a blank line."
        onSubmit={(text) => added(() => api.sources.paste('behance', text))}
      />
    </>
  )

  return { start, dialogs, connectError, clearConnectError: () => setConnectError(null) }
}
