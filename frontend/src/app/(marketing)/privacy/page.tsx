import Link from 'next/link'
import { LegalPage } from '@/components/marketing/legal-page'

export const metadata = { title: 'Privacy' }

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacy policy"
      title="What we keep, and why."
      lede="Tracck holds a record of your work. This is exactly what is in it, who can see it, and how to remove it."
      current="/privacy"
      sections={[
        {
          id: 'collect',
          title: 'What we collect',
          body: (
            <ul>
              <li><strong>Account:</strong> your name, email address and sign-in details.</li>
              <li><strong>Sources you connect or upload:</strong> repositories and releases from GitHub, CVs, LinkedIn exports, portfolio pages and anything you paste or type.</li>
              <li><strong>Your record:</strong> the dated entries Tracck makes from those sources, and any edits you make to them.</li>
              <li><strong>Your resumes:</strong> each resume, the job description it was written for, and your focus notes.</li>
              <li><strong>Usage:</strong> what is needed to run the service, such as job progress and errors.</li>
            </ul>
          ),
        },
        {
          id: 'not-collect',
          title: 'What we do not do',
          body: (
            <ul>
              <li>We never scrape a platform.</li>
              <li>We never buy data about you from third-party providers.</li>
              <li>We never read your logged-in sessions.</li>
              <li>We never pass your data to recruiters or job boards on our own.</li>
            </ul>
          ),
        },
        {
          id: 'ai',
          title: 'How the AI uses your record',
          body: (
            <>
              <p className="m-0">
                When you generate a resume, only the entries ranked relevant to that job are sent to the AI provider
                that writes and checks the draft. Your whole record is not sent. Passwords, access tokens and other
                credentials are never sent.
              </p>
              <p className="m-0">AI providers we use, and their data terms: [PROVIDERS AND DATA TERMS TO CONFIRM].</p>
            </>
          ),
        },
        {
          id: 'sharing',
          title: 'Who can see your data',
          body: (
            <>
              <p className="m-0">
                Only you. An organisation with API access, such as your university&apos;s careers office, can read your
                data only after you consent, only for the permissions you choose, and only until you revoke it. You can
                see and revoke each one under <strong>Settings › Organisations with access</strong>.
              </p>
              <p className="m-0">Service providers that host Tracck process data for us under contract: [HOSTING PROVIDERS TO CONFIRM].</p>
            </>
          ),
        },
        {
          id: 'retention',
          title: 'How long we keep it',
          body: (
            <ul>
              <li>Uploaded CVs are private and kept for 12 months by default. You can change this to 6 months or until you delete them.</li>
              <li>Your entries and resumes are kept until you delete them or your account.</li>
              <li>Deleted data is removed as described on the <Link href="/data-deletion">Data deletion</Link> page.</li>
            </ul>
          ),
        },
        {
          id: 'rights',
          title: 'Your rights',
          body: (
            <>
              <p className="m-0">
                Tracck is built to respect the Nigeria Data Protection Regulation (NDPR). You can ask to see what we
                hold, correct it, take a copy, or have it deleted.
              </p>
              <ul>
                <li><strong>See and correct:</strong> your Evidence library shows every entry, and you can reword or exclude any of them.</li>
                <li><strong>Take a copy:</strong> Settings › Privacy and data › Request export.</li>
                <li><strong>Delete:</strong> sources, entries, resumes or your whole account, any time.</li>
              </ul>
            </>
          ),
        },
        {
          id: 'security',
          title: 'Keeping it safe',
          body: (
            <p className="m-0">
              Uploaded files are stored privately and reached only through short-lived links. Access tokens for
              connected sources are stored apart from everything the browser can read. No secret is ever shown in the
              app or sent to the AI.
            </p>
          ),
        },
        {
          id: 'contact',
          title: 'Contact and changes',
          body: (
            <>
              <p className="m-0">Data controller and contact: [COMPANY NAME, ADDRESS AND PRIVACY CONTACT TO CONFIRM].</p>
              <p className="m-0">
                If we change this policy in a way that matters, we will tell you by email before it takes effect.
              </p>
            </>
          ),
        },
      ]}
    />
  )
}
