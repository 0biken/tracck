# Tracck — Product Addendum: Narrative Claim Extraction & Role-Tailoring

**Version:** 1.0
**Status:** Extends `Tracck_PRD_v1.0.docx`, `system-design.md`, `api-design.md`. Does not replace them.
**Read this first** if you are an ADE picking up this build — it explains *why* documents 2–6 exist.

---

## 1. What changed from the original PRD

The original PRD and system design assume Tracck ingests **structured activity data** through authenticated APIs: GitHub commits, X posts, LinkedIn shares, Figma files. The extraction pipeline (`ai-extraction.ts`) reads that structured data and writes `accomplishments` rows.

This addendum adds two capabilities the original spec does not cover:

1. **Narrative claim extraction** — detecting achievement claims inside free-text content (posts, captions, pasted text) regardless of whether that content arrived via OAuth or manual paste. "Hosted a 40-person hackathon this weekend" is a claim sitting inside a sentence, not a structured field like `commit.message`.
2. **Role-tailoring** — given a target job description, rank and filter a user's confirmed accomplishments by relevance, and bias the AI-generated bullet phrasing toward that role's language.

Both capabilities apply across **every** platform, including ones without usable APIs (Instagram, Facebook, Behance) via a manual-paste ingestion path.

---

## 2. Why this is a different problem than structured extraction

The existing pipeline's job is *summarization*: turn "14 commits to feature/auth-flow" into a clean bullet. The input is already known to be real and already known to be the user's own work, because it came from an authenticated API call scoped to their account.

Narrative claim extraction's job is *detection*, which is harder in three specific ways:

- **Ambiguity of tense and ownership.** "Excited to speak at DevFest next month" is a future claim, not an accomplishment. "Check out this amazing hackathon" is someone else's event, shared. "Hosted our first hackathon 🎉" is a real, past, first-person claim. All three can use similar vocabulary.
- **No source-of-truth guarantee.** An API pull from your own GitHub account is definitionally about you. A pasted paragraph of text has no such guarantee unless the ingestion flow enforces it (see §4).
- **Variable evidentiary strength.** "Won 1st place at Hack Ibadan" is a falsifiable, specific claim. "Learned a lot about leadership this year" is not resume-bullet material. The system needs to distinguish claim types, not just detect sentiment.

Document 3 (Claim Extraction Spec) is the answer to this problem. It is the most novel piece of engineering in this addendum and should be built and evaluated before role-tailoring, since role-tailoring operates on its output.

---

## 3. Why role-tailoring is a separate capability, not a bigger prompt

It's tempting to fold role-tailoring into the extraction prompt ("extract accomplishments relevant to a software engineer role"). This addendum specifies it as a **separate, later stage** instead, for two reasons:

- **Extraction should stay role-agnostic.** A user may want to apply to five different roles from the same underlying accomplishment history. Re-running extraction per target role wastes Gemini calls and risks the model inventing role-flavored details that weren't in the source text. Extract once, tailor many times.
- **Tailoring is a retrieval/ranking problem, not a generation problem.** Given N confirmed accomplishments and one job description, the system scores and orders — it should rarely need to generate new text. This keeps tailoring fast, cheap, and low-risk of hallucination compared to extraction.

Document 4 (Role-Tailoring Spec) defines this as a scoring layer that sits on top of already-confirmed accomplishments.

---

## 4. Ingestion method: hybrid, decided per platform

Per product decision: **OAuth where the platform supports it and terms permit it; manual paste everywhere else.** No scraping, anywhere, ever — this is a hard constraint, not a preference. Scraping public profiles violates the ToS of every platform in scope (X, Instagram, Facebook, LinkedIn) and exposes both Tracck and its users to account termination. It is excluded from this build entirely.

Manual paste is not a downgrade — it is a first-class ingestion path with its own UX, validation, and trust model, specified in Document 2.

---

## 5. What this addendum does NOT cover

To keep scope honest:

- It does not re-spec the already-working GitHub/Figma OAuth adapters (`system-design.md` §"Social OAuth flow" already covers this correctly).
- It does not change the resume-build or PDF/DOCX generation pipeline — role-tailoring changes *which* bullets get selected and their order, not how the document is rendered.
- It does not include a Behance or Facebook adapter build, pending the feasibility findings in Document 2 — both may resolve to manual-paste-only, which requires no new adapter code at all.

---

## 6. Document map

| Doc | Purpose | Depends on |
|---|---|---|
| 02 — Ingestion Method Matrix | Per-platform: OAuth or paste, and what paste looks like | This doc |
| 03 — Claim Extraction Spec | Prompt architecture, confidence scoring, claim taxonomy | Doc 02 |
| 04 — Role-Tailoring Spec | JD parsing, relevance scoring, bullet re-ranking | Doc 03 |
| 05 — Data Model Updates | Schema migrations extending `raw_posts`/`accomplishments` | Docs 02–04 |
| 06 — Master Build Brief | Ordered task list for the ADE | All of the above |
