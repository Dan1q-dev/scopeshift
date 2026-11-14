# ScopeShift documentation

Public app: https://scopeshift.vercel.app. Current interfaces and architecture: `PROJECT_BRIEF.md`, `API_CONTRACT.md`, `PUBLIC_DEPLOYMENT.md`.

- Active scenario: `src/data/scenarios/website-project.ts`, Sarah Mitchell, $1,500 / 20h / day 7, six-hour booking.
- Active evaluator: `src/lib/evaluation/simulation-evaluator.ts`, `evidence-v2`, injected into both HTTP modes. See `evaluation-spec.md`.
- Actual checks: `EVALUATOR_INTEGRATION_QA.md`. Historic local walkthrough: `DEMO_READINESS.md`. Published OpenAI/Postgres evidence: `PUBLIC_DEPLOYMENT.md`.
- Browser requirements: `browser-test-contract.md`. Executable checks: `tests/e2e/`. Rules CI and live OpenAI acceptance are separate.
- English ten-slide pitch and 300-second notes: `pitch/scopeshift-pitch.pdf` and `pitch/storyline.md`, aligned with the active scenario and public URL.

## Archived design material

`design-drafts/website-project.json` is an alternative Maya scenario with four-hour booking, minute units and another event sequence. It is not production data. `tests/scenario.test.ts` and `tests/engine-outcomes.json` contain draft arithmetic/design examples; they do not prove behavior of the active engine.

`src/lib/evaluation/index.ts`, `shared-result.ts`, their aggregation tests and `tests/evaluation.vitest.ts` describe a proposed v0.1 observation rubric. HTTP does not use that scale. Fixture aggregation does not provide semantic evidence extraction.

Test counts and release status must name the tested commit and runtime. Older branch results do not prove the final combined branch or current production passed.
