---
name: tracck-language
description: Apply Tracck's product voice, tone, and audience-specific vocabulary whenever writing or editing user-facing copy, including dashboard UI, onboarding, notifications, error states, marketing pages, and emails. Do not use for backend logic, database schema, or internal code changes.
---

# Tracck Product Language & Copywriting Guide

## 1. Product & Audience Context

- **Product:** Tracck turns real work (GitHub repositories, project links, portfolios, and uploaded CVs) into job-tailored, one-page ATS resumes. Every bullet point is backed by verifiable proof of work.
- **Primary Audience:** Nigerian and Pan-African early-career tech talent (software engineers, UI/UX designers, data analysts, technical writers, devrel, and NYSC corps members) applying for competitive internships, junior positions, and remote international roles.
- **Audience Reality:** They ship real code, design real interfaces, and organize real tech communities, but struggle to package their wins into hiring language. They distrust generic AI tools that invent hallucinated experience.
- **Supported Promise:** Every resume line is grounded in work you actually produced. No blank-page fictions. No recruiter-repelling fluff.

---

## 2. Voice & Tone: The Proof-First Builder

### Who is speaking
A sharp, pragmatic technical lead who values clean code, concrete impact, and verified proof over corporate jargon. They speak peer-to-peer with respect for the builder's craft.

### Core Principles (Anti-"AI Slop")
1. **Speak to the work, not the database:**
   - Never use backend abstractions in UI copy: ban *"entries"*, *"your record"*, *"entities"*, and *"system checks"*.
   - Use concrete nouns: *projects, commits, repos, achievements, bullets, case studies, proof of work*.
2. **Eliminate defensive AI lecturing:**
   - Cut apologies, disclaimers, and system meta-commentary (e.g. *"Tracck does not rewrite your file"*, *"Nothing is rewritten unless you ask"*, *"Every figure traces to evidence"*).
   - State the user outcome cleanly and confidently.
3. **Action-oriented critique, not clinical scoring:**
   - Never use negative academic grading like *"3 things weaken this CV"*.
   - Frame improvements as concrete upgrades: *"3 suggested fixes for this role"*.
4. **Layout-Aware Copy:**
   - Headings, notification banners, and CTA labels must fit cleanly within 1 or 2 lines at both mobile and desktop viewports without truncation or awkward line wrapping. Shorten copy instead of reducing font size.

---

## 3. Vocabulary Reference

| Category | Preferred (Use) | Avoided (Ban) | Why |
|---|---|---|---|
| **User's Work** | Projects, achievements, repositories, proof of work, experience | Entries, records, data items, logs | Real talent builds projects, not database rows. |
| **Resume Elements** | Bullets, draft, highlights, impact statements | Claims, output, generated lines, AI text | Focuses on professional standards. |
| **Syncing Status** | Syncing, connected, ready, imported | Collecting, ingesting, pipeline active | Human verbs that describe immediate state. |
| **CV Review** | Suggested fixes, improvements, role alignment | Weaknesses, problems, defects, warnings | Encourages constructive iteration without condescension. |
| **Brand Buzzwords** | Tailored, verified, ATS-ready, proof-backed | AI-powered, magical, supercharge, unleash | Buzzwords trigger skepticism; proof builds trust. |

---

## 4. Tone by Surface

- **Dashboard & App Shell:** High signal, low noise. Shows status, active projects, and clear next actions immediately. No decorative chatter.
- **Resume Creation Flow:** Fast, purposeful, and focused on the job requirements. Prompts ask for emphasis and targets, not "prompt engineering instructions".
- **CV Feedback / Review:** Constructive and specific. Highlights exact lines and provides concrete before/after fixes with metrics.
- **Errors & Edge Cases:** Calm, transparent, and solution-focused. Explains what happened and provides a 1-click recovery path without blame or vague "Oops" tropes.
- **Emails:** Direct and relevant. Subject lines specify the role and status; body copy provides actionable next steps.

---

## 5. Concrete Examples (Before vs. After)

### A. Dashboard Status Banner
- **Before (AI Slop):** *"Your record is ready. 12 entries from 2 sources. GitHub is still being read; Tracck will use it when it finishes."*
- **After (Proof-First):** *"Your proof of work is ready. 12 projects synced from GitHub and your CV. Ready to tailor your next resume."*

### B. Primary CTA & Action
- **Before:** *"Paste a job description"*
- **After:** *"Tailor for a job"*

### C. CV Review Heading & Summary
- **Before (AI Slop):** *"CV feedback: 3 things weaken this CV. This is feedback only. Tracck does not rewrite your file; your next generated resume already avoids them."*
- **After (Proof-First):** *"CV review: 3 high-impact fixes for this Developer role. Review suggestions below to strengthen your bullet points."*

### D. Resume Generation Progress
- **Before (AI Slop):** *"Reading the job and finding your evidence... Every bullet is written from an entry of yours. Each figure and tool traces to your evidence."*
- **After (Proof-First):** *"Matching your projects to the job requirements... Drafting verified bullet points with your tools and metrics."*

### E. Error State
- **Before:** *"We could not write this resume. Something went wrong while validating against your entries."*
- **After:** *"Couldn't finish this draft. We were unable to match enough verified projects to this job description. Add a quick project summary or connect another source to continue."*

### F. Email Notification
- **Subject:** `Your resume for [Company] is ready to review`
- **Opening:** *"Your tailored one-page resume for [Role] at [Company] is ready. All 6 bullet points trace directly to your verified GitHub projects and experience."*

---

## 6. Writing Workflow for Future Tasks
When editing or creating user-facing copy in Tracck:
1. **Identify the reader's immediate goal** (e.g. connecting a source, tailoring a resume, reviewing a flagged bullet).
2. **Apply vocabulary rules:** Replace database jargon with craft terms (*projects*, *proof*, *bullets*).
3. **Verify supportable facts:** Never promise what the tool hasn't parsed or built.
4. **Test line length:** Check that headings and button labels remain within 1–2 lines.
5. Refer to [references/tracck-language.md](references/tracck-language.md) for background evidence.
