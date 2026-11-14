# Quality package integration status

Update: the evaluator is now integrated with the real engine through a tested wrapper. See `EVALUATOR_INTEGRATION_QA.md` for current results, known dialogue defects and the exact HTTP wiring handoff to Danila. The older notes below describe the initial upload.

The repository foundation is now available. AGENTS.md, PROJECT_BRIEF.md, API_CONTRACT.md, the Albina task and src/types/scope.ts were read before this upload.

The active scenario remains src/data/scenarios/website-project.ts: web-project-01, Sarah Mitchell, booking-request / earlier-delivery / scope-swap. Its identifiers, six-hour booking estimate and server-only boundary are preserved. No engine, frontend, shared types, API contract or dependencies are changed.

The earlier independent scenario is preserved under docs/design-drafts/website-project.json as a design alternative, not a production Scenario. Its four-hour booking, Maya persona, minute units and different event sequence are NOT the agreed contract. Arithmetic tests cover that draft only. The pitch walkthrough uses that alternative and must be reconciled with the final live demo before submission.

The evaluator scores validated rubric observations; it is not the backend evaluator and its output must not be returned directly as EvaluationResult. A shared-contract adapter is provided separately. The engine owner must supply validated observations with exact event evidence. Existing history does not expose an impact-review event, quote entailment or proposal revisions; do not infer those silently.

Engine oracles and browser checks are plans, not implemented engine/E2E coverage. Live negotiation still returns 501 in the inspected foundation. No production readiness or user-study pass is claimed.

Questions for Danila: confirm authoritative acceptance evidence and revision semantics; expose validated rubric observations; confirm capacity and cumulative budget policies; approve any changes to scenario IDs or shared schemas before migration.
