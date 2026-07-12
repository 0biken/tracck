# Tracck — Role-Tailoring Spec

**Version:** 1.0
**Depends on:** `03_claim_extraction_spec.md`
**Purpose:** Given a target job description, rank and select from a user's already-confirmed accomplishments to produce a tailored resume — without re-running extraction and without inventing content.

---

## 1. Scope boundary — read this before building

Role-tailoring operates **only** on accomplishments already at `status = 'confirmed'`. It never touches `raw_posts`, never triggers new extraction, and never generates a bullet from scratch. Its job is retrieval and re-ranking of existing, user-approved content, plus light rephrasing within the bounds of what was already confirmed (see §5). If a target role doesn't have enough confirmed accomplishments to build a credible resume, the correct behavior is to tell the user that — not to lower the bar on what counts as a match.

---

## 2. Input: the target role

Add a new `target_roles` table (see Document 05 for the migration). A target role is:

- **A pasted job description** (primary path — most information-dense, most common thing a user has on hand), or
- **A role_tag selection** from the existing fixed enum (`developer`, `devrel`, `smm`, `virtual_assistant`, `ui_designer`, `data_analyst`) for users who don't have a specific JD yet and just want "a developer-flavored resume."

These are not mutually exclusive — a pasted JD gets parsed into a richer keyword/skill set, but still maps back onto one of the existing `role_tag` values for compatibility with the current schema.

---

## 3. JD parsing pipeline

**Input:** raw pasted job description text.

**Processing (single Gemini call, structured output):**
```json
{
  "role_tag": "developer",
  "seniority": "entry_level",
  "required_skills": ["React", "TypeScript", "REST APIs"],
  "preferred_skills": ["Next.js", "PostgreSQL"],
  "responsibility_themes": ["frontend development", "cross-functional collaboration", "code review"],
  "keywords_for_ats": ["React", "TypeScript", "agile", "cross-functional"]
}
```

- `role_tag` classification maps the free-text JD onto the existing fixed enum — this keeps role-tailoring compatible with the current `accomplishments.role_tag` field without requiring a schema-breaking change to that enum.
- `required_skills` vs `preferred_skills` distinction matters for scoring (§4) — a match against a required skill should weigh more than a match against a preferred one.
- `keywords_for_ats` is a distinct, slightly broader list than `required_skills` — it includes soft-skill and process language ("agile," "cross-functional") that ATS keyword scanners commonly check for, even though it wouldn't belong in a "required skills" list.

---

## 4. Scoring: matching accomplishments to the role

For each of a user's `confirmed` accomplishments, compute a relevance score against the parsed JD:

```
relevance_score =
    (0.5 × required_skill_overlap) +
    (0.25 × preferred_skill_overlap) +
    (0.15 × responsibility_theme_similarity) +
    (0.10 × recency_weight)
```

- **Skill overlap** — exact or near-exact match between the accomplishment's `ats_keywords` array (already exists on the schema) and the JD's `required_skills`/`preferred_skills`. This is a straightforward set-overlap calculation, not a new AI call — keeps tailoring fast and cheap per the reasoning in the Product Addendum §3.
- **Responsibility theme similarity** — semantic similarity between the accomplishment's `bullet_text` and the JD's `responsibility_themes`, computed via embedding cosine similarity (e.g., a lightweight embedding call, not a full Gemini generation call).
- **Recency weight** — more recent accomplishments score slightly higher, on the theory that a hiring manager cares more about what someone can do *now*. Simple linear decay over the accomplishment's `detected_at` date, capped so nothing older than ~18 months gets a meaningfully different weight than the cutoff itself.

**Output:** every confirmed accomplishment gets a `relevance_score` for this specific target role (stored per-role, not mutating the accomplishment itself — see Document 05 for the join-table shape this implies).

---

## 5. Selection and light rephrasing — the hard boundary

Two distinct operations happen after scoring, and they must stay clearly separated in the implementation:

### 5a. Selection (safe, mechanical)
Take the top N accomplishments by `relevance_score` (N determined by resume length constraints — typically 4-8 bullets for an entry-level one-page resume). This is pure sorting and filtering. No AI call needed.

### 5b. Emphasis rephrasing (constrained, requires guardrails)
Optionally, reorder *which keywords appear first* within an already-confirmed bullet, or swap a synonym to match the JD's exact terminology (e.g., "built a web application" → "built a web app" if the JD specifically says "web app"). This is the only generation step allowed in the tailoring pipeline, and it must be constrained:

- **Never add a claim, metric, or scope that wasn't in the original confirmed `bullet_text`.**
- **Never change the verb's meaning** (can't turn "contributed to" into "led").
- Any rephrased output must pass a similarity check against the original before being shown — if the rephrase drifts too far from the original confirmed text, discard the rephrase and show the original unchanged instead.

This boundary exists because it's the direct continuation of the evidence-over-embellishment principle from Document 03 §5 — role-tailoring is exactly the kind of feature that could quietly turn into "let the AI make my resume sound more impressive for this job," which is precisely what this product has committed not to be.

---

## 6. When there isn't enough content

If fewer than a minimum threshold (recommend: 3) confirmed accomplishments score above a relevance floor (recommend: 0.3) for a given target role, the correct product behavior is to tell the user directly — e.g., "Only 2 of your confirmed accomplishments match this role closely. Consider adding more before generating a tailored resume." This is a UX/copy requirement, not just an engineering edge case — it's the same "the user keeps the pen" value showing up as a refusal-to-overreach rather than a refusal-to-help.

---

## 7. API surface (extends `api-design.md`)

New endpoints needed:

```
POST /api/roles
  Body: { jd_text?: string, role_tag?: string }
  → creates a target_role row, triggers JD parsing job, returns role_id

GET /api/roles/:role_id/matches
  → returns confirmed accomplishments sorted by relevance_score for this role,
    plus a flag if below the minimum-content threshold from §6

POST /api/roles/:role_id/resume
  → triggers resume-build job (existing pipeline) using the top-N matched
    accomplishments instead of all confirmed accomplishments
```

The existing `resume-build` job (per `system-design.md`) needs a new optional parameter — `target_role_id` — that, when present, filters and orders input accomplishments by the matches endpoint above rather than using all confirmed accomplishments in chronological order.
