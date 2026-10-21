# Overview

Status: Draft for review | Owner: Tracck Founding Team | Last updated: 2026-10-19 | Builds on: v2.0 PRD (October 2026)

## Problem and opportunity

Nigerian tech talent, mainly university students, NYSC corpers and self-taught developers, ships real work in public (code on GitHub, talks, posts, portfolios, designs). When they apply for an internship or job, their resume does not reflect that work. Three things cause it:

1. The evidence is scattered across four or five platforms and nobody compiles it.
2. One generic resume goes to every job, so it misses the emphasis and keywords each job asks for.
3. People are never taught the resume conventions for their role, so strong work reads as weak, unscannable text.

The founding team's view is that this is a record-keeping and translation problem, not a writing-skill problem ([A-2](05-assumptions-risks-questions.md#a-2), unverified: no survey was found). Generic AI resume tools do not fix it. They start from a blank page or a prompt and write fiction that cannot be traced to anything real.

**Opportunity.** Tracck keeps a verified record of what a person has built, shipped and led, and turns it into a resume tailored to a specific job. Every claim traces back to evidence the user supplied. A second market follows from the same record: universities, bootcamps and job platforms that want to give their people ready resumes, served through an API with per-client keys.

**Size of the early market.** NYSC plans to mobilise about 418,000 corps members in 2026 ([A-1](05-assumptions-risks-questions.md#a-1)). Only part of each batch studies IT, and no IT share was found, so this is an upper bound for one segment and not a market size. A bottom-up estimate is an open task for the private beta.

## Target audience

| Segment | Pain | Current workaround | Evidence (source) |
|---|---|---|---|
| IT undergraduates (200 to 400 level) | No time or know-how to document projects before graduating | A generic CV copied from a template, rarely updated | Team observation ([A-2](05-assumptions-risks-questions.md#a-2)) |
| NYSC corpers (IT) | Service-year work (CDS groups, events, projects) is hard to describe in hiring language | A short CV written at the last minute | Team observation. Mobilisation scale: [A-1](05-assumptions-risks-questions.md#a-1) |
| Self-taught developers and bootcamp graduates | Projects exist, but recruiters need them translated into roles and outcomes | A GitHub link and a one-paragraph summary | Team observation |
| Junior designers | Portfolio work is visual, so resumes under-describe it | A Behance or Figma link with no written case studies | Team observation |
| Tech-adjacent roles (social media managers, virtual assistants, Dev Rel, community managers) | Non-code contributions look "less real" on a resume | Lists of duties with no results | Team observation |
| Organisations (B2B): universities, bootcamps, job platforms, ITConnect | Their people apply with weak resumes, which hurts placement | In-house CV clinics and workshops | Founding team's plan. No customer interviews yet |

Evidence for the pain in every row is the founding team's own observation. Interviewing 15 to 20 people across these segments during the private beta is the way to close this ([Q-7](05-assumptions-risks-questions.md#q-7)).

## Market and competitors

| Competitor | What they do well | Gaps for this audience | Pricing | Source |
|---|---|---|---|---|
| Teal | Resume builder plus job tracker, unlimited resumes, keyword matching against a pasted job | Starts from the user typing or pasting their resume, not from evidence. Billed in dollars | Free (10 AI bullet credits). Teal+ $13 per week, $29 per month, $79 per quarter | [Teal](https://www.tealhq.com/pricing) ([A-4](05-assumptions-risks-questions.md#a-4)) |
| Rezi | AI writer and editor, scoring on 23 metrics, exports to PDF, DOCX and Google Drive | Same blank-page start. Dollar pricing | Free. Pro $29 per month. Lifetime $149. Enterprise $99 per month per 200 users | [Rezi](https://www.rezi.ai/pricing) ([A-5](05-assumptions-risks-questions.md#a-5)) |
| Jobscan | Match report between a resume and a job description | Analyses an existing resume, does not write one from evidence. High price | Free (5 scans per month). Paid $49.95 per month (secondary source) | [Review](https://blog.theinterviewguys.com/?p=10428) ([A-6](05-assumptions-risks-questions.md#a-6)) |
| Kickresume | AI writer, ATS checker, LinkedIn and PDF import, free premium for verified students | Imports a LinkedIn profile or PDF, which is not the same as reading a person's work | Free. About $19 per month. Cheaper on longer plans (secondary source) | [Toolradar](https://toolradar.com/tools/kickresume/pricing) ([A-7](05-assumptions-risks-questions.md#a-7)) |
| Finezcv (Lagos) | AI resume builder for the local market | Details hidden. Not checked beyond its listing | Not public | [VC4A](https://vc4a.com/ventures/finezcv) ([A-8](05-assumptions-risks-questions.md#a-8)) |
| Resume.io, Enhancv and similar template builders | Polished templates | Formatting is not the hard problem Tracck solves | Not checked | Not checked |
| Tools that build a resume from public work | Not found | Only small hobby and hackathon projects turned up. The search was not exhaustive | n/a | [A-9](05-assumptions-risks-questions.md#a-9) |

Things this table does not tell you: whether Nigerian users care about any of these tools' features, whether they would pay in naira, and how LinkedIn's own AI features compare. The first two are tested in the private beta, and the third has not been checked.

**Price comparison.** Competitor prices are in dollars. Tracck's planned Pro price is ₦2,500 per month. I did not look up an exchange rate, so no comparison is made here. Do the conversion at the current rate before setting prices.

## Positioning and ship plan

**Position.** For early-career technical and creative talent in Nigeria, Tracck is the record-keeping layer between public work and the job application. Generic resume builders start from a blank page. Tracck starts from evidence the user already produced.

**Differentiators**
- Every claim traces to something the user provided, and nothing publishes without the user opening the draft.
- The record is built once and reused for every job. Each application gets its own tailored resume.
- Role-specific writing and scoring for six roles, not one generic template.
- Designed for Nigerian conditions: background processing for slow connections, naira pricing and local payment rails ([A-10](05-assumptions-risks-questions.md#a-10)), and a clear route for each source that restricts access.
- A second product for organisations through the API, with per-client keys and user consent.

**MVP (Phase 1).** The smallest version that proves the claim "a resume you would send, in minutes, traceable to your work":
1. Accounts, role selection and onboarding.
2. GitHub, CV upload, portfolio link and LinkedIn import (export, PDF or paste) as sources, collected in the background.
3. The Career Graph.
4. Paste a job description, choose one page or full, optionally add a focus, and get a draft through the write, check and improve engine.
5. An editor with source attribution for every bullet, and a light review of collected evidence.
6. PDF export.

The thinnest vertical slice is GitHub plus CV upload, one role (Developer), one page, and a PDF. It exercises every layer and can go to private beta users before other sources and roles are added ([04-requirements.md](04-requirements.md)).

**Out of Phase 1:** X, Figma, DOCX, the match report with gap suggestions, the full evidence library, saved resumes per job, the public profile link, and the organisation API. These stay in the v2.0 roadmap.

**Go-to-market in brief** (carried over from v1.0). Start with IT students at the University of Ibadan, UNILAG and FUTA, through campus ambassadors, GDSC and tech-club workshops, and building in public on X. Private beta with 50 handpicked students, then public launch with a waitlist. Tracck launches standalone, and ITConnect becomes the first API customer (decided 2026-10-16).

## Groundwork

Settle these before building, or in parallel with the first milestone:

1. **Data protection law.** The Nigeria Data Protection Act 2023 governs, with the GAID 2025 as the implementing directive ([A-11](05-assumptions-risks-questions.md#a-11)). A law-firm summary says an organisation processing the data of 2,500 or more people must register as a controller of major importance, appoint a data protection officer, and at 10,000 or more file an annual compliance audit return ([A-12](05-assumptions-risks-questions.md#a-12)). Tracck's 10,000-user goal would put it in the middle tier. Impact assessments are required before profiling or before launching software that processes personal data ([A-13](05-assumptions-risks-questions.md#a-13)), and sending data to a foreign AI provider is a cross-border transfer ([A-14](05-assumptions-risks-questions.md#a-14)). Nigerian counsel confirms all of it ([Q-6](05-assumptions-risks-questions.md#q-6)).
2. **Platform terms.** Each source has rules on what can be collected and passed on, covered in [02-tech-stack.md](02-tech-stack.md) and [03-architecture.md](03-architecture.md). GitHub's policy on selling personal information to recruiters and job boards matters for the B2B product.
3. **Accounts and approvals to open early:** a GitHub OAuth app, Google sign-in approval, a transactional email domain (sender authentication), a payment provider account, and an AI provider agreement with data-handling terms. X and Figma accounts follow in Phase 2. Approval timelines for each are unchecked.
4. **Example resume library.** Needs written permission or purpose-written examples, built with hiring managers and senior practitioners.
5. **Legal documents.** A privacy policy, terms of service, consent screens, and data processing terms for organisation customers.
6. **Name check.** A basic search found no conflicting product, but no trademark or domain check was done ([A-15](05-assumptions-risks-questions.md#a-15), [Q-8](05-assumptions-risks-questions.md#q-8)).
7. **Cost per resume.** Measured before limits and prices are final.

## Goals, non-goals, success metrics

**Goals**
- G-1. A user connects at least one source and receives a first draft resume the same session, with every claim traceable to evidence.
- G-2. Resumes that reviewers rate at least equal to a human-written baseline for the same role.
- G-3. 10,000 registered users within 6 months of launch.
- G-4. A working organisation API with per-client keys and user consent, with ITConnect as the first client.

**Non-goals** (the first three are from the brand positioning)
- NG-1. Not a generic AI resume generator that writes from a prompt.
- NG-2. Not a template marketplace.
- NG-3. Not a social network.
- NG-4. No scraping of any platform and no use of third-party scraping providers.
- NG-5. No cover letters, no interview preparation, no job board or job search, and no automatic applications (confirmed 2026-10-19).
- NG-6. No resume that makes a claim the user has no evidence for, even if the job asks for it.

**Metrics.** There is no baseline because the product has not launched. Targets are proposals to validate in the private beta.

| Metric | Baseline | Target | Timeframe | How measured |
|---|---|---|---|---|
| Registered users | 0 | 2,000 then 10,000 | 3 months, then 6 months after launch | Accounts table |
| Users with at least one source fully collected | n/a | 70% then 85% | 3 months, then 6 months after launch | Source status events |
| Users who generate at least one resume | n/a | 60% then 80% | 3 months, then 6 months after launch | Generation events |
| Draft-to-export rate | n/a | 50% then 65% | 3 months, then 6 months after launch | Export events divided by drafts |
| Median time from request to finished draft | n/a | under 90 seconds, then under 60 | 3 months, then 6 months after launch | Job timing in the queue |
| Reviewer rating against a human-written resume | n/a | on par, then better | 3 months, then 6 months after launch | Blind review on the test set |
| Organisation API clients live | 0 | 1 (ITConnect) | At API launch | Key and usage records |

**Primary metric (north star).** Resumes generated and exported per week. A resume counts only if the user exported or shared it.

**Guardrail metrics (must not break)**
- Claims on a resume traceable to real evidence: 100%. Invented numbers on the test set: 0.
- Cost per generated resume stays under the figure set once measured ([Q-10](05-assumptions-risks-questions.md#q-10)).
- Source deletion requests completed within the period stated in the privacy policy.
- No organisation customer receives a user's data without that user's consent.

Next: [Tech Stack and Tools](02-tech-stack.md)
