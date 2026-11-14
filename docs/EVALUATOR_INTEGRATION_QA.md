# Evaluator integration and scenario QA

## Reconciled after PR #3

PR #3 was verified merged into main as f4bb038. main was merged into feat/scenarios-quality. Five conflicts were resolved by retaining the current main implementation of the API route, evaluator, API tests, simulation evaluation tests and this report, then updating this report with actual results. The older quality-branch default-driver wiring and its source tests were restored to main to avoid overriding Danila's explicit evaluation injection. Both HTTP modes keep the main implementation and evidence-v2. No backend defect fix was reverted.

The scenario and evaluator implementations now match main. Each scored observation references an actual user turn and a scenario evaluation rule with the matching category. Unknown rules and repeated inquiry do not create points. Evidence remains grouped by category. The remaining PR #4 scope is quality tests, E2E, design documentation and pitch materials, not a second backend/evaluator implementation.

## Three ordinary regression tests

A targeted Vitest run of tests/simulation-evaluation.test.ts selected exactly the three tests below: 3 passed (18 other cases not selected by the filter). The subsequent full run passed all 120 tests in 18 files, with no skips or expected failures. No it.fails remains in source or tests.

1. Two named removals: Replace contact form and portfolio gallery with booking at the same price and deadline. The parser produces a proposal, the client accepts, active items become core-pages and consultation-booking. Result: $1,500, 18 hours, day 7; three evidence-backed criteria.
2. Booking fields: Which exact fields should be in the booking form? Reply contains name and email and states they still need confirmation. No agreement is applied.
3. Included-work challenge: This change is already included in our contract. Why are we discussing an extra fee? Reply explains the included contact form, lack of appointment scheduling and six additional booking hours. Result remains $1,500 / 20 hours.

The full suite also verifies that unspecified two-item exchanges remain unapplied, reversal/unknown/alternative lists remain unresolved, and questions about reservation behavior or availability sources do not invent an agreement.

## Other retained coverage

The full integrated run includes paid/free outcomes, rejected/infeasible terms, counteroffers and acceptance, duplicate protection, exact retry, Replay, grading evidence, API session/provider handling and receipt storage tests. These are local rules-mode and mocked-provider unit/integration tests. No fresh live OpenAI request was made in this reconciliation.

E2E files retain Arsen's actual UI selectors for the landing, simulation, result comparison, Replay and lost-response retry. The prior three Playwright HTTP checks passed before PR #3; they have not been rerun against this merge. Browser E2E remains a separate acceptance item and no new browser pass is claimed.

## Environment and remaining work

Local tests ran on Node 24.22.1 with existing lockfile dependencies in an isolated source copy. The project requires Node 22: CI on that runtime is still required. See the final PR description for typecheck/lint/build status.

Danila: review PR #4 and run Node 22 CI. Booking reservation semantics and availability source still need product agreement; cloud OpenAI deployment still needs shared persistent replay storage.

Arsen: run the full browser suite on this merged branch and check displayed evidence, original-vs-replay comparison, persistence and retry. Do not treat unit tests or a production build as a browser acceptance pass.
