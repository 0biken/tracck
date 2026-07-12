# Tracck — Narrative Claim Extraction Spec

**Version:** 1.0
**Depends on:** `02_ingestion_method_matrix.md`
**Replaces/extends:** the signal-detection stage described generically in `system-design.md`'s AI pipeline section — this document makes it platform-agnostic and narrative-aware.

---

## 1. Problem statement

Given a piece of free text (a post, caption, or pasted paragraph), determine:

1. Does this text contain an **achievement claim** at all?
2. If yes: is the claim **first-person, past-tense, and about the author** — as opposed to future, hypothetical, or about someone else?
3. If yes: what **type** of claim is it, and how strong is the evidence for it?
4. What confidence should the system assign, and does that confidence clear the bar for auto-surfacing to the user vs. discarding?

This replaces the simpler `has_signal BOOLEAN` check in the current `raw_posts` schema with a richer, multi-stage classification — because "does this post mention something achievement-shaped" and "is this a real, own, past-tense claim" are different questions that the current single boolean can't distinguish.

---

## 2. Claim taxonomy

Every piece of text is classified into exactly one of these categories before any bullet is generated:

| Category | Definition | Example | Action |
|---|---|---|---|
| `direct_achievement` | First-person, past-tense, specific, falsifiable | "Hosted a 40-person hackathon at UI last Saturday" | Proceed to bullet generation |
| `participation_claim` | First-person, past-tense, but passive/attendee framing | "Attended DevFest Lagos this weekend" | Proceed, but flag as lower-impact phrasing (see §5) |
| `future_or_aspirational` | Claim is about something not yet happened | "Can't wait to speak at DevFest next month" | Discard — do not extract |
| `third_party_share` | Author is sharing/promoting someone else's achievement or event | "Check out this incredible hackathon @friend just won" | Discard — do not extract |
| `sentiment_only` | Achievement-adjacent vocabulary, no concrete claim | "Learned so much about leadership this year 🙏" | Discard — do not extract |
| `ambiguous` | Genuinely unclear from text alone | "Big weekend 👀" (no further context) | Discard, do not surface — see §6 for why this is a hard discard, not a low-confidence surface |

The taxonomy label itself should be stored (not just a pass/fail boolean) — it's useful for debugging extraction quality and for tuning the prompt later without re-deriving categories from scratch.

---

## 3. Two-stage prompt architecture

Reuse the two-stage pattern already established in the existing pipeline (signal detection → bullet generation), but restructure stage one around the taxonomy above rather than a binary signal check.

### Stage 1 — Claim Classification

**Input:** raw text of one post/paste, plus lightweight context (platform, approximate date if known, `source_method`).

**Output (strict JSON):**
```json
{
  "category": "direct_achievement",
  "confidence": 0.91,
  "claim_summary": "Organized and ran a 40-person hackathon",
  "specificity_signals": ["numeric_detail", "named_event", "past_tense_verb"],
  "reasoning_brief": "First-person past-tense verb 'hosted', concrete attendee count, single unambiguous event."
}
```

**Prompt construction principles:**
- Give the model explicit negative examples for each discard category, not just positive examples of `direct_achievement` — models drift toward over-extraction (treating everything as a claim) without clear counter-examples in the prompt.
- Include `source_method` in the prompt context. Pasted content should be classified identically to OAuth content at this stage — the *ownership* discount happens in confidence scoring (§4), not in classification, since the text itself doesn't change meaning based on how it arrived.
- Do not ask the model to generate the resume bullet in this stage. Keep classification and generation separate calls, as the existing architecture already does — this avoids the model rushing to produce polished prose for a claim it should actually be discarding.

### Stage 2 — Bullet Generation

Unchanged from existing pipeline for `direct_achievement` and `participation_claim` categories: takes the classified claim and produces `bullet_text`, `role_tag`, `ats_keywords`, per the existing `accomplishments` schema. Only runs for categories that passed stage 1 — never runs on discarded categories, which saves Gemini calls compared to running generation on everything.

---

## 4. Confidence scoring — combining claim strength with source trust

The final `confidence_score` written to `accomplishments` is **not** just the model's stage-1 confidence. It's adjusted by source method, since paste has a weaker ownership guarantee than OAuth (see Document 02 §5):

```
final_confidence = model_confidence × source_trust_multiplier

source_trust_multiplier:
  oauth          → 1.0
  manual_paste   → 0.85   (attestation checkbox exists, but unverifiable)
  file_upload    → 0.90   (structured export, slightly more trustworthy than free paste)
```

This is a deliberate, simple multiplier rather than a second ML stage — it's cheap to reason about, cheap to tune, and keeps the "why was this flagged low-confidence" answer explainable to the user if they ask.

**Threshold behavior** (extends existing `accomplishments.status` logic):
- `final_confidence >= 0.75` → `status = 'pending'`, surfaced normally for user confirmation
- `0.5 <= final_confidence < 0.75` → `status = 'low_confidence'`, surfaced but visually deprioritized (existing status value, now with a concrete threshold definition)
- `final_confidence < 0.5` → not written to `accomplishments` at all; the source `raw_posts` row is marked `processed = true, has_signal = false`

---

## 5. Participation vs. leadership framing

`participation_claim` claims ("attended," "was part of," "joined") are real accomplishments but weaker resume material than `direct_achievement` claims ("hosted," "led," "organized," "built"). Rather than discarding participation claims, stage 2's bullet generation prompt should be instructed to preserve the actual claimed role — **never upgrade "attended" to "led" in the generated bullet.** This is a hard rule, not a style preference: it's the same evidence-over-embellishment principle already established as a core brand value, and violating it here is the single fastest way to produce a resume bullet the user can't defend in an interview.

---

## 6. Why `ambiguous` is a hard discard, not a low-confidence surface

It's tempting to route `ambiguous` claims into the `low_confidence` bucket rather than discarding them outright, on the theory that "more surfaced content is more helpful." Don't do this. An ambiguous post ("big weekend 👀") surfaced as a possible accomplishment trains users to distrust the confirmation queue — every irrelevant suggestion makes the next nine relevant ones feel less trustworthy. It is better to under-extract and occasionally miss a real accomplishment than to over-extract and erode confidence in the confirmation step, which is the product's core trust mechanism.

---

## 7. Evaluation before shipping

Before this pipeline goes live, run it against a hand-labeled test set:

- Collect ~150–200 real posts across platforms (can be sourced from willing early users or public sample data).
- Hand-label each with the correct taxonomy category.
- Run the stage-1 classifier and measure precision/recall **per category**, not just overall accuracy — false positives on `direct_achievement` (claiming something is a real achievement when it isn't) are more costly than false negatives, so precision on that category specifically is the number to watch.
- Target: ≥ 90% precision on `direct_achievement` before allowing auto-surfacing without a review gate. Recall matters less than precision here — missing a real accomplishment is recoverable (user can paste it manually later), surfacing a fabricated-sounding one damages trust.
