# Scenario quality and pitch package

See integration.md for current status and backend coordination questions.

- Active scenario: src/data/scenarios/website-project.ts, unchanged and compatible with the shared Scenario contract.
- Alternative design: docs/design-drafts/website-project.json. This is NOT production scenario data. Different persona, event sequence and estimates are preserved as design material only.
- Rubric: docs/evaluation-spec.md. src/lib/evaluation/index.ts scores validated observations; shared-result.ts maps assessed dimensions to the actual EvaluationResult schema. Evidence extraction and engine wiring remain pending.
- Tests: evaluation.test.ts, evaluation-shared.test.ts and scenario.test.ts use Vitest. Scenario arithmetic checks apply to the alternative draft. Existing foundation tests remain intact. evaluation.vitest.ts is an extra specimen outside the configured test include pattern.
- tests/engine-outcomes.json and docs/browser-test-contract.md describe expected engine/E2E behavior, not executed integration coverage. Their draft IDs require mapping before engine use.
- tests/nonstandard-replies.md covers scope exchange, booking fields and an included-work challenge.
- pitch/scopeshift-pitch.pdf: ten-slide draft, rendered and visually checked. storyline.md contains the five-minute speech and sources; jury-qa.md contains anticipated questions. The numerical walkthrough is the alternative design, not the active scenario; reconcile it before a live demo.

No production deployment, live AI, user-study result or full negotiation-flow pass is claimed. Node 22 is required by the shared project. Dependencies and shared configuration were not changed by this upload.
