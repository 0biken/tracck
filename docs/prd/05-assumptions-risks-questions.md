# Assumptions, Risks, Open Questions

Last updated: 2026-10-19. Status values: Verified (read in a source on the date checked), Unverified (no source found, or only a secondary one), Contradicted (a source says otherwise). Nothing is marked Contradicted in this ledger; two corrections to the v1.0 PRD are listed below.

## Decisions already made

- Team: one developer. No timeline and no budget are stated in this PRD, by instruction (2026-10-19).
- Non-goals NG-1 to NG-6 confirmed ([01-overview.md](01-overview.md#goals-non-goals-success-metrics)).
- Standalone launch with ITConnect as the first API customer; no export score threshold; paste-only job descriptions; light evidence review in Phase 1 (2026-10-16).
- Tech stack approved as written; Pro plan gets a fair-use cap, value open ([Q-10](#q-10)) (2026-10-19).

**Corrections to earlier drafts.** v1.0 assumed a 90-day GitHub Events history and that the LinkedIn `w_member_social` permission could read posts. The Events API covers 30 days and 300 events ([A-44](#a-44)), and `w_member_social` only creates posts ([A-49](#a-49)). v1.0 also cited the NDPR, which is no longer in effect ([A-11](#a-11)).

## Assumption ledger

| ID | Assumption | Status (Verified / Contradicted / Unverified) | Evidence and source URL | Date checked |
|---|---|---|---|---|
| <a id="a-1"></a>A-1 | NYSC plans to mobilise 418,000 corps members in 2026, including 50,000 added slots | Verified (news report) | [NAN News, 6 Mar 2026](https://nannews.ng/tinubu-approves-additional-50000-for-nysc-mobilisation-in-2026/). The prior cap of about 368,000 is my subtraction, not a stated figure. Only part of each batch studies IT, and no IT share was found | 2026-10-19 |
| <a id="a-2"></a>A-2 | Nigerian students and corpers describe their work poorly on resumes even when the work is strong | Unverified | This is the founding team's observation. No survey or study was found | 2026-10-19 |
| <a id="a-3"></a>A-3 | Nigerian employers use ATS software enough that ATS-safe formatting matters | Unverified | Only a 2017 Techpoint opinion piece says ATS use is spreading. A recruitment guide (Rivermate) has no ATS data. Formatting for ATS is cheap, but do not treat it as a proven selling point until employers are asked | 2026-10-19 |
| <a id="a-4"></a>A-4 | Teal+ costs $13 per week, $29 per month or $79 per quarter. The free plan has 10 AI bullet credits and top-5 keyword matching | Verified | [Teal pricing](https://www.tealhq.com/pricing) | 2026-10-19 |
| <a id="a-5"></a>A-5 | Rezi Pro is $29 per month, Lifetime $149, Enterprise $99 per month per 200 users. Its score uses 23 metrics | Verified | [Rezi pricing](https://www.rezi.ai/pricing) | 2026-10-19 |
| <a id="a-6"></a>A-6 | Jobscan: free plan with 5 scans per month, paid $49.95 per month or $89.95 per quarter | Unverified (secondary source only) | [The Interview Guys review](https://blog.theinterviewguys.com/?p=10428). Jobscan's own pricing page did not load | 2026-10-19 |
| <a id="a-7"></a>A-7 | Kickresume: free plan, $19 per month, $13 per month quarterly, $5 per month yearly, with free premium for verified students | Unverified (secondary source, inconsistent currency) | [Toolradar](https://toolradar.com/tools/kickresume/pricing). Confirm on Kickresume's own site | 2026-10-19 |
| <a id="a-8"></a>A-8 | A Lagos-based AI resume builder (Finezcv) exists. Its pricing and stage are not public | Verified (existence only) | [VC4A listing](https://vc4a.com/ventures/finezcv) | 2026-10-19 |
| <a id="a-9"></a>A-9 | No established tool builds a resume from a user's public work with traceable evidence | Unverified | Searches found only small hobby or hackathon projects. The search was not exhaustive and I did not check LinkedIn's own AI features | 2026-10-19 |
| <a id="a-10"></a>A-10 | Paystack local charge is 1.5% + ₦100 (₦100 waived under ₦2,500), capped at ₦2,000. International cards are 3.9% + ₦100 | Verified | [Paystack charges](https://support.paystack.com/hc/en-us/articles/360009881920-What-are-Paystack-s-transaction-charges) | 2026-10-19 |
| <a id="a-11"></a>A-11 | The Nigeria Data Protection Act 2023 governs. The NDPR is no longer in effect. The GAID (issued 20 March 2025) took effect 19 September 2025 | Verified (law-firm summary) | [DLA Piper](https://privacymatters.dlapiper.com/2025/06/nigeria-ndpc-issues-gaid-key-compliance-insights/). The source does not reconcile the dates. Counsel to confirm | 2026-10-19 |
| <a id="a-12"></a>A-12 | Under the GAID, an organisation processing the data of 2,500 to 9,999 people is an "ordinary-high" controller of major importance, 10,000 to 49,999 "extra-high", 50,000 or more "ultra-high". These must register. Extra-high and ultra-high file an annual Compliance Audit Return. All must appoint a data protection officer | Unverified (law-firm summary, fee amounts not found) | [Mondaq guide](https://www.mondaq.com/nigeria/privacy-protection/1693812/navigating-the-nigeria-data-protection-act-general-application-and-implementation-directive-ndpa-gaid-a-guide-for-businesses). Counsel to confirm thresholds, fees and whether the count is per year | 2026-10-19 |
| <a id="a-13"></a>A-13 | A data protection impact assessment is required before high-risk processing such as profiling or automated decision-making, and before launching software that processes personal data | Unverified (same summary) | Same Mondaq guide. Counsel to confirm which Tracck features trigger it | 2026-10-19 |
| <a id="a-14"></a>A-14 | Sending personal data abroad (for example to a foreign AI provider) needs an adequacy decision, an approved transfer instrument, or another lawful basis such as consent, and the justification goes into the annual filing | Unverified (same summary) | Same Mondaq guide. Counsel to confirm | 2026-10-19 |
| <a id="a-15"></a>A-15 | The name "Tracck" has no obvious conflict with an existing career or resume product | Unverified | One web search found nothing relevant. No trademark or domain check was done | 2026-10-19 |
| <a id="a-16"></a>A-16 | Supabase Free: 500 MB database, 50,000 auth MAUs, 1 GB storage, paused after 1 week of inactivity. Pro: $25 per month, 8 GB database, 100,000 MAUs, 100 GB storage, $10 compute credit | Verified | [Supabase pricing](https://supabase.com/pricing) | 2026-10-19 |
| <a id="a-17"></a>A-17 | Supabase has no African region. European regions: Frankfurt, Ireland, London, Paris, Zurich, Stockholm | Verified | [Supabase regions](https://supabase.com/docs/guides/platform/regions) | 2026-10-19 |
| <a id="a-18"></a>A-18 | Neon: free plan (1 GB per project), pay-as-you-go from $0.106 per compute-hour and $0.35 per GB-month, pgvector on all plans. Regions: Frankfurt, London, US, Singapore, Sydney, São Paulo. None in Africa | Verified | [Neon pricing](https://neon.com/pricing), [Neon regions](https://neon.com/docs/introduction/regions) | 2026-10-19 |
| <a id="a-19"></a>A-19 | Upstash Redis: pay-as-you-go $0.20 per 100,000 commands, free 500,000 commands per month, fixed plans from $10 for 250 MB with no per-command billing | Verified (prices) | [Upstash pricing](https://upstash.com/pricing/redis) | 2026-10-19 |
| <a id="a-20"></a>A-20 | BullMQ requires Redis with `maxmemory-policy noeviction` and recommends append-only-file persistence about once per second. Hosted Redis often lacks persistence by default | Verified | [BullMQ production guide](https://docs.bullmq.io/guide/going-to-production) | 2026-10-19 |
| <a id="a-21"></a>A-21 | Upstash Redis keeps BullMQ jobs safely (eviction setting and persistence) | Unverified | Neither page mentions the other. Test before relying on it | 2026-10-19 |
| <a id="a-22"></a>A-22 | Railway: Hobby $5 and Pro $20 minimum usage, billed per second of use (CPU $0.00000772 per vCPU-second, memory $0.00000386 per GB-second, egress $0.05 per GB) | Verified | [Railway pricing](https://railway.com/pricing) | 2026-10-19 |
| <a id="a-23"></a>A-23 | Railway offers a region close to Nigeria | Unverified | The pricing page does not list regions | 2026-10-19 |
| <a id="a-24"></a>A-24 | Vercel Hobby is for personal, non-commercial use only. Pro is $20 per month with $20 usage credit | Verified | [Vercel pricing](https://vercel.com/pricing) | 2026-10-19 |
| <a id="a-25"></a>A-25 | Hetzner Cloud has locations in Germany, Finland, Singapore and the USA, none in Africa. Plan specs are listed but prices did not load | Verified (locations), Unverified (prices) | [Hetzner Cloud](https://www.hetzner.com/cloud/), [plans](https://www.hetzner.com/cloud/regular-performance/) | 2026-10-19 |
| <a id="a-26"></a>A-26 | Cloudflare R2: $0.015 per GB-month, no egress fees, 10 GB free storage per month | Verified | [R2 pricing](https://developers.cloudflare.com/r2/pricing/) | 2026-10-19 |
| <a id="a-27"></a>A-27 | Resend Free: 3,000 emails per month and 100 per day. Pro: $20 per month for 50,000 emails | Verified | [Resend pricing](https://resend.com/pricing) | 2026-10-19 |
| <a id="a-28"></a>A-28 | Paystack supports plans (hourly to annual), subscriptions, reusable card authorisations and direct debit for Nigerian businesses. Docs disagree on whether failed subscription charges are retried | Verified (features), Unverified (retry behaviour) | [Paystack recurring charges](https://paystack.com/docs/payments/recurring-charges/), [subscriptions](https://paystack.com/docs/payments/subscriptions/) | 2026-10-19 |
| <a id="a-29"></a>A-29 | Paystack requires a registered business to go live in Nigeria | Unverified | Not found in the pages read | 2026-10-19 |
| <a id="a-30"></a>A-30 | Flutterwave charges 2% on local collections. Its subscription support is not stated on its pricing page | Verified (fee), Unverified (subscriptions) | [Flutterwave pricing](https://flutterwave.com/ng/pricing) | 2026-10-19 |
| <a id="a-31"></a>A-31 | OpenAI Structured Outputs guarantee JSON-schema adherence, with refusals detectable in code | Verified | [OpenAI docs](https://developers.openai.com/api/docs/guides/structured-outputs) | 2026-10-19 |
| <a id="a-32"></a>A-32 | Gemini supports JSON-schema structured output with a supported subset of keywords. Output can still be semantically wrong, so values must be validated | Verified | [Gemini docs](https://ai.google.dev/gemini-api/docs/structured-output) | 2026-10-19 |
| <a id="a-33"></a>A-33 | Gemini prices per 1M tokens (input / output): 4 Argon $2 / $10 until 30 Nov 2026 then $4 / $20; 3.8 Flash $0.75 / $3.75 until 31 Dec 2026 then $1.50 / $7.50; 3.5 Flash-Lite $0.30 / $2.50. Paid-tier data is not used to improve products | Verified | [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) | 2026-10-19 |
| <a id="a-34"></a>A-34 | OpenAI prices per 1M tokens (input / output): GPT-6.1 Sol $2 / $10, GPT-6 Luna $0.10 / $0.50, GPT-6 Astra $10 / $50 | Unverified (third-party page) | [Morph](https://morphllm.com/openai-api-pricing). OpenAI's own page showed no per-token prices | 2026-10-19 |
| <a id="a-35"></a>A-35 | OpenAI Enterprise offers data residency in ten regions (US, EU, UK, Japan, Canada, Korea, Singapore, India, Australia, UAE), none in Africa | Verified | [OpenAI pricing page](https://openai.com/api/pricing/) | 2026-10-19 |
| <a id="a-36"></a>A-36 | Embedding model prices for Gemini or OpenAI | Unverified | Not found in the pages read | 2026-10-19 |
| <a id="a-37"></a>A-37 | The libraries in the stack are actively maintained: NestJS 12.2, Next.js 16.4, BullMQ 6.3, Puppeteer 25.14, pdfjs-dist 6.4, mammoth 1.13, docx 9.12, Drizzle 0.45, Better Auth 1.7, openai 7.39, @google/genai 2.30, promptfoo 0.124. pdf-parse last changed Oct 2025. Prisma's current release tag is a release candidate (8.0.0-rc) | Verified | npm registry, checked 2026-10-19 | 2026-10-19 |
| <a id="a-38"></a>A-38 | The NDPA has no blanket requirement to store personal data in Nigeria. A Central Bank directive requires payment transaction data generated in Nigeria to be stored in Nigeria from 1 January 2027, aimed at payment-sector firms. NITDA's cloud data classification framework has no clear effective date | Unverified (single vendor article and one news report) | [Africloud](https://africloud.com/news/nigeria-data-protection-act-data-residency), [Techpoint](https://techpoint.africa/2025/02/17/nitda-cloud-providers-host-data/). Counsel to confirm | 2026-10-19 |
| <a id="a-39"></a>A-39 | The official naira rate was about ₦1,331.77 per dollar on 8 October 2026 | Verified | [Techeconomy](https://techeconomy.ng/dollar-to-naira-exchange-rate-today-october-8-2026) | 2026-10-19 |
| <a id="a-40"></a>A-40 | Sentry Free: 5,000 errors, 1 user. Team: $29 per month, 50,000 errors. PostHog free tier: 1M analytics events per month and 100,000 exceptions | Verified | [Sentry](https://sentry.io/pricing/), [PostHog](https://posthog.com/pricing) | 2026-10-19 |
| <a id="a-41"></a>A-41 | Unkey: free for 1,000 keys and 150,000 valid requests per month, Pro $25 per month. Per-key scopes, rate limits and self-hosting were not confirmed | Verified (prices), Unverified (features) | [Unkey pricing](https://unkey.com/pricing) | 2026-10-19 |
| <a id="a-42"></a>A-42 | Token counts per resume (30,000 input and 3,000 output for a writing pass, 15,000 and 2,000 for a check, 200,000 and 20,000 for first-time extraction) | Unverified (my assumption) | To be measured on the test set. Every cost figure in [02-tech-stack.md](02-tech-stack.md#estimated-running-cost) depends on it | 2026-10-19 |
| <a id="a-43"></a>A-43 | GitHub REST limits: 60 requests per hour unauthenticated, 5,000 per hour for an OAuth user | Verified | [GitHub rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) | 2026-10-19 |
| <a id="a-44"></a>A-44 | GitHub's Events API returns only the past 30 days and up to 300 events, with 30 seconds to 6 hours of latency | Verified | [GitHub Events API](https://docs.github.com/en/rest/activity/events) | 2026-10-19 |
| <a id="a-45"></a>A-45 | GitHub's commits endpoint filters by author and date, pages 100 at a time, and states no lookback limit. GraphQL `contributionsCollection` defaults to a one-year window and returns PRs, issues, reviews, repositories created and commits by repository (25 repositories by default). Private contributions need the `read:user` scope | Verified (defaults), Unverified (whether one year is a hard maximum) | [Commits API](https://docs.github.com/en/rest/commits/commits), [GraphQL users reference](https://docs.github.com/en/graphql/reference/users) | 2026-10-19 |
| <a id="a-46"></a>A-46 | Public GitHub data needs no OAuth scope. Private repositories need the broad `repo` scope | Verified | [GitHub OAuth scopes](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps) | 2026-10-19 |
| <a id="a-47"></a>A-47 | A GitHub App can request narrower private-repository access than the `repo` scope | Unverified | The commits page mentions a "Contents" read permission, which suggests it. Not confirmed for user-authorised apps | 2026-10-19 |
| <a id="a-48"></a>A-48 | GitHub's API terms (Section H) bar using the API to download data for spamming, including selling users' personal information to recruiters, headhunters or job boards. They say nothing about storing or redistributing data | Verified | [GitHub Terms of Service](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service) | 2026-10-19 |
| <a id="a-49"></a>A-49 | Sign In with LinkedIn (OpenID Connect) returns only name, photo, email and locale. `w_member_social` only creates posts. The Member Data Portability API works only for members in the EEA and Switzerland | Verified | [Sign In with LinkedIn](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2), [Share on LinkedIn](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin), [Member Data Portability](https://learn.microsoft.com/en-us/linkedin/dma/member-data-portability/member-data-portability-member) | 2026-10-19 |
| <a id="a-50"></a>A-50 | A LinkedIn data export ZIP contains Profile, Positions, Education, Skills and Shares files, and delivery takes days | Unverified | Only third-party tools and guides say so. LinkedIn's help pages were blocked. [Skill that parses the export](https://skills.cat/skills/tdimino/claude-code-minoan/linkedin-export), [Takeout Day](https://takeoutday.org/guides/how-to-export-linkedin-data). Test with a real export | 2026-10-19 |
| <a id="a-51"></a>A-51 | LinkedIn sued Proxycurl in January 2025 over scraping and Proxycurl shut down, with a court injunction requiring it to delete data obtained by unauthorised means | Verified (news report) | [Social Media Today](https://www.socialmediatoday.com/news/linkedin-wins-legal-case-data-scrapers-proxycurl/756101/) | 2026-10-19 |
| <a id="a-52"></a>A-52 | X API reads cost $0.005 per post, capped at 3 million per month on pay-per-use. X's developer policy says broader use needs Enterprise, only post IDs may be redistributed, stored content must be kept in sync and deletions honoured within 24 hours | Verified (text of the pages), Unverified (how the policy applies to pay-per-use, which it does not name) | [X pricing](https://docs.x.com/x-api/getting-started/pricing), [X developer policy](https://docs.x.com/developer-terms/agreement-and-policy) | 2026-10-19 |
| <a id="a-53"></a>A-53 | An X data archive is a ZIP with posts in `tweets.js`, a JavaScript file with a `window.YTD.tweets.part0 =` prefix before a JSON array, split into numbered parts | Partly verified | Public guides agree on the ZIP, the `window.YTD.<name>.partN = [...]` wrapper and the `id_str` field. Still untested against a real archive: [Tweet Archivist](https://www.tweetarchivist.com/twitter-archive-format-explained), [Kyle Conroy Gray](https://conroy.org/your-twitter-data). Test with a real archive | 2026-10-27 |
| <a id="a-54"></a>A-54 | Figma OAuth offers scopes such as `file_content:read`, `file_metadata:read` and `folders:read`, and a token reaches only files the user created or that were shared with them. The oEmbed endpoint needs `file_metadata:read` and returns 404 without public link access | Verified | [Figma scopes](https://developers.figma.com/docs/rest-api/scopes), [oEmbed](https://developers.figma.com/docs/rest-api/oembed-endpoints) | 2026-10-19 |
| <a id="a-55"></a>A-55 | Public or community Figma files can be read without the owner's authorisation | Unverified | The docs do not say | 2026-10-19 |
| <a id="a-56"></a>A-56 | Behance's API is available to new developers | Unverified | Adobe said it was unavailable in 2021. A 2023 community reply says to register on the Behance developer site, but users reported trouble getting keys. [Adobe community](https://experienceleaguecommunities.adobe.com/t5/adobe-developer-questions/how-can-i-obtain-an-api-key-or-access-to-behance-s-api-for/m-p/622761) | 2026-10-19 |
| <a id="a-57"></a>A-57 | Supabase Pro includes automated database backups sufficient for a 24-hour recovery point | Unverified | Not checked on the pricing or docs pages read. Confirm before relying on [NFR-13](03-architecture.md#nfr-13) | 2026-10-19 |

## Risk register

Likelihood and impact are my judgement, not measured.

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| <a id="r-1"></a>R-1 | AI cost per resume exceeds what a ₦2,500 Pro user pays, worsened when introductory prices end on 1 December 2026 and 1 January 2027 ([A-33](#a-33), [A-42](#a-42)) | High | High | Fair-use cap; measure cost in [M3-T2](04-requirements.md#m3-t2); model choice by test; spend limit with alert; cheaper model for the improve step ([Q-10](#q-10)) | Founding team |
| <a id="r-2"></a>R-2 | A source restricts access or changes terms: GitHub's recruiter-data rule, LinkedIn limits, X policy ([A-48](#a-48), [A-49](#a-49), [A-52](#a-52)) | Medium | High | User-provided files and paste as fallbacks; adapters behind flags; counsel reviews the B2B model | Founding team |
| <a id="r-3"></a>R-3 | An invented or unsupported claim reaches a user's resume | Medium | High | Deterministic evidence check, independent checker, flagged items, evaluation gate ([NFR-6](03-architecture.md#nfr-6)) | Prosper |
| <a id="r-4"></a>R-4 | Data protection non-compliance: registration, DPO, impact assessment, cross-border transfer ([A-11](#a-11) to [A-14](#a-14), [A-38](#a-38)) | Medium | High | Counsel before public launch ([Q-6](#q-6)); consent records; impact assessment draft ([M6-T4](04-requirements.md#m6-t4)) | Founding team |
| <a id="r-5"></a>R-5 | Slow or unreliable service for Nigerian users because no provider has an African region ([A-17](#a-17), [A-23](#a-23)) | Medium | Medium | Measure from Lagos early ([Q-12](#q-12)); keep server-side work in one region; autosave and low-bandwidth design | Prosper |
| <a id="r-6"></a>R-6 | One developer is a single point of failure for build, operations and on-call | High | Medium | Short runbooks, few alerts, managed services, simple architecture ([DR-1](02-tech-stack.md#dr-1-one-codebase-two-processes)) | Founding team |
| <a id="r-7"></a>R-7 | Provider price, model or terms change, or a model is retired | High | Medium | Gateway with config-only model swap and fallback; evaluation run on any change ([NFR-16](03-architecture.md#nfr-16)) | Prosper |
| <a id="r-8"></a>R-8 | Queue jobs are lost or duplicated when Redis restarts or evicts ([A-20](#a-20), [A-21](#a-21)) | Medium | Medium | Persistence and `noeviction`; recovery job; kill tests ([M2-T1](04-requirements.md#m2-t1)) | Prosper |
| <a id="r-9"></a>R-9 | Prompt injection through uploaded or fetched content | Medium | High | Delimited data, no model tools, schema output, evidence check, injection cases in evaluation ([M3-T4](04-requirements.md#m3-t4)) | Prosper |
| <a id="r-10"></a>R-10 | Paystack onboarding delay or odd renewal behaviour ([A-28](#a-28), [A-29](#a-29)) | Medium | Medium | Apply early ([Q-13](#q-13)); app-owned subscription state; Flutterwave as exit path | Founding team |
| <a id="r-11"></a>R-11 | Cross-tenant data exposure through the organisation API | Low | High | Owner and client checks, row-level policies, automated cross-client tests ([NFR-7](03-architecture.md#nfr-7)) | Prosper |
| <a id="r-12"></a>R-12 | Tracck's resumes are not clearly better than a human-written baseline, so the main claim fails ([G-2](01-overview.md#goals-non-goals-success-metrics)) | Medium | High | Blind review in the private beta; evaluation set; interviews ([Q-7](#q-7)) | Founding team |
| <a id="r-13"></a>R-13 | "ATS-safe" is promised but Nigerian employers' systems reject the file, or employers do not use ATS at all ([A-3](#a-3)) | Medium | Medium | Promise readable formatting only; test with three extractors; ask recruiters ([Q-7](#q-7)) | Founding team |
| <a id="r-14"></a>R-14 | Client approvals (launch standard, free tier, roles) arrive late or differ from this PRD ([Q-3](#q-3)) | Medium | Medium | Ask before the private beta; role list is configuration, not code | Founding team |

## Open questions

| ID | Question | Why it matters | Owner / evidence path | Needed by |
|---|---|---|---|---|
| <a id="q-3"></a>Q-3 | Does the client approve the launch standard numbers (3.9 of v2.0), the free-tier limits and the role list? | These set what "done" means for the writing engine and the pricing | Client | Before the private beta |
| <a id="q-4"></a>Q-4 | Which page sizes (A4 only or also Letter) and how many templates beyond the single ATS-safe one? | Affects the export and layout work | Prosper and client | Before M2-T6 |
| <a id="q-5"></a>Q-5 | Which AI models do we test, and what is the bar for choosing? | The writing engine is the core value and the cost driver | Tracck team, decided by test results | During the validation phase |
| <a id="q-6"></a>Q-6 | Which registration tier, fees and filings apply under the GAID, and do any features need an impact assessment? | Legal obligations can start at 2,500 users | Nigerian data protection counsel | Before public launch |
| <a id="q-7"></a>Q-7 | Do employers and recruiters in Nigeria actually screen with ATS software, and do the students and corpers in the audience table feel the pain described? | Decides how much of the product's pitch rests on ATS formatting | Customer interviews with recruiters | During the private beta |
| <a id="q-8"></a>Q-8 | Is the name Tracck available as a trademark and domain in Nigeria and for the API audience? | A rebrand after launch is costly | Founding team | Before public launch |
| <a id="q-9"></a>Q-9 | What retention periods apply to uploaded files, LLM call records, payment records, audit logs and deletion from backups? Proposed values are in the table in [03-architecture.md](03-architecture.md#data-model-sketch) and the 30-day deletion target in [NFR-8](03-architecture.md#nfr-8). | These set the retention jobs and the privacy policy promises | Nigerian data protection counsel with the founding team | Before M6-T3 |
| <a id="q-10"></a>Q-10 | What cost per generated resume is acceptable, and what is the monthly fair-use cap on Pro? Decided: Pro gets a cap (2026-10-19). The number is open. At the assumed token counts, AI cost alone passes the ₦2,500 price at about 16 passes a month on GPT-6.1 Sol plus Gemini 3.8 Flash ([02-tech-stack.md](02-tech-stack.md#what-this-means-for-the-2500-pro-plan)). | Protects margin and sets the Pro promise on the pricing page | Founding team, using measured cost from [M3-T2](04-requirements.md#m3-t2) | Before M5-T1 |
| <a id="q-11"></a>Q-11 | What do OpenAI's and any other chosen provider's data terms say about retention, training use and transfer? Only Google's paid-tier statement was read ([A-33](#a-33)). | Needed for the consent text and the impact assessment | Prosper reads the terms; counsel reviews | Before M6-T4 |
| <a id="q-12"></a>Q-12 | What is the round-trip time and page load from Lagos and a typical mobile network to a European region? | Supabase, Neon and Hetzner have no African region ([A-17](#a-17)) | Prosper, measured in [M1-T5](04-requirements.md#m1-t5) | Before the private beta |
| <a id="q-13"></a>Q-13 | What does Paystack require to go live (business registration, documents), and how are failed subscription charges retried? | Payments cannot launch without an approved account ([A-28](#a-28), [A-29](#a-29)) | Prosper and the client, from Paystack's support | Before M5-T2 |
| <a id="q-14"></a>Q-14 | What do real LinkedIn export ZIPs and X archives contain, and in what format? | The parsers rest on third-party descriptions ([A-50](#a-50), [A-53](#a-53)) | Team members request their own exports | Before M4-T1 and M8-T1 |
| <a id="q-15"></a>Q-15 | Does X's developer policy on stored content apply to posts read from a user's own archive? | Decides what Tracck may keep and for how long ([A-52](#a-52)) | Counsel, plus X support if needed | Before M8-T1 |
| <a id="q-16"></a>Q-16 | Can a GitHub App request narrower private-repository access than the broad `repo` scope for a user-authorised app? | Private repositories are out of Phase 1, but many students keep work private ([A-47](#a-47)) | Prosper, from GitHub's documentation and a test app | Before private repositories are considered |
| <a id="q-17"></a>Q-17 | Which embedding model and price will be used for the evidence library? | Semantic search is optional in Phase 1 and needed for [M8-T6](04-requirements.md#m8-t6) ([A-36](#a-36)) | Prosper, from provider pages and tests | Before M8-T6 |

## Sources

**01-overview.md (A-1 to A-15)**
- [NAN News, 6 Mar 2026](https://nannews.ng/tinubu-approves-additional-50000-for-nysc-mobilisation-in-2026/) (A-1)
- [Teal pricing](https://www.tealhq.com/pricing) (A-4)
- [Rezi pricing](https://www.rezi.ai/pricing) (A-5)
- [The Interview Guys review](https://blog.theinterviewguys.com/?p=10428) (A-6)
- [Toolradar](https://toolradar.com/tools/kickresume/pricing) (A-7)
- [VC4A listing](https://vc4a.com/ventures/finezcv) (A-8)
- [Paystack charges](https://support.paystack.com/hc/en-us/articles/360009881920-What-are-Paystack-s-transaction-charges) (A-10)
- [DLA Piper](https://privacymatters.dlapiper.com/2025/06/nigeria-ndpc-issues-gaid-key-compliance-insights/) (A-11)
- [Mondaq guide](https://www.mondaq.com/nigeria/privacy-protection/1693812/navigating-the-nigeria-data-protection-act-general-application-and-implementation-directive-ndpa-gaid-a-guide-for-businesses) (A-12)

**02-tech-stack.md (A-16 to A-42)**
- [Supabase pricing](https://supabase.com/pricing) (A-16)
- [Supabase regions](https://supabase.com/docs/guides/platform/regions) (A-17)
- [Neon pricing](https://neon.com/pricing) (A-18)
- [Neon regions](https://neon.com/docs/introduction/regions) (A-18)
- [Upstash pricing](https://upstash.com/pricing/redis) (A-19)
- [BullMQ production guide](https://docs.bullmq.io/guide/going-to-production) (A-20)
- [Railway pricing](https://railway.com/pricing) (A-22)
- [Vercel pricing](https://vercel.com/pricing) (A-24)
- [Hetzner Cloud](https://www.hetzner.com/cloud/) (A-25)
- [plans](https://www.hetzner.com/cloud/regular-performance/) (A-25)
- [R2 pricing](https://developers.cloudflare.com/r2/pricing/) (A-26)
- [Resend pricing](https://resend.com/pricing) (A-27)
- [Paystack recurring charges](https://paystack.com/docs/payments/recurring-charges/) (A-28)
- [subscriptions](https://paystack.com/docs/payments/subscriptions/) (A-28)
- [Flutterwave pricing](https://flutterwave.com/ng/pricing) (A-30)
- [OpenAI docs](https://developers.openai.com/api/docs/guides/structured-outputs) (A-31)
- [Gemini docs](https://ai.google.dev/gemini-api/docs/structured-output) (A-32)
- [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) (A-33)
- [Morph](https://morphllm.com/openai-api-pricing) (A-34)
- [OpenAI pricing page](https://openai.com/api/pricing/) (A-35)
- [Africloud](https://africloud.com/news/nigeria-data-protection-act-data-residency) (A-38)
- [Techpoint](https://techpoint.africa/2025/02/17/nitda-cloud-providers-host-data/) (A-38)
- [Techeconomy](https://techeconomy.ng/dollar-to-naira-exchange-rate-today-october-8-2026) (A-39)
- [Sentry](https://sentry.io/pricing/) (A-40)
- [PostHog](https://posthog.com/pricing) (A-40)
- [Unkey pricing](https://unkey.com/pricing) (A-41)

**03-architecture.md (A-43 to A-57)**
- [GitHub rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) (A-43)
- [GitHub Events API](https://docs.github.com/en/rest/activity/events) (A-44)
- [Commits API](https://docs.github.com/en/rest/commits/commits) (A-45)
- [GraphQL users reference](https://docs.github.com/en/graphql/reference/users) (A-45)
- [GitHub OAuth scopes](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps) (A-46)
- [GitHub Terms of Service](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service) (A-48)
- [Sign In with LinkedIn](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2) (A-49)
- [Share on LinkedIn](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin) (A-49)
- [Member Data Portability](https://learn.microsoft.com/en-us/linkedin/dma/member-data-portability/member-data-portability-member) (A-49)
- [Skill that parses the export](https://skills.cat/skills/tdimino/claude-code-minoan/linkedin-export) (A-50)
- [Takeout Day](https://takeoutday.org/guides/how-to-export-linkedin-data) (A-50)
- [Social Media Today](https://www.socialmediatoday.com/news/linkedin-wins-legal-case-data-scrapers-proxycurl/756101/) (A-51)
- [X pricing](https://docs.x.com/x-api/getting-started/pricing) (A-52)
- [X developer policy](https://docs.x.com/developer-terms/agreement-and-policy) (A-52)
- [Tweet Archivist](https://www.tweetarchivist.com/twitter-archive-format-explained) (A-53)
- [Figma scopes](https://developers.figma.com/docs/rest-api/scopes) (A-54)
- [oEmbed](https://developers.figma.com/docs/rest-api/oembed-endpoints) (A-54)
- [Adobe community](https://experienceleaguecommunities.adobe.com/t5/adobe-developer-questions/how-can-i-obtain-an-api-key-or-access-to-behance-s-api-for/m-p/622761) (A-56)

Npm package versions in A-37 come from the npm registry. Model and provider pricing was read on 2026-10-19 and changes often.
