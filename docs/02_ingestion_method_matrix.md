# Tracck — Ingestion Method Matrix

**Version:** 1.0
**Depends on:** `01_product_addendum.md`
**Purpose:** For every platform in scope, define whether ingestion is OAuth, manual paste, or both — and exactly what manual paste looks like for that platform. No scraping anywhere, per product constraint.

---

## 1. Summary table

| Platform | OAuth available? | OAuth viable for this product? | Manual paste needed? | Recommendation |
|---|---|---|---|---|
| GitHub | Yes | Yes — stable, generous rate limits | No | OAuth only (already built) |
| Figma | Yes | Yes — Files API, public files | No | OAuth only (already built) |
| X (Twitter) | Yes | Degraded — paid API tier required for meaningful read access as of this writing | Yes, as primary path for free-tier users | Hybrid, paste-first |
| LinkedIn | Yes | Degraded — `w_member_social` and most read scopes are restricted to approved partners | Yes, as primary path | Hybrid, paste-first |
| Instagram | Yes (Graph API) | Limited — Business/Creator accounts only, requires Meta App Review | Yes | Hybrid, paste-first; OAuth as opportunistic upgrade |
| Facebook | Yes (Graph API) | Poor fit — built for Pages/ads, heavy review process, low signal density for personal accomplishments | Yes | Paste only, no OAuth build |
| Behance | No public API (deprecated ~2021) | N/A | Yes | Paste only |

**Read of the table:** four of seven platforms resolve to "paste is the primary or only path." This is the actual shape of the ingestion problem — build the paste flow first and treat OAuth as an enhancement layered on top where it's genuinely available, not the other way around.

---

## 2. OAuth-viable platforms (no change from existing spec)

### GitHub, Figma
Already correctly specified in `system-design.md` §"Social OAuth flow" and `api-design.md`. No changes needed. Continue to treat these as the reference implementation for what an OAuth adapter looks like.

---

## 3. Hybrid platforms — OAuth attempted, paste as guaranteed fallback

### X (Twitter)
- **OAuth status:** OAuth 2.0 available, but read access to a user's own timeline at meaningful volume sits behind X's paid API tiers. Free tier is write-heavy and read-restricted.
- **Build decision:** Attempt OAuth connection; if the account's API tier can't sustain periodic polling, fall back gracefully to "connected but paste-supplemented" state rather than failing silently.
- **Paste UX:** User pastes tweet text (or a thread) directly, or pastes a profile export. See §5 for the paste flow shape.

### LinkedIn
- **OAuth status:** `w_member_social` (posting) is available; most *read* scopes for a user's own historical posts require LinkedIn Marketing Partner approval, which is a slow, uncertain process not worth blocking MVP on.
- **Build decision:** Do not build LinkedIn OAuth read access for MVP. Paste is the primary path. Revisit OAuth only if/when partner approval is pursued as a separate business development track — not an engineering task.
- **Paste UX:** User pastes post text directly from LinkedIn, or exports their LinkedIn data archive (LinkedIn natively supports a full data export as a ZIP/CSV) and uploads it. The CSV path gives higher-quality, higher-volume data than manual copy-paste.

### Instagram
- **OAuth status:** Instagram Graph API requires a **Business or Creator account** — personal accounts cannot authenticate at all. This means OAuth will simply be unavailable for a meaningful fraction of your target users (students, NYSC corpers on personal accounts).
- **Build decision:** Paste is the primary and often *only* available path for this platform. Offer OAuth as an option for users who happen to have Business/Creator accounts, but do not build UX that assumes OAuth is the default.
- **Paste UX:** User pastes caption text per post, or uploads a screenshot for OCR extraction (see §6 — screenshot path is more valuable here than on text-native platforms, since Instagram is caption+image).

---

## 4. Paste-only platforms

### Facebook
- **Recommendation: do not build Facebook OAuth.** Graph API access for reading a personal profile's posts is tightly scoped to Pages and requires App Review for anything beyond basic profile fields. The signal density (achievement-relevant posts as a fraction of total Facebook content) is also lower than other platforms for this user base. Build paste-only; do not spend engineering time on a Facebook adapter.

### Behance
- **Recommendation: paste-only, permanently.** Adobe deprecated the public Behance API. There is no OAuth path to build. Users paste project descriptions or upload a PDF/image export of their portfolio page.

---

## 5. The manual-paste flow (applies to all paste-based platforms)

This is new UX that does not exist in the current PRD. Minimum viable shape:

1. **Entry point:** "Add from [Platform]" button on the Accounts page, shown even when OAuth isn't available for that platform — paste is never hidden behind a failed OAuth attempt.
2. **Input modes**, in order of implementation priority:
   - **Plain text paste** — a textarea. User pastes one or more posts' text. Simplest to build, ship first.
   - **Bulk paste with delimiter** — user pastes multiple posts separated by a blank line or a `---` marker, so one paste action yields multiple `raw_posts` rows instead of one.
   - **File upload** — for LinkedIn's data export (CSV/ZIP) specifically. Parse the export format directly rather than asking the user to copy-paste each post individually.
   - **Screenshot/image upload with OCR** — lowest priority, highest build cost. Useful for Instagram and Behance where content is often image-first. See §6.
3. **Source attestation:** every pasted item requires the user to confirm "this is my own post/content" via a checkbox before submission — this is the closest equivalent to OAuth's implicit ownership guarantee, and matters for the trust model in Document 3.
4. **Metadata capture:** since paste has no API-supplied timestamp, prompt the user for an approximate date (month/year is sufficient) rather than leaving `posted_at` null — the ledger/ATS-relevance of accomplishments depends on having *a* date, even an approximate one.

---

## 6. OCR path (Instagram, Behance — deferred to post-MVP)

Screenshot-to-text extraction is real scope, not a footnote: it requires an OCR step (e.g., Google Cloud Vision or Tesseract) inserted before the existing Gemini extraction stage, plus handling for OCR error correction. Recommend deferring this to a post-MVP milestone and shipping text-paste-only first — most users can copy-paste a caption faster than the team can build reliable OCR.

---

## 7. Database implication (see Document 05 for full migration)

Every `raw_posts` row needs to record **how** it arrived, not just its platform. This distinction matters downstream: pasted content has a weaker ownership guarantee than OAuth-sourced content, which affects confidence scoring in Document 03. Add `source_method TEXT CHECK (source_method IN ('oauth', 'manual_paste', 'file_upload'))`.
