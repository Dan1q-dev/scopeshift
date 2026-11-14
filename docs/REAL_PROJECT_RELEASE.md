# Real Project Mode: setup and verification

## Runtime and environment

The new `/real-projects` workspace and `/api/real-projects/**` use the existing Next.js application, signed anonymous cookie, OpenAI Responses API, shared daily AI budget and Neon Postgres pool. Practice Mode contracts, evaluator and engine are unchanged.

No new production secrets are required. Reuse server-only `SCOPESHIFT_AI_MODE=openai`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_TIMEOUT_MS`, `SCOPESHIFT_SESSION_SECRET`, `SCOPESHIFT_STORAGE=postgres`, `SCOPESHIFT_DATABASE_URL`, and `SCOPESHIFT_DAILY_AI_CALL_LIMIT`. Keep the current production session secret and database. Rules/file mode displays a clear unavailable state for Real Project Mode and keeps Practice available.

## Migration

`migrations/002_real_project_mode.sql` adds three private server tables: projects, requests and drafts. Foreign-key cascades implement project deletion. It does not alter Practice tables or existing receipts. Test it on a Neon branch before production.

Using a direct verified database connection in the environment:

```powershell
node scripts/migrate-postgres.mjs --real-project-mode
```

The command applies migrations 001 and 002 in one transaction and refuses a pooled connection string. The migration is additive and uses `IF NOT EXISTS`. Deletion is a separate owner-scoped API operation.

## Checks and synthetic acceptance

Use Node 22. Run typecheck, lint, unit tests, build and the full Playwright suite. The Real Project browser fixtures are explicitly mocked to verify UI consent, correction, calculations, retry and history interactions. They do not prove live provider behavior.

For real database integration, set server-only `SCOPESHIFT_TEST_DATABASE_URL` to a disposable development branch with both migrations applied:

```powershell
npx vitest run src/lib/real-projects/repository.integration.test.ts
```

For an actual provider/API acceptance against a running app:

```powershell
node scripts/smoke-real-project.mjs http://127.0.0.1:3002 --allow-ai
```

This explicitly makes two new OpenAI calls, uses synthetic text, verifies exact quotes and atomic requests, corrects and confirms the interpretation, calculates $1,900 / 26h / $73.08 per hour, generates and edits a proposed response, checks cached retry, history, cross-session 404, stale sources, and cascade deletion. It attempts cleanup of its own synthetic project. Do not point database integration tests at the production database.

Development acceptance completed on a dedicated Neon branch: seven actual database integration tests passed. The actual OpenAI/API smoke passed, including both provider calls, exact evidence, duplicate recovery, persisted edits, isolation and deletion. Final UI/CI and publication evidence are recorded separately after they run.

## Current limits

- Pasted agreement/amendments only. PDF, DOCX, TXT upload and OCR extraction are not implemented or advertised as working.
- Ten projects per anonymous session, twenty requests per project and twenty draft generations per request. Request history responses are capped at 3 MiB; individual records remain addressable.
- Source text is bounded to 24,000 agreement characters, 8,000 amendment characters and 6,000 client-message characters. Analysis sends these bounded source passages; drafting sends only selected, reviewed item descriptions rather than full agreements.
- Included/excluded labels require a verified agreement quote. Exact quote validation proves textual grounding, not semantic correctness or a legal conclusion. User review remains mandatory.
- Hours and prices are manually entered. Classification does not determine billability. All financial/date calculations run on the server; commercial terms remain proposed.
- Draft opening/closing uses AI; the server inserts confirmed items, prices, estimates, dates and open questions. Invented numerical/date or accepted-status wording fails closed. The proposed block is capped before a paid call.
- Network retries reuse IDs. A durable failure or abandoned pending operation needs an explicit new user action. No automatic provider-call takeover occurs.
- Anonymous access lasts 30 days from cookie creation, without account recovery, cross-device transfer or automatic SQL expiry. Editing/redacting creates a new source revision and retains earlier snapshots. Delete project removes associated application records; it does not promise deletion from external provider logs.
- Practice links carry no real contract or client message. No email is sent, no contract is signed, and no payment is taken.

## Team integration

Arsen owns final UX and polish of the isolated reference UI. Albina owns additional realistic fixtures, acceptance review and the educational/pitch narrative. Use [API v1](REAL_PROJECT_API.md), [Arsen handoff](REAL_PROJECT_HANDOFF_ARSEN.md) and [Albina handoff](REAL_PROJECT_HANDOFF_ALBINA.md). The four required contracts/handoff documents were published first in commit `b05a77f` on `codex/real-project-mode`.
