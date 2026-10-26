# Removed from this release

The current release is the user-facing app: sign-up, onboarding, sources, evidence, the Career Graph, CV feedback, resumes, settings, billing and privacy.

The following were removed from the codebase for this release. The database tables stay in the migrations, so they can be re-added later:

- **Organisation API** (`/v1/org/*`): API-key authentication, scopes, rate limits and quotas, and resume creation for consenting people.
- **Staff console** (`/v1/admin/*` and the `/org` screens): client set-up, key management, usage and audit log.
- **Consent requests** (`/v1/consent-requests/*` and `/consent/[token]`): the organisation-initiated access flow.
- **Partner webhooks** (`webhook_delivery` job): signed resume-completed notifications to partners.
- **API reference page** (`/org/docs`).

Before any of this returns, it needs a product decision on who the organisation customers are, and a review of the consent and key-handling flows.
