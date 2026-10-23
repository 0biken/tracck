import Link from 'next/link'
import { LegalPage } from '@/components/marketing/legal-page'

export const metadata = { title: 'Terms' }

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Terms of use"
      title="The terms, in plain words."
      lede="What you can expect from Tracck and what we expect from you."
      current="/terms"
      sections={[
        {
          id: 'service',
          title: 'What Tracck does',
          body: (
            <>
              <p className="m-0">
                Tracck keeps a record of work you connect or upload, and writes resumes from that record for jobs you
                choose. Every line it writes is meant to trace back to an entry in your record.
              </p>
              <p className="m-0">
                Tracck is a writing aid. It does not guarantee an interview, a job or a particular score from any
                applicant tracking system.
              </p>
            </>
          ),
        },
        {
          id: 'account',
          title: 'Your account',
          body: (
            <>
              <p className="m-0">
                You need an account to use Tracck. Give accurate details, keep your password to yourself, and tell us if
                you think someone else has used your account.
              </p>
            </>
          ),
        },
        {
          id: 'content',
          title: 'Your work and your resumes',
          body: (
            <>
              <p className="m-0">
                What you connect, upload and write stays yours. You give Tracck permission to read it, store it and use
                it to produce your resumes, and only for that.
              </p>
              <p className="m-0">
                <strong>You are responsible for what your resume says.</strong> Review every bullet before you send it.
                Tracck flags a number it cannot find in your evidence and asks you for it; it does not invent figures,
                employers or qualifications. If you add one, it is your statement.
              </p>
              <p className="m-0">Only connect work that is yours, or that you have the right to describe.</p>
            </>
          ),
        },
        {
          id: 'sources',
          title: 'Connecting sources',
          body: (
            <>
              <p className="m-0">
                Tracck reads only what you connect or upload. It does not scrape platforms, use third-party data
                providers, or use your logged-in sessions. Do not use Tracck to collect other people&apos;s data.
              </p>
              <p className="m-0">
                A platform can change or withdraw access at any time. When it does, that source may stop updating.
              </p>
            </>
          ),
        },
        {
          id: 'plans',
          title: 'Plans and payment',
          body: (
            <>
              <ul>
                <li>Prices are in naira and billed monthly. The current plans are on the <Link href="/pricing">pricing page</Link>.</li>
                <li>Limits count resumes generated and sources connected. Editing, rewriting a bullet and exporting an existing resume do not count.</li>
                <li>You can cancel at any time. Your record and resumes stay on the Free plan.</li>
                <li>Accepted payment methods: [PAYMENT METHODS TO CONFIRM].</li>
                <li>Refunds: [REFUND POLICY TO CONFIRM].</li>
              </ul>
            </>
          ),
        },
        {
          id: 'organisations',
          title: 'Organisations using the API',
          body: (
            <p className="m-0">
              Organisations with API access can read a person&apos;s data only after that person consents, and only for
              the permissions they grant. You can revoke access at any time in Settings. Organisations agree to separate
              API terms: [API TERMS TO CONFIRM].
            </p>
          ),
        },
        {
          id: 'use',
          title: 'Using Tracck fairly',
          body: (
            <ul>
              <li>Do not try to break, overload or reverse-engineer the service.</li>
              <li>Do not share an API key or use one you were not issued.</li>
              <li>Do not use Tracck to write misleading claims about yourself or anyone else.</li>
            </ul>
          ),
        },
        {
          id: 'ending',
          title: 'Ending your use',
          body: (
            <p className="m-0">
              You can delete your account at any time; see <Link href="/data-deletion">Data deletion</Link>. We may
              suspend an account that breaks these terms, and will tell you why when we do.
            </p>
          ),
        },
        {
          id: 'liability',
          title: 'Responsibility and changes',
          body: (
            <>
              <p className="m-0">[LIABILITY AND GOVERNING LAW TO CONFIRM WITH COUNSEL].</p>
              <p className="m-0">
                If we change these terms in a way that matters, we will tell you by email before it takes effect.
              </p>
            </>
          ),
        },
      ]}
    />
  )
}
