# Evaluator integration and scenario QA

## Backend follow-up

The three reported defects were reproduced as ordinary failing tests and fixed in the backend integration. The final integration uses Albina's newer `evidence-v2` evaluator and matching scenario evaluation rules from the updated quality branch. HTTP passes `evaluateSimulation` to both rules and OpenAI drivers and sends `X-ScopeShift-Evaluation: evidence-v2`. Named multi-item exchanges are accepted only when every removal is active and every addition belongs to the current request. Reversed, unknown or alternative item lists remain unapplied.

The evaluator verifies scenario rule IDs and categories, prevents repeated inquiry from earning duplicate points and groups evidence by skill. Long observations are bounded while retaining the full learner message. The explicit unchanged-fee wording used by the live OpenAI smoke is recognized alongside "same price". Validation on Node 22 passed: typecheck, lint, 108 ordinary unit/integration tests and production build. Rules HTTP smoke passed the three reported regressions with evidence-v2; the real OpenAI HTTP smoke passed a full evaluated branch, clarification and cached retry without another model call. No expected-failure test is used for the three reported fixes. Browser E2E and cloud deployment remain separate acceptance work.

Client clarification now explains the included contact form versus additional booking, proposes name/email/selected-slot fields, and explicitly states that reservation behavior and the source of slot availability are not yet agreed. The six-hour definition is unchanged; no four-hour draft was substituted. These replies do not claim requirements are fully resolved. The historical findings and validation below describe Albina's source report before these fixes; all three `it.fails` cases have become ordinary regression tests in the integrated suite.

## Implemented in Albina's ownership

`src/lib/evaluation/simulation-evaluator.ts` implements the existing `SimulationEvaluator` port. `negotiate-with-evaluation.ts` calls the real `negotiateHistory` with that evaluator, without changing engine or API files. It replays trusted actions and checks the actual turns and final project before emitting evidence. It does not treat arbitrary incoming strings or the caller's claimed financial totals as evidence.

Checks worth one point each: a specific requirements inquiry (one per event), accepted catalog amendment, explicit client acceptance recorded once, and feasibility under the engine's planning capacity. Each criterion includes a turn ID, rule ID, observation and advice. The evaluator version is evidence-v1. Missing evidence is unassessed, not zero. These checks do not establish that every requirement was resolved, every term was expressly documented by the learner, or real calendar delivery is possible. Do not convert their subset to an overall percentage.

Economic changes are calculated by the engine and explained in feedback. No economic-judgment score is fabricated from a price increase or goodwill concession. A documented equal-effort swap is recognized. The current transcript lacks trustworthy evidence of impact review and full reasoning, so that skill remains unassessed. Rejected drafts do not create negative learner scores. Declines retain the contract and return unassessed criteria.

## Verified behavior

- Full paid path: booking +$400 / +2 days; rush +$150 / -2 days; gallery exchanged for testimonials. Final $2,050, 26h, day 7, estimated $78.85/hour. Three accepted agreements.
- Free booking: $1,500, 26h, day 7, estimated $57.69/hour. No automatic penalty.
- $900 proposal gives a $400 counteroffer; no economic mutation until acceptance. Retrying is deterministic and duplicate turn IDs are rejected.
- Infeasible day-5 rush after paid booking is rejected without changing the day-9 contract. It does not generate a fabricated learner mistake.
- Tampered turns and project totals are rejected by the evaluator.

## Three unconventional replies

| Reply | Actual behavior | Status |
| --- | --- | --- |
| I can add booking, but only if we remove two other features. | Unresolved; contract unchanged. Unnamed items correctly require clarification. | Safe, incomplete guidance |
| Replace contact form and portfolio gallery with booking at the same price and deadline. | Parser cannot resolve two removals; contract unchanged. Direct engine call with exact IDs succeeds: $1,500 / 18h / day 7. | Interpreter defect |
| Which exact fields do you need in the booking form? Does a submission reserve a place, or will you confirm availability manually? | Clarification action; no state mutation. Client repeats the generic feature description without naming fields or resolving reservation semantics. | Dialogue/scenario gap |
| This change is already included in our contract. Why are we discussing an extra fee? | Clarification action; no fee or scope mutation. Client repeats the request without explaining the included contact form versus additional scheduling. | Dialogue gap |

The last three desired behaviors have explicit `it.fails` tests in `tests/simulation-evaluation.test.ts`. These are known defects, not passing product features. Once fixed they must be converted to ordinary tests. The unspecified exchange and ambiguous assent also have ordinary safety tests.

## Message for Danila

Evaluator is integrated with the real engine through the existing injection port and tested using the active Sarah Mitchell scenario. To enable it in HTTP, make these small changes in your owned `src/app/api/negotiate/route.ts`:

```ts
import { evaluateSimulation, EVALUATOR_VERSION } from "@/lib/evaluation/simulation-evaluator";
// Existing call:
const result = negotiateHistory(scenario, parsed.data.history, evaluateSimulation);
// Existing response header:
"X-ScopeShift-Evaluation": EVALUATOR_VERSION,
```

Also replace the HTTP test's expectation of pending/empty evaluation with evidence assertions and update API_CONTRACT.md. The default engine evaluator intentionally remains unchanged, so the existing default-driver tests remain valid. Albina has not edited these owned files.

Please fix the interpreter's exactly-one-removal restriction. ScopeChange and engine already support arrays; return clarification for unnamed or absent items, but accept exact supported multi-item exchanges. Preserve explicit client acceptance and feasibility validation.

Before improving clarification responses, agree on booking semantics. Current active definition is a six-hour available-slot selection with confirmation email, no payments or calendar sync. Do not silently replace it with the draft's four-hour manual booking request. Proposed fields to approve: name, email, selected consultation slot; specify whether confirmation reserves a slot and where slot availability comes from. I will update scenario facts after agreement. The client reply should answer the actual question and contrast the included contact form with the new scheduling behavior.

For a future complete economic-judgment rubric, agree on a validated impact-review/learner-rationale event. Do not use hidden client budget as a scoring target or infer a learner's understanding merely from agreement acceptance.

## Validation environment

Checks were run in an isolated copy of the merged source using the existing lockfile dependencies, Node 24.22.1 and npm 11.6.2. Typecheck, lint and production build passed. Vitest: 10 files, 73 ordinary tests passed and 3 expected failures documenting known defects. The repository requires Node 22; CI on the prescribed runtime remains necessary. No browser, live LLM or deployed HTTP evaluator pass is claimed.
