# Current update: evidence-v2

The default driver now selects the real evaluator through src/lib/simulation/evaluation-port.ts (defaultEvaluation). The HTTP route reports X-ScopeShift-Evaluation: evidence-v2. Existing custom evaluator injection remains supported; pendingEvaluation remains available only as an explicit opt-out.

Scores are grouped by category for the existing ResultsView, with an individual evidence record per awarded point. Every awarded point requires a rule ID AND matching category in the active event clientRules.evaluationRules, the actual user message and verified engine outcome. Rules added to the active scenario cover specific inquiry, capacity and recorded acceptance. Existing IDs are preserved. The swap-economics rule explicitly rewards a no-fee equal-effort proposal, not merely a price increase. Duplicate observations of the same rule do not earn repeated points. Missing evidence remains unassessed.

Real Route Handler integration coverage includes paid/free outcomes, refusal, a counteroffer followed by acceptance, identical retry in the same cookie session and prefix-preserving Replay. This is actual handler/engine code with no mocked client response. Playwright transport tests implement the same branches under tests/e2e/negotiation-api.spec.ts.

Frontend update: PR #2 arrived during this task and origin/main 76b1083 was merged without conflicts. foundation.spec.ts now opens Start free simulation and checks the real panels. workspace.spec.ts covers paid completion, free Replay, comparison persistence after refresh, counteroffer/refusal and lost-response retry. Retry injects only transport loss AFTER a real server response, never a fake successful response. All other application calls are real.

Browser execution limitation: automatic approval review rejected the shell launch of the browser E2E runner (sandbox approval required, but unavailable in this session), including the isolated managed Chromium option. No UI E2E pass is claimed. Three Playwright HTTP tests had already passed against the production server before the frontend merge. The final source compiles and builds, and the same HTTP paths are independently covered through the real Route Handler. Re-run the browser suite in the supported CI or local Node 22 environment before merging.

Validation: 11 Vitest files, 76 passed + 3 expected failures for the previously documented parser/dialogue gaps. Those defects remain open. Node 24.22.1 local runtime; Node 22 CI remains required. Type generation, typecheck, lint and a production build passed in the isolated copy. A first frontend build failed with EPERM in its output directory; a fresh isolated output build then completed successfully. Shared source configuration and dependencies were not changed.

The section below records the preceding evidence-v1 handoff. Its statement that the API remains pending is superseded by this update.

---

# Evaluator integration and scenario QA

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
