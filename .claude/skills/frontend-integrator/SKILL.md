---
name: frontend-integrator
description: Use whenever the user wants to hook up an already-built frontend to an already-built backend — wiring real API calls in place of mocks/stubs, closing gaps between frontend types and backend schemas, connecting a UI to real data, or fixing "frontend expects X but backend doesn't have it" type mismatches. Trigger this for phrases like "integrate the frontend with the backend", "wire up this API", "connect this component to the real endpoint", "the frontend and backend schemas don't match", or any task that links previously-separate frontend and backend work together. Do not use it for building a frontend or backend from scratch, or for pure frontend-only styling work.
---

# Frontend Integrator

Wiring a frontend to a backend is a verification task before it is a coding task. The
biggest failure mode is guessing: assuming a field name, type, or endpoint shape because
it "looks right," then papering over the mismatch with `??`/`||`/optional chaining. That
produces code that runs but silently drops or misreads data. This skill exists to prevent
that — the backend's actual schema is the contract, and nothing gets wired against
anything else. (This mirrors the project's CLAUDE.md rule: never guess object shapes —
verify against the source of truth.)

## Workflow

### 1. Read the backend contract (source of truth)
Find and read whatever defines the real shape of the data: DB models/ORM schemas, an
OpenAPI/GraphQL spec, serializers, or the actual route/controller handler code that
builds the response. If more than one of these exist, the one closest to the code that
actually executes (the handler/serializer) wins over documentation, since docs drift.

### 2. Read the frontend's current expectations
Find the frontend's data assumptions: TS interfaces/types, PropTypes, API client
functions, GraphQL queries/fragments, and any mock/stub data currently standing in for
the real backend.

### 3. Cross-check field by field, endpoint by endpoint
Compare the two contracts and sort every discrepancy into exactly one bucket:

- **Supported & inferable** — an unambiguous rename or type coercion (e.g. frontend
  wants `fullName`, backend has `first_name`/`last_name`; frontend expects a string,
  backend sends a number that obviously stringifies). Confidence must come from the
  schema, not a guess about intent. Implement these directly.
- **Needs attention** — the relationship between a frontend field/endpoint and anything
  on the backend is genuinely ambiguous or looks unrelated. Do not implement; queue it.
- **Unsupported** — the frontend expects data or an endpoint the backend does not
  provide at all. Do not invent a fallback; queue it.

Never resolve a "needs attention" or "unsupported" item by inference, default value, or
silent fallback — that's the exact guessing behavior this skill exists to avoid.

### 4. Wire up the confident parts
Replace mocks/stubs with real API calls, apply the verified field mappings, and keep
types consistent end-to-end (derive frontend types from the backend contract rather than
hand-writing parallel ones, so a future backend change breaks the build instead of
silently mismatching at runtime).

### 5. Fill in missing UX plumbing — but only where genuinely absent
Real integrations surface states that mock data hides. Check for, and add only if
missing:
- Loading/pending state while the request is in flight
- Success and error notifications (toast/banner/inline message)
- Empty state (backend returned zero results)
- Disabled/pending button state during submission

Don't add these decoratively where the app already has an equivalent pattern — see step 6.

### 6. Reuse before building
Before adding any new UI primitive (toast, spinner, badge, modal, error banner, etc.),
search the existing codebase for a component or pattern that already does this and use
it. Only build something new if nothing suitable exists, and when you do, match the
existing design tokens, color palette, and icon set already in use rather than
introducing new styling.

### 7. Ask about the queue only — once, batched
After steps 1–4, if the "needs attention" or "unsupported" buckets are non-empty, present
them together in one message using the format b`elow and ask the user about those items
only. Don't ask about anything already resolved in step 3.

## Output format for the attention queue

```
## Needs your input before I continue

| Field / Endpoint | Frontend expects | Backend actually has | Suggested action |
|---|---|---|---|
| `user.avatarUrl` | string URL | not present on `/users` response | Add to backend, or drop from UI? |
| `POST /orders/:id/cancel` | called by CancelButton | no matching route found | Confirm endpoint name/path, or is this unbuilt? |
```

Keep descriptions terse — one row per discrepancy, not a paragraph each.

## Engineering principles behind this

- The backend schema/spec is the single contract source of truth; frontend types should
  be derived from it, not maintained by hand in parallel.
- End-to-end type safety beats defensive guessing (`any`, `??`, optional chaining used to
  mask an unknown shape) — a type mismatch should break the build, not fail silently at
  runtime.
- Don't validate only the happy path: error, empty, and loading states are the most
  commonly missing pieces in a "finished" integration.
- Never move secrets, API keys, or credentials into frontend code while wiring things up
  — those stay server-side.
