# How sources sync

This explains when Tracck reads a person's sources, what it reads each time, and what each control does. It describes the code as built in `backend/src/sources/` and `backend/src/ai/`.

## Principles

- **Nothing is read on a timer.** Reading costs API calls and model calls, and a person who is not using Tracck should cost nothing.
- **Changed things only.** Every read skips anything the source reports as unchanged.
- **Reads happen when they matter.** Before a resume is written, and when the person asks.

## Sources at a glance

| Source | When it is read | What is read each time | Change detection |
|---|---|---|---|
| GitHub | Before a resume is written, if last read more than 6 hours ago. On refresh and retry | Repository list, then only the repositories changed since last read. Releases of the 8 most recent repositories | GitHub's `pushed_at` per repository. Releases are read once, because they do not change after publishing |
| Portfolio page | Same as GitHub | The page, and only if its text changed | SHA-256 of the extracted text |
| CV (PDF or Word) | On upload only | Nothing: the stored file is what the person uploaded | Not needed |
| LinkedIn export, X archive | On upload only | Nothing. X: posts only | Not needed |
| Pasted text (Behance, LinkedIn text) | On paste only | Nothing | Not needed |
| Manual entry | When created | Not a source; saved as an entry | Not needed |

Uploaded and pasted sources are never read again. They change only when the person replaces them.

## Triggers

| Trigger | Where it comes from | What it does |
|---|---|---|
| Resume generation | `POST /v1/resumes` and regeneration. The resume job calls `syncChanged` first | Reads GitHub and portfolio sources last read more than 6 hours ago. Unchanged items are skipped |
| Refresh | `POST /v1/sources/:id/refresh` (button on each source) | Reads the source for new or changed items. Then restarts any embedding run that is stuck, and queues one if none is pending |
| Retry | `POST /v1/sources/:id/retry` (after a problem) | Same as refresh |
| Reset | `POST /v1/sources/:id/reset` (button on each source, with confirmation) | Deletes every entry, stored file and read the source produced, pinned and edited entries included. The connection stays. GitHub and portfolio sources can be refreshed afterwards; an uploaded file must be uploaded again. Returns 204 |
| Remove | `DELETE /v1/sources/:id?entries=keep\|delete` | Disconnects the source. `keep` leaves its entries; `delete` removes them, except pinned and edited ones |
| Replace | Uploading a new CV, LinkedIn export or X archive | Removes what the old file produced, then reads the new one |

Refresh never deletes embeddings. There is no scheduled source read. The daily scheduler only queues embeddings for people whose evidence lacks them, sends the weekly digest and runs cleanup.

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

## Embeddings

Embeddings are what retrieval uses to find entries for a job. They are built by an index run for the person (`profile_index`), which needs the AI model to be configured.

- A new entry queues an index run when it is created.
- A refresh restarts an index run that is stuck: one waiting on a long retry, or queued for more than 10 minutes. Then it queues one if none is pending.
- The reconciler already recovers runs that stop reporting progress.
- The daily scheduler queues an index run for anyone with entries that have no embedding.

Without a model, nothing is embedded. Keyword and tag matching still find the entries.

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
- The "stuck" rule for an embedding run (10 minutes queued, or any retry wait) is a heuristic. It is not yet tested against a real queue.
