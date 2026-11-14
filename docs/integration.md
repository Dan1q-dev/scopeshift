# Scenario quality integration

The shared product includes frontend, engine, OpenAI action interpretation, `evidence-v2`, Replay/Compare and public Vercel deployment with Neon Postgres: https://scopeshift.vercel.app. The old 501 and pending-evaluator handoff is obsolete.

The active scenario remains `src/data/scenarios/website-project.ts`: Sarah Mitchell, $1,500 / 20h / day 7, events `booking-request`, `earlier-delivery`, `scope-swap`. Booking adds six catalog hours. Shared schemas remain authoritative. OpenAI extracts actions; the engine decides agreements, forms client replies and calculates state.

`evaluateSimulation` is injected into both HTTP drivers. Evidence binds actual turns to applicable rules. Friendly deliverable names and `No deliverables removed.` improve presentation without changing the scale. Results separates Action, Rule and Verified. The captain records final combined-branch acceptance in `EVALUATOR_INTEGRATION_QA.md`.

Production receipts and validated attempt snapshots live in Postgres. Browser cache is a convenience, not the sole store. Signed anonymous identity and recovery limits are documented in `API_CONTRACT.md` and `PUBLIC_DEPLOYMENT.md`.

## Active outcomes

| Choice | Fee | Hours | Deadline | Rate |
| --- | --- | --- | --- | --- |
| Original contract | $1,500 | 20 | day 7 | $75.00/h |
| Free booking | $1,500 | 26 | day 7 | $57.69/h |
| Booking +$400 and +2 days | $1,900 | 26 | day 9 | $73.08/h |
| Paid booking, +$150 rush, equal-effort testimonials swap | $2,050 | 26 | day 7 | $78.85/h |
| Contact form + gallery exchanged for booking, same fee/date | $1,500 | 18 | day 7 | $83.33/h |

These are supported examples, not instructions to maximize price. Unaccepted proposals, clarification, refusal and rejected changes preserve the last agreed contract.

## Archived alternatives and open product questions

The Maya JSON in `design-drafts/website-project.json` and v0.1 observation rubric in `src/lib/evaluation/index.ts` are archived designs. They replace neither the active scenario nor HTTP evaluator. The current pitch uses the active six-hour scenario.

Immediate versus manual reservation and the source of slots are still unspecified. Do not invent these facts or count inquiry as full resolution. A future economic-judgment rubric needs validated learner rationale or impact review, not an inference from a higher fee.

Use Node 22. Run deterministic tests/E2E on the final combined commit, then validate live OpenAI separately. This document does not claim that a pending CI run has passed.
