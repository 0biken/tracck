import Link from 'next/link'
import { LegalPage } from '@/components/marketing/legal-page'

export const metadata = { title: 'Data deletion' }

export default function DataDeletionPage() {
  return (
    <LegalPage
      eyebrow="Data deletion"
      title="Delete anything, any time."
      lede="You choose how much to remove, from one entry to your whole account. This is what each choice does."
      current="/data-deletion"
      sections={[
        {
          id: 'entry',
          title: 'One entry',
          body: (
            <p className="m-0">
              In the Evidence library, <strong>Exclude</strong> stops an entry being used in any resume, and you can
              include it again later. Excluded entries stay in your record until you delete the source they came from.
            </p>
          ),
        },
        {
          id: 'source',
          title: 'A source',
          body: (
            <>
              <p className="m-0">
                In <Link href="/dashboard/sources">Sources</Link>, disconnect a source and choose what happens to the
                entries it produced:
              </p>
              <ul>
                <li><strong>Keep the entries:</strong> they stay in your record and can still be used in resumes.</li>
                <li><strong>Delete everything from that source:</strong> its entries are removed. Existing resumes keep their text but lose the evidence link.</li>
              </ul>
              <p className="m-0">Deleting an uploaded CV removes the file. Entries from it stay until you delete them.</p>
            </>
          ),
        },
        {
          id: 'resumes',
          title: 'Resumes',
          body: (
            <p className="m-0">
              Each resume is saved with its job description. Deleting a resume removes both, permanently. Under
              <strong> Settings › Privacy and data</strong> you can delete all your resumes at once. Your sources and
              entries stay.
            </p>
          ),
        },
        {
          id: 'account',
          title: 'Your whole account',
          body: (
            <>
              <p className="m-0">
                <strong>Settings › Privacy and data › Delete account</strong> removes your sources, entries, resumes and
                consents. It cannot be undone.
              </p>
              <p className="m-0">
                We delete your data from live systems within [DELETION TIMELINE TO CONFIRM] and from backups within
                [BACKUP TIMELINE TO CONFIRM].
              </p>
            </>
          ),
        },
        {
          id: 'organisations',
          title: 'Access given to organisations',
          body: (
            <p className="m-0">
              Revoking an organisation under <strong>Settings › Organisations with access</strong> stops it reading your
              data straight away. Organisations must not keep copies beyond what you allowed.
            </p>
          ),
        },
        {
          id: 'copy',
          title: 'Taking a copy first',
          body: (
            <p className="m-0">
              Before you delete, use <strong>Request export</strong> in Settings to get everything Tracck holds about
              you. If you cannot sign in, write to [PRIVACY CONTACT TO CONFIRM] from the email on your account.
            </p>
          ),
        },
      ]}
    />
  )
}
