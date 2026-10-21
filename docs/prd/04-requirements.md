# Requirements

Suggested order: M1, M2, M3, M4, M5, M6, M7, then M8 and M9 in either order. M1 comes first because every later milestone needs the repository, the tenant-aware schema, sign-in and deployment. M2 is the first vertical slice. M3 raises it to the quality the product promises. M4 widens sources and roles. M5 and M6 (billing, privacy) must be done before public launch, but the private beta can run on the Free plan without M5. M7 prepares the private beta and its documentation. M8 and M9 are Phase 2 and Phase 3.

First vertical slice: GitHub connection plus CV upload, one role (Developer), a pasted job description, a one-page draft, and a PDF, with a minimal web screen for each step ([M2](#milestone-m2-first-vertical-slice)).

Sizes: S (a small, well-understood change), M (one focused piece of work), L (a large or uncertain piece of work, split further if it grows). No time estimates are given by design. Every task is traced to requirements in [03-architecture.md](03-architecture.md). Each checkbox is a subtask.

## Milestone M1: Foundations and deployment skeleton
Goal: a repository that builds, tests, deploys to staging and production, with sign-in and a tenant-aware database.
Definition of done: a signed-in test user sees an empty dashboard on staging, deployed by pipeline, with errors visible in Sentry and a one-command rollback shown to work.
Depends on: the accounts listed under Groundwork in [01-overview.md](01-overview.md#groundwork) (hosting, database, email domain).
Covers: [FR-1](03-architecture.md#fr-1), [NFR-7](03-architecture.md#nfr-7), [NFR-14](03-architecture.md#nfr-14), [UP-4](03-architecture.md#up-4), [UP-5](03-architecture.md#up-5), [UP-24](03-architecture.md#up-24), [UP-26](03-architecture.md#up-26), [UP-27](03-architecture.md#up-27), [UP-28](03-architecture.md#up-28)

<a id="m1-t1"></a>
### M1-T1 Repository, configuration and secrets (size: S)
- [ ] M1-T1.1 Monorepo with web, API and worker packages; lint, format, type checks
- [ ] M1-T1.2 Docker Compose with Postgres and Redis (append-only file on, `noeviction`) for local work
- [ ] M1-T1.3 Typed configuration loader; secrets only from environment or the platform secret store; a check that fails the build if a secret is committed
Acceptance: a new machine reaches a running local stack with one documented command; the build fails when a test secret is added to the repository.

<a id="m1-t2"></a>
### M1-T2 Database schema v1 with ownership (size: M)
- [ ] M1-T2.1 Migration tooling with expand-then-contract rules
- [ ] M1-T2.2 Tables for users, sources, evidence, resumes, consents, audit log, with `owner_id` and (for organisation tables) `client_id` from the first migration
- [ ] M1-T2.3 Row-level policies and an automated test that one user cannot read another's rows
Acceptance: the cross-user test fails if a policy is removed ([NFR-7](03-architecture.md#nfr-7), [UP-28](03-architecture.md#up-28)).

<a id="m1-t3"></a>
### M1-T3 Authentication and sessions (size: M)
- [ ] M1-T3.1 Email sign-up with verification, sign-in, reset, change email with verification of the new address
- [ ] M1-T3.2 Google sign-in; accounts with the same verified email are linked
- [ ] M1-T3.3 Sign out everywhere; lockout and rate limits on sign-in and sign-up
Acceptance: all [FR-1](03-architecture.md#fr-1) criteria pass in end-to-end tests; repeated failed sign-ins are limited ([UP-4](03-architecture.md#up-4), [UP-5](03-architecture.md#up-5), [UP-27](03-architecture.md#up-27)).

<a id="m1-t4"></a>
### M1-T4 Observability baseline (size: S)
- [ ] M1-T4.1 Structured logs with trace identifier across API and worker, with a personal-data scrubber
- [ ] M1-T4.2 Sentry in web, API and worker; uptime monitor
- [ ] M1-T4.3 First alerts: error rate, certificate and domain expiry
Acceptance: an induced error appears in Sentry with a trace identifier and no personal text within 5 minutes ([NFR-14](03-architecture.md#nfr-14)).

<a id="m1-t5"></a>
### M1-T5 Deployment pipeline, staging and rollback (size: M)
- [ ] M1-T5.1 CI: tests, build images, dependency scan
- [ ] M1-T5.2 Staging and production on the approved hosts ([DR-5](02-tech-stack.md#dr-5-hosting-and-region)); migrations run first
- [ ] M1-T5.3 One-command rollback and a written deploy checklist
- [ ] M1-T5.4 Measure round-trip time from Lagos to staging and record it ([Q-12](05-assumptions-risks-questions.md#q-12))
Acceptance: a deploy and a rollback are each done once on staging by following the checklist ([UP-24](03-architecture.md#up-24)).

## Milestone M2: First vertical slice
Goal: prove the claim "a resume you would send, in minutes, traceable to your work" for one role and one length.
Definition of done: a test user connects GitHub, uploads a CV, pastes a job description, gets a one-page Developer draft with evidence links, and downloads a PDF, on staging.
Depends on: M1.
Covers: [FR-3](03-architecture.md#fr-3), [FR-4](03-architecture.md#fr-4), [FR-7](03-architecture.md#fr-7), [FR-9](03-architecture.md#fr-9), [FR-10](03-architecture.md#fr-10) (single pass), [FR-12](03-architecture.md#fr-12), [NFR-1](03-architecture.md#nfr-1), [NFR-2](03-architecture.md#nfr-2), [NFR-5](03-architecture.md#nfr-5), [UP-1](03-architecture.md#up-1), [UP-2](03-architecture.md#up-2), [UP-3](03-architecture.md#up-3), [UP-6](03-architecture.md#up-6), [UP-7](03-architecture.md#up-7), [UP-8](03-architecture.md#up-8), [UP-10](03-architecture.md#up-10), [UP-20](03-architecture.md#up-20), [UP-21](03-architecture.md#up-21), [UP-31](03-architecture.md#up-31), [UP-32](03-architecture.md#up-32)

<a id="m2-t1"></a>
### M2-T1 Job queue framework (size: M)
- [ ] M2-T1.1 BullMQ queues and a worker process with concurrency limits
- [ ] M2-T1.2 Job keys for idempotency, timeouts, 3 retries with backoff, dead-letter queue, job state exposed to the API
- [ ] M2-T1.3 Recovery job that re-queues unfinished work from database state after a Redis loss
Acceptance: killing the worker and Redis mid-job loses no job and creates no duplicate side effect ([NFR-5](03-architecture.md#nfr-5), [UP-20](03-architecture.md#up-20), [UP-21](03-architecture.md#up-21)).

<a id="m2-t2"></a>
### M2-T2 GitHub connection and collection (size: L)
- [ ] M2-T2.1 GitHub OAuth app with public-data access only; disconnect and delete flow
- [ ] M2-T2.2 Collect profile, repositories, languages, authored commits, pull requests, issues, reviews, using yearly windows and rate-limit-aware pacing
- [ ] M2-T2.3 Record the date range collected and per-step status; recorded API responses for tests
- [ ] M2-T2.4 Source on/off flag and adapter shape tests
Acceptance: test accounts with 5, 50 and 200 repositories finish within [NFR-2](03-architecture.md#nfr-2); a revoked token marks the source "needs reconnect" and keeps existing evidence ([UP-6](03-architecture.md#up-6), [UP-7](03-architecture.md#up-7), [UP-31](03-architecture.md#up-31)). This task also settles whether the one-year contribution window is a hard limit ([A-45](05-assumptions-risks-questions.md#a-45)).

<a id="m2-t3"></a>
### M2-T3 CV upload and parsing (size: L)
- [ ] M2-T3.1 Upload endpoint with size and content-type checks, malware scan, storage with owner path
- [ ] M2-T3.2 Sandboxed parsing for PDF and DOCX with time, memory and size limits; OCR fallback for scans
- [ ] M2-T3.3 Extraction of roles, education, skills and projects into evidence items with schema validation
- [ ] M2-T3.4 Parser test set of at least 30 CVs, including bad files
Acceptance: 90% of the test set yields correct employer, role and dates; corrupt and malicious files are rejected with a clear message ([UP-1](03-architecture.md#up-1), [UP-2](03-architecture.md#up-2)).

<a id="m2-t4"></a>
### M2-T4 Career Graph v1 (size: M)
- [ ] M2-T4.1 Evidence item model with source, source date, collection date and owner
- [ ] M2-T4.2 Linking and merging of duplicates across sources; conflicts flagged
- [ ] M2-T4.3 List view of evidence by source
Acceptance: the same project from GitHub and the CV shows as one linked item with both sources ([UP-10](03-architecture.md#up-10)).

<a id="m2-t5"></a>
### M2-T5 Job description input and first generation (size: M)
- [ ] M2-T5.1 Paste input with a 15,000-character limit
- [ ] M2-T5.2 Developer role profile v1 and a single-pass writer call with evidence ids in the output
- [ ] M2-T5.3 Thin-profile behaviour: say what is missing, never invent ([UP-8](03-architecture.md#up-8))
Acceptance: for the test profiles, the draft contains only content found in evidence, and a thin profile yields guidance rather than filler.

<a id="m2-t6"></a>
### M2-T6 PDF rendering (size: M)
- [ ] M2-T6.1 Single-column HTML template and Puppeteer rendering in the worker
- [ ] M2-T6.2 One-page fit check with a message about what to trim
- [ ] M2-T6.3 Text-order check using three PDF text extractors; font coverage for names with diacritics
Acceptance: PDF under 300 KB, text extracts in reading order with all three tools, and product copy makes no "ATS-proof" claim ([NFR-15](03-architecture.md#nfr-15), [UP-3](03-architecture.md#up-3), [UP-32](03-architecture.md#up-32)).

<a id="m2-t7"></a>
### M2-T7 Minimal web screens for the slice (size: M)
- [ ] M2-T7.1 Connect sources and see status
- [ ] M2-T7.2 Paste a job description, see progress, open the draft
- [ ] M2-T7.3 Download the PDF
Acceptance: a person outside the team completes the journey without help while observed.

## Milestone M3: Quality engine and editor
Goal: drafts that are checked, attributable and editable.
Definition of done: the evaluation set shows 0 invented claims and every bullet cites evidence or is labelled user-authored; users can edit and regenerate.
Depends on: M2.
Covers: [FR-8](03-architecture.md#fr-8), [FR-9](03-architecture.md#fr-9), [FR-10](03-architecture.md#fr-10), [FR-11](03-architecture.md#fr-11), [NFR-6](03-architecture.md#nfr-6), [NFR-9](03-architecture.md#nfr-9), [NFR-16](03-architecture.md#nfr-16), [UP-9](03-architecture.md#up-9), [UP-11](03-architecture.md#up-11), [UP-12](03-architecture.md#up-12), [UP-13](03-architecture.md#up-13), [UP-15](03-architecture.md#up-15), [UP-19](03-architecture.md#up-19), [UP-22](03-architecture.md#up-22), [UP-23](03-architecture.md#up-23), [UP-33](03-architecture.md#up-33), [UP-36](03-architecture.md#up-36)

<a id="m3-t1"></a>
### M3-T1 AI gateway (size: L)
- [ ] M3-T1.1 Per-role configuration (write, check, extract), each with a primary and fallback model
- [ ] M3-T1.2 Schema-validated output, refusal and truncation handling, timeouts, retries
- [ ] M3-T1.3 Cost and token record per call; daily spend limit with alert at 80%
- [ ] M3-T1.4 Price table including the dates when introductory prices end
Acceptance: a failing primary falls back and the fallback is logged; exceeding the spend limit stops new generations and alerts ([UP-13](03-architecture.md#up-13), [UP-15](03-architecture.md#up-15), [NFR-9](03-architecture.md#nfr-9)).

<a id="m3-t2"></a>
### M3-T2 Evaluation set and harness (size: L)
- [ ] M3-T2.1 At least 40 profiles and job descriptions across roles, including thin, large and injection cases
- [ ] M3-T2.2 Automated metrics: invented claims, bullets with evidence, cost, latency
- [ ] M3-T2.3 Blind human review process and a baseline of human-written resumes
- [ ] M3-T2.4 Measure real token counts and replace the assumptions in [A-42](05-assumptions-risks-questions.md#a-42)
Acceptance: the harness runs from one command and its report is the gate for any prompt or model change; measured cost per resume is recorded for [Q-10](05-assumptions-risks-questions.md#q-10).

<a id="m3-t3"></a>
### M3-T3 Write, check and improve loop (size: L)
- [ ] M3-T3.1 Evidence selection and ranking by job relevance and recency, with an input cap
- [ ] M3-T3.2 Deterministic check that numbers, names and dates in each bullet appear in cited evidence
- [ ] M3-T3.3 Independent checker from a different model family; role rules checked
- [ ] M3-T3.4 Improve step with a limit of 3 attempts; unresolved items flagged or removed
- [ ] M3-T3.5 Writer instruction and checker rule against inferring or adding protected attributes
Acceptance: 0 invented claims on the evaluation set; a bullet that fails 3 attempts is never silently passed ([UP-11](03-architecture.md#up-11), [UP-19](03-architecture.md#up-19), [UP-9](03-architecture.md#up-9), [UP-33](03-architecture.md#up-33)).

<a id="m3-t4"></a>
### M3-T4 Prompt-injection defences (size: M)
- [ ] M3-T4.1 External text passed as delimited data; models have no tools
- [ ] M3-T4.2 Injection cases in the evaluation set (CV text, README, job description)
Acceptance: all injection cases are ignored or flagged; no case changes the instructions followed ([UP-12](03-architecture.md#up-12)).

<a id="m3-t5"></a>
### M3-T5 Evidence review screen (size: M)
- [ ] M3-T5.1 Evidence grouped by source with use, don't use and edit
- [ ] M3-T5.2 Edited wording stored as user-authored evidence
- [ ] M3-T5.3 Excluded items filtered before generation
Acceptance: an excluded item never appears in any generated resume ([FR-8](03-architecture.md#fr-8), [UP-36](03-architecture.md#up-36)).

<a id="m3-t6"></a>
### M3-T6 Editor with attribution (size: L)
- [ ] M3-T6.1 Bullet-level editing, delete and regenerate
- [ ] M3-T6.2 Source panel showing evidence and links per bullet; "user-authored" label when no evidence supports a bullet
- [ ] M3-T6.3 Autosave with versioning per bullet and stale-save handling; local queue for dropped connections
Acceptance: two tabs editing the same bullet never lose an edit silently; the editor recovers after a dropped connection ([UP-22](03-architecture.md#up-22), [UP-23](03-architecture.md#up-23), [FR-11](03-architecture.md#fr-11)).

<a id="m3-t7"></a>
### M3-T7 Length and focus options (size: S)
- [ ] M3-T7.1 One page and full length templates
- [ ] M3-T7.2 Optional focus text passed to selection and writer
Acceptance: the same profile gives clearly different output for two focus values on the evaluation set.

## Milestone M4: Sources, roles and onboarding
Goal: reach the whole audience, not only developers with GitHub.
Definition of done: all six roles generate; LinkedIn import works by paste, PDF and ZIP; onboarding guides a new user to a first draft.
Depends on: M3.
Covers: [FR-2](03-architecture.md#fr-2), [FR-5](03-architecture.md#fr-5), [FR-6](03-architecture.md#fr-6), [FR-17](03-architecture.md#fr-17), [FR-18](03-architecture.md#fr-18), [UP-14](03-architecture.md#up-14), [UP-6](03-architecture.md#up-6)

<a id="m4-t1"></a>
### M4-T1 LinkedIn import (size: L)
- [ ] M4-T1.1 Paste and "Save to PDF" parsers
- [ ] M4-T1.2 Export ZIP reader limited to profile, positions, education, skills and shares, with path and size limits
- [ ] M4-T1.3 Test with at least 3 real exports from team members, and record the real file names and columns ([A-50](05-assumptions-risks-questions.md#a-50), [Q-14](05-assumptions-risks-questions.md#q-14))
Acceptance: each route produces evidence labelled "LinkedIn (user-provided)"; no credentials are ever requested.

<a id="m4-t2"></a>
### M4-T2 Portfolio links (size: M)
- [ ] M4-T2.1 Public page fetcher with address filtering after DNS and on redirects, size and time limits
- [ ] M4-T2.2 Text extraction into evidence with URL and fetch date
Acceptance: private, loopback, metadata and login-gated addresses are refused ([UP-14](03-architecture.md#up-14)).

<a id="m4-t3"></a>
### M4-T3 Role profiles (size: L)
- [ ] M4-T3.1 Rubrics and writing rules for Dev Rel, Social Media Manager, Virtual Assistant, UI/UX Designer, Data Analyst
- [ ] M4-T3.2 Practitioner review of examples for each role
- [ ] M4-T3.3 Evaluation cases for each role
Acceptance: each role passes the quality gate in [NFR-6](03-architecture.md#nfr-6).

<a id="m4-t4"></a>
### M4-T4 Onboarding flow (size: M)
- [ ] M4-T4.1 Role selection and guided source connection, resumable
- [ ] M4-T4.2 Empty states for each step
Acceptance: observed new users reach a first draft in one sitting; leaving and returning resumes at the right step ([FR-2](03-architecture.md#fr-2), [Flow A](03-architecture.md#flow-a-first-time-onboarding-and-source-collection)).

<a id="m4-t5"></a>
### M4-T5 Source status, refresh and partial failure (size: M)
- [ ] M4-T5.1 States: connected, collecting, partial, failed, needs reconnect, disconnected
- [ ] M4-T5.2 Manual refresh and retry
Acceptance: a partial collection shows what arrived and what failed ([UP-6](03-architecture.md#up-6)).

## Milestone M5: Plans, payments and email
Goal: take payment safely and enforce the fair-use cap.
Definition of done: a test user upgrades through Paystack test mode, hits the cap, and recovers from a failed renewal.
Depends on: M3. Needs a payment provider account ([Q-13](05-assumptions-risks-questions.md#q-13)).
Covers: [FR-13](03-architecture.md#fr-13), [FR-14](03-architecture.md#fr-14), [FR-16](03-architecture.md#fr-16), [UP-4](03-architecture.md#up-4), [UP-15](03-architecture.md#up-15), [UP-16](03-architecture.md#up-16), [UP-17](03-architecture.md#up-17), [UP-18](03-architecture.md#up-18), [UP-35](03-architecture.md#up-35)

<a id="m5-t1"></a>
### M5-T1 Plans, entitlements, cap and metering (size: M)
- [ ] M5-T1.1 Plan and entitlement model; cap value in configuration ([Q-10](05-assumptions-risks-questions.md#q-10))
- [ ] M5-T1.2 Usage counter per billing period; cap check before a run, no cap used on a failed run
- [ ] M5-T1.3 Usage display with reset date; money in kobo, times in UTC
Acceptance: a cap change takes effect without a deploy; a failed generation does not reduce the allowance ([UP-15](03-architecture.md#up-15), [UP-35](03-architecture.md#up-35)).

<a id="m5-t2"></a>
### M5-T2 Paystack checkout and webhooks (size: L)
- [ ] M5-T2.1 Checkout with idempotency key and plan reference
- [ ] M5-T2.2 Signature verification, unique event storage, state-based processing
- [ ] M5-T2.3 Return-page reconciliation by payment reference
- [ ] M5-T2.4 Test every case in [Flow C](03-architecture.md#flow-c-upgrade-to-pro) in test mode
Acceptance: duplicate, out-of-order and forged webhooks change nothing; paid users get Pro within 60 seconds of the webhook ([UP-16](03-architecture.md#up-16), [UP-17](03-architecture.md#up-17)).

<a id="m5-t3"></a>
### M5-T3 Renewal failure, grace and cancellation (size: M)
- [ ] M5-T3.1 Subscription state held by the app, independent of provider retry behaviour
- [ ] M5-T3.2 Grace period, expiring-card notice and cancellation at period end
Acceptance: each state transition has a test and an email ([UP-18](03-architecture.md#up-18)). This task settles the provider's retry behaviour ([A-28](05-assumptions-risks-questions.md#a-28)).

<a id="m5-t4"></a>
### M5-T4 Transactional email (size: M)
- [ ] M5-T4.1 Domain authentication (SPF, DKIM, DMARC) and templates
- [ ] M5-T4.2 Queued sending with retries; bounce handling; daily limit awareness ([A-27](05-assumptions-risks-questions.md#a-27))
Acceptance: authentication passes on a mail checker; a bounced address is flagged ([FR-16](03-architecture.md#fr-16), [UP-4](03-architecture.md#up-4)).

<a id="m5-t5"></a>
### M5-T5 Reconciliation job (size: S)
- [ ] M5-T5.1 Scheduled comparison of provider records and local state with a report of mismatches
Acceptance: an induced mismatch is reported and fixed ([UP-16](03-architecture.md#up-16)).

## Milestone M6: Privacy, compliance and support tools
Goal: meet the data protection duties and give users control.
Definition of done: consent is recorded before first generation; deletion and export work end to end; legal documents and the impact assessment are ready for counsel.
Depends on: M3.
Covers: [FR-15](03-architecture.md#fr-15), [FR-19](03-architecture.md#fr-19), [NFR-8](03-architecture.md#nfr-8), [UP-29](03-architecture.md#up-29), [UP-30](03-architecture.md#up-30)

<a id="m6-t1"></a>
### M6-T1 Consent and disclosure (size: M)
- [ ] M6-T1.1 Consent for processing and for sending data to AI providers, with text version and time
- [ ] M6-T1.2 Plain-language "what we collect and why" screen
Acceptance: no generation can start without a consent record ([FR-15](03-architecture.md#fr-15)).

<a id="m6-t2"></a>
### M6-T2 Data export and account deletion (size: L)
- [ ] M6-T2.1 Export of the user's data in a readable file
- [ ] M6-T2.2 Deletion cascade across tables and storage; cancel running jobs
- [ ] M6-T2.3 Confirmation email and a test that scans every table and path
Acceptance: after deletion the scan finds nothing for that user ([UP-30](03-architecture.md#up-30), [NFR-8](03-architecture.md#nfr-8)).

<a id="m6-t3"></a>
### M6-T3 Retention jobs (size: M)
- [ ] M6-T3.1 Scheduled removal of uploaded files, LLM call records, webhook events and audit entries per the retention table
Acceptance: data older than its retention period is removed in a test run ([Q-9](05-assumptions-risks-questions.md#q-9)).

<a id="m6-t4"></a>
### M6-T4 Legal documents and impact assessment (size: L)
- [ ] M6-T4.1 Privacy policy, terms of service, consent text, data processing terms for organisations (drafts for counsel)
- [ ] M6-T4.2 Data protection impact assessment draft covering profiling and cross-border transfer ([A-13](05-assumptions-risks-questions.md#a-13), [A-14](05-assumptions-risks-questions.md#a-14))
- [ ] M6-T4.3 Counsel decisions on registration, DPO and audit returns recorded ([Q-6](05-assumptions-risks-questions.md#q-6))
- [ ] M6-T4.4 AI provider terms read and data-handling terms recorded ([Q-11](05-assumptions-risks-questions.md#q-11))
Acceptance: counsel has reviewed and approved the documents, or the open points are listed in [05-assumptions-risks-questions.md](05-assumptions-risks-questions.md).

<a id="m6-t5"></a>
### M6-T5 Support and admin tools with audit (size: M)
- [ ] M6-T5.1 Job lookup, re-run, cancel; suspend account or key
- [ ] M6-T5.2 Logged "view as support" step with reason; append-only audit log
- [ ] M6-T5.3 Confirmation and soft-delete window on destructive actions
Acceptance: no staff action is possible without an audit entry ([UP-29](03-architecture.md#up-29)).

## Milestone M7: Private beta readiness, hardening and documentation
Goal: be safe and understandable for 50 handpicked students.
Definition of done: load, security and recovery checks pass; help content and runbooks exist; feedback is captured.
Depends on: M2 to M4 (M5 and M6 for public launch).
Covers: [NFR-3](03-architecture.md#nfr-3), [NFR-10](03-architecture.md#nfr-10), [NFR-11](03-architecture.md#nfr-11), [NFR-12](03-architecture.md#nfr-12), [NFR-13](03-architecture.md#nfr-13), [NFR-17](03-architecture.md#nfr-17), [NFR-18](03-architecture.md#nfr-18), [UP-2](03-architecture.md#up-2), [UP-21](03-architecture.md#up-21), [UP-23](03-architecture.md#up-23), [UP-25](03-architecture.md#up-25), [UP-26](03-architecture.md#up-26), [UP-32](03-architecture.md#up-32), [UP-33](03-architecture.md#up-33)

<a id="m7-t1"></a>
### M7-T1 Load and low-bandwidth testing (size: M)
- [ ] M7-T1.1 100 concurrent generations; queue depth and latency checked
- [ ] M7-T1.2 Slow 4G and real low-end Android tests of the main flows
- [ ] M7-T1.3 Accessibility and browser checks
Acceptance: [NFR-1](03-architecture.md#nfr-1), [NFR-10](03-architecture.md#nfr-10), [NFR-11](03-architecture.md#nfr-11), [NFR-12](03-architecture.md#nfr-12) and [NFR-17](03-architecture.md#nfr-17) are met or the gaps are recorded.

<a id="m7-t2"></a>
### M7-T2 Security testing (size: M)
- [ ] M7-T2.1 Review of file handling, ZIP limits and SSRF protections
- [ ] M7-T2.2 Authorisation tests on every endpoint; rate-limit tests ([NFR-18](03-architecture.md#nfr-18))
- [ ] M7-T2.3 Dependency scan and a basic penetration pass
Acceptance: no open high-severity finding ([UP-2](03-architecture.md#up-2)).

<a id="m7-t3"></a>
### M7-T3 Backup and recovery drills (size: M)
- [ ] M7-T3.1 Restore a database backup into a fresh instance; confirm the plan's backup features ([A-57](05-assumptions-risks-questions.md#a-57))
- [ ] M7-T3.2 Kill Redis and the worker mid-job and confirm recovery
Acceptance: restore meets the targets in [NFR-13](03-architecture.md#nfr-13) ([UP-21](03-architecture.md#up-21), [UP-25](03-architecture.md#up-25)).

<a id="m7-t4"></a>
### M7-T4 Runbooks and alert tuning (size: S)
- [ ] M7-T4.1 Short runbooks for stuck queue, provider outage, leaked key or secret, payment mismatch, deletion, bad deploy
- [ ] M7-T4.2 Alert thresholds tuned so alerts are few and actionable
Acceptance: each runbook is followed once on staging ([UP-26](03-architecture.md#up-26)).

<a id="m7-t5"></a>
### M7-T5 User help content and example library (size: M)
- [ ] M7-T5.1 Help pages: connecting sources, LinkedIn and X export steps, reading the source panel, what the PDF check does and does not promise
- [ ] M7-T5.2 Example resumes with written permission or purpose-written ([01-overview.md](01-overview.md#groundwork))
Acceptance: beta users can finish the main journey using the help pages alone ([UP-32](03-architecture.md#up-32)).

<a id="m7-t6"></a>
### M7-T6 Beta feedback and product analytics (size: S)
- [ ] M7-T6.1 Event tracking for the metrics in [01-overview.md](01-overview.md#goals-non-goals-success-metrics), with no resume text
- [ ] M7-T6.2 Feedback button on every draft, with a flag for biased or inappropriate output
Acceptance: each metric in the overview can be read from the events ([UP-33](03-architecture.md#up-33)).

## Milestone M8: Phase 2 sources and features
Goal: add the sources and features moved out of the first release.
Definition of done: each task below is promoted from Could only when its acceptance is written and agreed.
Depends on: M4, and M5 for paid features.
Covers: [FR-24](03-architecture.md#fr-24), [FR-25](03-architecture.md#fr-25), [UP-31](03-architecture.md#up-31)

<a id="m8-t1"></a>
### M8-T1 X archive import (size: M)
- [ ] M8-T1.1 Read only the posts file from the archive ZIP, strip the JavaScript prefix, discard everything else on upload
- [ ] M8-T1.2 Test with real archives and record the real format ([A-53](05-assumptions-risks-questions.md#a-53), [Q-14](05-assumptions-risks-questions.md#q-14))
- [ ] M8-T1.3 Apply the X developer policy to stored content ([Q-15](05-assumptions-risks-questions.md#q-15))
Acceptance: direct messages and other files are never stored or read ([UP-2](03-architecture.md#up-2), [UP-31](03-architecture.md#up-31)).

<a id="m8-t2"></a>
### M8-T2 Figma (size: M)
- [ ] M8-T2.1 OAuth with `file_content:read`, `file_metadata:read` and `folders:read`
- [ ] M8-T2.2 Link-based title and thumbnail through the embed endpoint where the link is public
Acceptance: a user connects and picks files they can open; a private link without access gives a clear message ([A-54](05-assumptions-risks-questions.md#a-54), [A-55](05-assumptions-risks-questions.md#a-55)).

<a id="m8-t3"></a>
### M8-T3 Behance and portfolio PDF (size: S)
- [ ] M8-T3.1 Pasted Behance links through the portfolio fetcher; PDF upload; manual entry
Acceptance: no use of an unavailable Behance API ([A-56](05-assumptions-risks-questions.md#a-56)).

<a id="m8-t4"></a>
### M8-T4 DOCX export (size: M)
- [ ] M8-T4.1 Build Word output with the same content and structure as the PDF
Acceptance: opens cleanly in Word and Google Docs with selectable text.

<a id="m8-t5"></a>
### M8-T5 Match report with gap suggestions (size: L)
- [ ] M8-T5.1 Compare a job description with the graph and report matched, weak and missing items
- [ ] M8-T5.2 Suggestions name the evidence the user could add, and never add claims
Acceptance: every suggestion points to a real gap; none proposes an unsupported claim ([NG-6](01-overview.md#goals-non-goals-success-metrics)).

<a id="m8-t6"></a>
### M8-T6 Full evidence library (size: L)
- [ ] M8-T6.1 Browse, search, tag and edit all evidence across sources
Acceptance: semantic search quality measured against a test set, and the embedding model and its price are chosen ([A-36](05-assumptions-risks-questions.md#a-36)).

<a id="m8-t7"></a>
### M8-T7 Saved resumes per job (size: M)
- [ ] M8-T7.1 List, rename, duplicate and archive resumes tied to job descriptions
Acceptance: opening a saved resume restores its job description, options and evidence links.

## Milestone M9: Organisation API with per-client keys
Goal: let organisations such as ITConnect request resumes for users who consented, with limits and an audit trail.
Definition of done: a sandbox client and a live client exist; a consent link, a generation request and a webhook complete end to end; usage is metered; documentation is published.
Depends on: M3, M5 (usage and billing concepts), M6 (consent and audit). Counsel has reviewed the B2B model ([A-48](05-assumptions-risks-questions.md#a-48)).
Covers: [FR-20](03-architecture.md#fr-20), [FR-21](03-architecture.md#fr-21), [FR-22](03-architecture.md#fr-22), [FR-23](03-architecture.md#fr-23), [NFR-4](03-architecture.md#nfr-4), [NFR-7](03-architecture.md#nfr-7), [UP-27](03-architecture.md#up-27), [UP-28](03-architecture.md#up-28), [UP-34](03-architecture.md#up-34)

<a id="m9-t1"></a>
### M9-T1 Clients and key management (size: L)
- [ ] M9-T1.1 Client records and multiple labelled keys per client, live and sandbox
- [ ] M9-T1.2 Key format with prefix and hashed secret, shown once; rotation, expiry, revocation
- [ ] M9-T1.3 Staff and client-facing key screens
Acceptance: a created key works, its secret cannot be read again, and a revoked key fails within 60 seconds ([FR-20](03-architecture.md#fr-20)).

<a id="m9-t2"></a>
### M9-T2 Key authentication, scopes, rate limits and quotas (size: L)
- [ ] M9-T2.1 Constant-time key check; per-IP limits on failed attempts
- [ ] M9-T2.2 Scopes per key, per-key rate limits and quotas with headers
- [ ] M9-T2.3 Problem-shaped errors and idempotency keys on state-changing calls
Acceptance: brute-force and over-quota tests pass ([UP-27](03-architecture.md#up-27), [UP-34](03-architecture.md#up-34), [NFR-4](03-architecture.md#nfr-4)).

<a id="m9-t3"></a>
### M9-T3 User consent for clients (size: M)
- [ ] M9-T3.1 Consent link, grant screen with named client and scope, revoke screen
- [ ] M9-T3.2 Consent check on every call; identical response for unknown and non-consenting users
Acceptance: calls without an active grant reveal nothing; cross-client tests all fail to read data ([UP-28](03-architecture.md#up-28), [UP-34](03-architecture.md#up-34), [NFR-7](03-architecture.md#nfr-7)).

<a id="m9-t4"></a>
### M9-T4 Organisation endpoints and webhooks (size: L)
- [ ] M9-T4.1 Profile read, resume generation (through the same engine and checks), job polling
- [ ] M9-T4.2 Signed webhooks with timestamp, retries with backoff; results stay fetchable
Acceptance: a down receiver does not lose results ([UP-34](03-architecture.md#up-34), [FR-22](03-architecture.md#fr-22)).

<a id="m9-t5"></a>
### M9-T5 Metering and audit (size: M)
- [ ] M9-T5.1 Usage events per call; totals per client and key; client usage endpoint
- [ ] M9-T5.2 Reconciliation of totals against events
Acceptance: totals match events within 0.1% ([FR-23](03-architecture.md#fr-23)).

<a id="m9-t6"></a>
### M9-T6 Sandbox mode (size: M)
- [ ] M9-T6.1 Sandbox keys return fixed synthetic data and never touch real users or AI spend
Acceptance: a sandbox key cannot read real data in any test.

<a id="m9-t7"></a>
### M9-T7 API documentation and first-client onboarding (size: M)
- [ ] M9-T7.1 Reference, authentication, errors, rate limits, webhooks, sandbox, changelog policy
- [ ] M9-T7.2 ITConnect onboarding checklist and data processing terms signed
Acceptance: a developer outside the team completes a sandbox integration from the documentation alone.

Next: [Assumptions, Risks, Open Questions](05-assumptions-risks-questions.md)
