# Real Project Mode acceptance - 15 November 2026

## Scope and evidence

Baseline: `origin/main` `3dc6da2` (merged into `feat/scenarios-quality` after `e230308`). Public browser acceptance: https://scopeshift.vercel.app/real-projects. One live mixed-request analysis and one live draft generation were executed with wholly fictional text and explicit AI consent. This is an owner-led acceptance walkthrough, not independent customer research or a measured model accuracy study. The UI does not disclose a deployed SHA; the public deployment was not independently tied to this exact commit.

No backend, shared DTO, financial engine, or UI changes are part of this QA update. `evidence-v2` Practice scoring remains intact.

## Additional agreements and expected results

`tests/fixtures/real-project-v1-acceptance/` adds three fictional English cases, each with `agreement.txt`, `amendments.txt`, `client-message.txt`, `project.json` and `expected.json`. Project inputs parse with the real `realProjectCreateSchema`. Expected results are human oracles, not model transcripts.

| Case | Checks |
| --- | --- |
| `mixed-website` | Included contact form; excluded calendar sync; unspecified booking and extra pages; undefined minor copy updates; CRLF; repeated emoji quotation |
| `podcast-amendment` | Accepted swap makes transcript included and removes episode two; error correction stays included; video proposal remains pending; earlier deadline needs agreement; music unspecified |
| `presentation-ambiguity` | Editable PPTX and typo correction included; research/script excluded; undefined minor revision; chart data unspecified; conditional unnamed exchange; repeated caption and malicious quoted content |

Accept justified ambiguity where the oracle permits it. Do not require identical wording, ordering or a predetermined negotiation result. An exact quotation proves its presence in the source, not its legal significance. Model semantic interpretation still needs human review. The two additional non-website agreements have not been sent to the live model in this run.

## Public user acceptance

Created `QA Albina mixed website - synthetic only`, $1,500 / 20 hours / 2026-11-28. The desktop test used the sample's date, intentionally distinct from the canonical unit-test baseline 2026-11-22. Pasted a short fictional agreement including a five-page site/contact form, expressly excluded synchronization, undefined minor updates, repeated `Ready 🚀`, and a rule that proposals alone do not change terms.

Client request: `Please retain the agreed contact form. Add appointment booking and calendar synchronization. Could we add two more pages and include minor updates to the copy?`

| Step | Observed result |
| --- | --- |
| Create and privacy | Paste-only limitation, server storage/cookie warning and separate AI consent visible before action |
| Analyze | Five separate items: form included, sync excluded, booking/pages not specified, copy ambiguous |
| Inspect evidence | C1 quoted for form, C2 for sync, C3 for minor updates; no invented clause for booking; source and request offsets displayed |
| Correct | Booking changed to ambiguous with required reason about request form versus actual reservation; original AI interpretation preserved separately |
| Confirm | Review revision 1 saved; wording explicitly separates user interpretation from client acceptance |
| Select and estimate | Selected booking only, excluded sync/pages/copy from this proposal; entered +6h, fixed +$400, expenses $20, +2 calendar days, unresolved requirements as assumptions |
| Calculate | Proposed $1,900 / 26h / 2026-11-30 / $73.08 per hour; incremental fee less new expenses $380; baseline stayed $1,500 / 20h / November 28 |
| Generate | Live English response included only selected booking, pending questions, assumptions, proposed price/date and explicit request for confirmation |
| Edit and copy | Added a clarification sentence; saved it; Copy response clipboard matched the saved ending |
| Reload | Opened project and request history; correction, reason, selected items, calculation and edited draft restored; AI consent reset |
| Practice | Opened existing Sarah Mitchell fictional scenario at `/simulation`, with $1,500 / 20h / 7 days and no real-project text in the URL or displayed scenario |
| Mobile | 390 x 844 viewport: document scroll width 375, no horizontal overflow; reviewed sections and saved draft visible in full-page capture |
| Keyboard spot check | Tab from edited response focused Copy response. This is a spot check, not a complete accessibility audit |

The generated response remained a proposal. No message was sent to a client, no payable invoice or actual contract acceptance was created. After explicit user approval, confirmed deletion of this test project. The UI showed `Project and associated application history deleted` and an empty history. This confirms the application result, not independent physical deletion from provider backups. Screenshots are retained with the delivered QA package.

## Production-function regression coverage

`tests/real-project-acceptance.test.ts` adds 25 checks using actual shared DTOs and production source/finance functions. Covers three schema-valid agreements, invented/wrong-document quotes, CRLF/UTF-16 repeated-emoji references, missing evidence for exclusions, paid/free work, equal swap, net removal, reduced fee, zero extra work, positive and negative half-cent rounding, negative expenses/rate/hours, impossible hours/fee, overflow, invalid date and stale review/source.

Canonical example: $1,500 / 20h / November 22 + 6h + $400 + $20 expenses + two calendar days = proposed $1,900 / 26h / November 24 / $73.08 per hour / $380 incremental fee less expenses. A free addition gives $57.69 per hour and is not automatically a learner mistake.

Existing backend tests remain responsible for session isolation, request/draft idempotency, malformed output, stale concurrent writes and repository deletion. Passing source tests does not prove model prompt-injection resistance. The malicious document is an additional review vector, not a completed live attack test.

## Follow-up for teammates

Local checks on merged `3dc6da2`: 407 tests passed, 14 database-backed checks skipped because no dedicated test database was configured. All 25 new production-function checks passed. Type generation, TypeScript and lint passed. Lint excluded pre-existing scratch `.next*` directories, which are not repository source. Local runtime is Node 24.22.1 / installed Next 16.4.6 rather than the required Node 22 CI environment; these results do not replace the lockfile-based CI run. No secrets, package manifests or lockfiles changed. Default Turbopack build hit Windows sandbox junction restrictions; a Webpack attempt hit a deep-path filesystem error. A shorter-path verification workspace is being checked separately; no green default production-build claim is made here.

Arsen: after reload the saved impact and draft are visible, but the Change Order section asks to calculate again. Consider restoring it from saved inputs or explaining why regeneration is needed. The full analysis is long on mobile; consider compact per-item summaries with expandable evidence. These are usability follow-ups, not observed incorrect arithmetic.

Danila: run Node 22 CI and database-backed checks on this branch. Run the podcast and presentation inputs against the live provider and review semantics, amendment precedence, conditional exchange and quoted prompt injection. Keep any model accuracy claim limited to measured cases. Check retry/error/storage paths in a controlled test environment rather than forcing production failures.

Skills handoff: the live link goes to the existing generic exercise. Future contextual mapping can use local issue labels only: missing requirements -> clarification; silent additions -> scope boundaries; accepted amendments -> documentation; earlier delivery -> feasibility; conditional swaps -> scope trade-offs. Do not transmit agreement text, client names or quoted passages to Practice. Personalized scenario selection and learning/retention benefits remain unvalidated.

## Pitch update

Ten English slides and 300-second speaker allocation now describe both public modes: **Practice teaches. Real Project helps apply skills. Learn it. Apply it. Improve it.** Slide 7 uses verified proposal arithmetic. Paste-only input, human review and separate client acceptance are explicit. A generic Practice link is live; personalized skill routing is future work. $9/month and $19/pack remain pricing hypotheses, with no payments or willingness-to-pay evidence claimed. Market context is dated and attributed; illustrative economics remain assumptions.
