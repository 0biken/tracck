# Tracck — Master Build Brief

**Version:** 1.0
**Audience:** An agentic development environment (ADE) or engineering team picking up this build.
**Read order:** This document last. It assumes you've read (or the ADE has ingested) documents 01–05, plus the pre-existing `Tracck_PRD_v1.0.docx`, `system-design.md`, `api-design.md`, and `docs/00X_*.sql` migrations.

---

## 1. What you're building, in one paragraph

Tracck already has a working plan for OAuth-based extraction from GitHub and Figma, plus a partial plan for X/LinkedIn. This build adds: (a) a manual-paste ingestion path so every platform — including ones with no usable API, like Behance — can still feed the system; (b) a claim-classification layer that distinguishes real, first-person, past-tense achievements from future plans, other people's posts, and vague sentiment, before anything reaches bullet generation; and (c) a role-tailoring layer that scores already-confirmed accomplishments against a target job description and assembles a tailored resume from the best matches, without inventing new content.

---

## 2. Current repo state (as of this brief)

From the existing `traack` repository:
- Auth (Supabase, signup/login/session middleware) — **working, no changes needed.**
- Database migrations 001–009 — **working.** This brief's migrations (010–015, see Document 05) are additive on top.
- Worker process (`workers/index.ts`) — **scaffold only**, contains a placeholder log statement. This is where most new job logic lands.
- No API routes exist yet under `/api/*`.
- No platform adapters exist yet beyond what's specified in docs (none implemented in code).

This means the new capabilities in this brief are being built into a largely empty worker/API layer, not retrofitted into working code — there's no legacy extraction pipeline to migrate away from.

---

## 3. Build order

Follow this order. Each phase should be independently testable before moving to the next.

### Phase A — Schema foundation
1. Run migrations 010–015 from Document 05 against a real Supabase project (or local Postgres for dev).
2. Verify RLS policies with a test user — confirm a user cannot see another user's `target_roles` or `accomplishment_role_matches` rows.

### Phase B — Manual paste ingestion (build before any new OAuth adapter)
1. Build the paste UI: textarea input, bulk-paste-with-delimiter, ownership attestation checkbox, approximate-date picker. Reference: Document 02 §5.
2. Build `POST /api/posts/paste` — writes one or more `raw_posts` rows with `source_method = 'manual_paste'`, `ownership_attested` set from the checkbox, `posted_at_is_approximate = true`.
3. Build the LinkedIn data-export (CSV/ZIP) parser as a separate, slightly later task — it's higher value than free-text paste for LinkedIn specifically, but not a blocker for shipping paste for other platforms first.
4. **Test gate:** manually paste 10–15 real posts of mixed content (some real achievements, some not) and confirm they land correctly in `raw_posts` before proceeding to Phase C.

### Phase C — Claim extraction pipeline
1. Build the Stage 1 classifier (`jobs/claim-classification.ts` or similar) per Document 03 §2–3. This replaces/extends the simpler `has_signal` check referenced in `system-design.md`.
2. Build the confidence scoring logic per Document 03 §4 — `model_confidence × source_trust_multiplier`.
3. Build Stage 2 bullet generation, gated to only run on `direct_achievement` and `participation_claim` categories that clear the confidence threshold.
4. **Test gate:** run the evaluation described in Document 03 §7 (hand-labeled test set, precision/recall per category) before allowing this pipeline to auto-surface accomplishments without a review gate. Do not skip this step — it's the single highest-leverage quality check in the whole build.

### Phase D — Role-tailoring
1. Build `POST /api/roles` and the JD parsing job per Document 04 §3.
2. Build the scoring logic per Document 04 §4 — this is mostly deterministic set-overlap math plus one embedding-similarity call, not a heavy AI pipeline.
3. Build `GET /api/roles/:role_id/matches` and the minimum-content-threshold check from Document 04 §6.
4. Extend the existing `resume-build` job to accept an optional `target_role_id` parameter per Document 04 §7.
5. Build the constrained emphasis-rephrasing step from Document 04 §5b **last**, and treat it as optional for initial ship — pure selection (§5a) without rephrasing is a complete, safe, shippable version of role-tailoring on its own.

### Phase E — Remaining platform adapters (lowest priority)
1. Instagram OAuth (Business/Creator accounts only) — build only if user demand justifies the Meta App Review overhead. Paste already covers this platform.
2. Do not build Facebook or Behance OAuth adapters — per Document 02 §4, these are paste-only by design, not by current limitation.

---

## 4. Non-negotiable constraints, restated

These appear throughout Documents 01–04 but are worth restating in one place since they're the easiest things for an ADE to quietly violate under implementation pressure:

- **No scraping, ever, on any platform.** If a platform has no usable OAuth and no export format, the answer is manual paste — not a scraper.
- **Never upgrade a claim's framing during bullet generation.** "Attended" cannot become "led." This is enforced in the Stage 2 prompt (Document 03 §5) and again in the emphasis-rephrasing guardrails (Document 04 §5b).
- **Ambiguous claims are discarded, not surfaced as low-confidence.** Document 03 §6 explains why — don't relitigate this under time pressure by routing ambiguous claims into the visible queue "just to be safe."
- **Role-tailoring never triggers new extraction.** It operates only on `status = 'confirmed'` accomplishments. If tempted to "just re-run extraction with role context" for better results, don't — Document 04 §1 explains why this is the wrong layer for that.

---

## 5. Open questions to resolve with the product owner before Phase D

- What is the actual target N (bullet count) for a tailored resume — is it always a one-page constraint, or does it vary?
- Should users be able to manually override the relevance ranking (drag to reorder) before generating a tailored resume, or is automated ordering final?
- For Instagram OAuth (Phase E, if pursued): is Meta App Review overhead worth it given paste already covers this platform, or should this be deprioritized indefinitely?

---

## 6. Document index

| # | File | Covers |
|---|---|---|
| 01 | `01_product_addendum.md` | Why this build exists, what it does and doesn't cover |
| 02 | `02_ingestion_method_matrix.md` | Per-platform OAuth vs. paste decision and paste UX |
| 03 | `03_claim_extraction_spec.md` | Claim taxonomy, two-stage prompt architecture, confidence scoring |
| 04 | `04_role_tailoring_spec.md` | JD parsing, relevance scoring, selection vs. rephrasing boundary |
| 05 | `05_data_model_updates.md` | Migrations 010–015, RLS additions |
| 06 | `06_master_build_brief.md` | This document |
