# How sources sync

This explains when Tracck reads a person's sources, what it reads each time, and what each control does. It describes the code as built in `backend/src/sources/`.

## Principles

- **Nothing is read on a timer.** Reading costs API calls and model calls, and a person who is not using Tracck should cost nothing.
- **Changed things only.** A read skips anything the source reports as unchanged.
- **Reads happen when they matter.** Before a resume is written, and when the person asks.

## Sources at a glance

| Source | When it is read | What is read each time | Change detection |
|---|---|---|---|
| GitHub | Before a resume is written, if last read more than 6 hours ago. On refresh and retry | Repository list, then only the repositories changed since last read. Releases of the 8 most recent repositories | GitHub's `pushed_at` per repository. Releases are read once, because they do not change after publishing |
| Portfolio page | Same as GitHub | The page, and only if its text changed | SHA-256 of the extracted text |
| CV (PDF or Word) | On upload. On refresh and retry | The stored file, read again only when forced | None: the file is what the person uploaded |
| LinkedIn export, X archive | On upload. On refresh and retry | The stored file. X: posts only | None |
| Pasted text (Behance, LinkedIn text) | On paste. On refresh and retry | The stored text | None |
| Manual entry | When created | Not a source; saved as an entry | None |

Uploaded and pasted sources are never read again on their own. They change only when the person replaces them.

## Triggers

| Trigger | Where it comes from | What it does |
|---|---|---|
| Resume generation | `POST /v1/resumes` and regeneration. The resume job calls `syncChanged` first | Reads GitHub and portfolio sources last read more than 6 hours ago. Unchanged items are skipped |
| Refresh | `POST /v1/sources/:id/refresh` (button on each source) | Forces a full read of that source, and removes its old embeddings so the next index rebuilds them |
| Retry | `POST /v1/sources/:id/retry` (after a problem) | The same forced read as refresh |
| Reset | `POST /v1/sources/:id/reset` (button on each source, with confirmation) | Deletes every entry and stored file the source produced, pinned and edited ones included, and disconnects the source. Returns 204 |
| Remove | `DELETE /v1/sources/:id?entries=keep\|delete` | Disconnects the source. `keep` leaves its entries; `delete` removes them, except pinned and edited ones |
| Replace | Uploading a new CV, LinkedIn export or X archive | Removes what the old file produced, then reads the new one |

There is no daily or scheduled source sync. The scheduler only sends the weekly digest and runs cleanup.

## Change detection in detail

Every stored source item records a fingerprint in `source_items.metadata_json.fingerprint`:

- **Repository:** the repository's `pushedAt` value. A repository is read again only when it differs.
- **Release:** `release-<id>`. A release is read once.
- **Profile README and portfolio page:** SHA-256 of the extracted text. The page is fetched, but nothing is stored or extracted if its text is the same.

Items stored before fingerprints existed have none, so their next read counts as a change. That happens once.

## Replacing a changed item

When an item changed, its old entries are removed before the new ones are read:

1. Entries whose only support is this item are deleted, except pinned and edited ones.
2. The item's links to entries are removed.
3. The new text is read, and entries are created, or linked when identical entries already exist.

An entry that another source also supports stays. A pinned or edited entry that came from a changed item stays too, with its old wording, so the person's work is never silently replaced.

## Forced reads

A forced read (refresh or retry) reads every item, including unchanged ones. It also deletes the source's existing embeddings. Embeddings are rebuilt the next time the AI engine indexes evidence, which happens when a resume is written. Entries whose wording did not change still link to the same records.

## Failures

- A source that cannot be read is marked as a problem, and the person is notified. The problem and the retry action appear on the Sources screen.
- During resume generation, a failed source sync does not stop the resume. The resume is written from the entries that already exist.
- Rate limits and provider errors are retried in the job system, with backoff.

## Costs and limits

- GitHub: one repository-list call per sync, one README call per changed repository, and one release-list call for each of the 8 most recent repositories. A sync with no changes costs the list calls only.
- Repositories are capped at 30 per sync. Portfolio text is capped at 60,000 characters.
- Each changed item is extracted by the AI engine. Unchanged items cost nothing.

## Known gaps

- Release lists are checked for the 8 most recent repositories on every sync, so a sync always calls GitHub that many times, even when nothing changed.
- A repository whose README changes without a push does not get picked up until its next push. GitHub only reports pushes.
- The embedding rebuild after a refresh happens during the next resume generation, not during the refresh itself.
