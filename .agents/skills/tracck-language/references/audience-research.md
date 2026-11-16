# Audience Research: Tracck Product Language

**Date:** November 2026  
**Market & Geography:** Nigeria (Lagos, Ibadan, Abuja, remote hubs) and Pan-African early-career tech ecosystem  
**Primary Audience:** Early-career developers, UI/UX designers, data analysts, technical writers, devrel, and NYSC corps members applying for internships, entry-level roles, or remote international contracts.  

---

## 1. Observed Audience Realities & Mental Models

### The Real Problem
- Early-career talent ships real work in public: GitHub repos, hackathon projects, student club leadership (GDSC, NACOS), side gigs, and design files.
- When applying, their resumes are either:
  1. Traditional Nigerian academic CVs (full of outdated filler: state of origin, marital status, generic objective statements, tables that break ATS).
  2. Generic AI hallucinations (bullet points invented by ChatGPT that collapse under interview questioning).
  3. Under-indexed summaries ("Built backend with Node.js" instead of describing actual scope, queue architecture, or latency impact).
- **Stakes:** Thousands of applicants compete for single junior/internship slots at Paystack, Moniepoint, Kora, Piggyvest, and remote startups. An unoptimized or hallucinated resume gets filtered out in 6 seconds.

### Words & Concepts That Resonate (High Trust)
- **Proof of work / built & shipped:** Nigerian tech culture values tangible evidence over paper degrees. "What did you actually build?"
- **ATS-ready / One-page clean:** High anxiety around formatting getting rejected by automated screening tools.
- **Tailored to the role:** Frustration with sending one generic CV to 50 companies with zero response.
- **Traceable claims / verified bullets:** Eliminates imposter syndrome and interview dread. If the resume says it, the user can back it up because they built it.
- **Local context:** NYSC PPA placements, SIWES internships, campus tech communities, naira subscription pricing (₦2,500 vs. $30/mo competitors).

### Words & Patterns That Trigger Distrust (AI Slop & Robotic Jargon)
- **Database / Mechanical terms:** Calling their work "Entries", "Your record", "Entities", "Graph nodes". People don't think: *"I want to update my record"*; they think: *"I want to sync my projects and generate a resume for this backend role."*
- **Defensive AI lecturing:** *"This is feedback only; Tracck does not rewrite your file"*, *"Nothing is rewritten unless you ask"*, *"Every figure and tool traces to your evidence."* Over-explaining system safety sounds suspicious and patronizing.
- **Vague evaluative critique:** *"Things that weaken your CV"*, *"Problem detected"*. Sounds like an academic examiner rather than a career tool.
- **Silicon Valley corporate fluff:** "Unlock your career synergy", "supercharge your potential", "elevate your journey".

---

## 2. Core Dashboard Friction & "AI Slop" Diagnosis

| Current Dashboard Copy (AI Slop / Robotic) | Why It Fails | What Real Users Need Instead |
|---|---|---|
| *"Your record is ready. 12 entries from 2 sources. GitHub is still being read; Tracck will use it when it finishes."* | Sounds like a database migration log. Monotonous and detached. | Clear status and direct utility: *"GitHub and your CV are connected. 12 projects and achievements ready to use."* |
| *"One thing weakens this CV... Tracck does not rewrite your file; your next generated resume already avoids it."* | Defensive disclaimer. Focuses on system boundaries rather than actionable fixes. | Direct diagnosis: *"1 improvement flagged: Add measurable impact to your backend project."* |
| *"The entries that match this job were chosen. Every bullet is written from an entry of yours."* | Parroting the backend prompt pipeline to the user. | Confident action: *"Matched 8 accomplishments to this job description."* |
| *"What you want on the CV (optional) - In your own words. For example: lead with leadership, keep it to one page, no hobbies."* | Meta-instructions that read like prompt engineering. | Clear prompt: *"Specific emphasis (optional): Any projects or skills you want front and center?"* |

---

## 3. Evidence Sources & Links
- [PRD 01-Overview](../../docs/prd/01-overview.md): Nigerian tech talent positioning, NYSC corper & undergraduate focus.
- [Tracck System & Architecture](../../docs/prd/03-architecture.md): Traceable bullet generation engine.
- Industry benchmark discussions: Tech Cabal, HNG Internship community guidance, Nigerian Developer & Design communities on X/Twitter (2025–2026).
