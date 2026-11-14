# Evidence-based evaluation v0.1

Each dimension has two equal binary criteria, listed in `src/lib/evaluation/index.ts`. Display 0-4 only when all applicable criteria have evidence. Each met criterion earns 2 points when both apply; one applicable criterion yields 0 or 4. This is a transparent teaching rubric, not a validated psychometric instrument. Do not display a single overall percentage.

For each criterion return met, missed, not-observed or not-applicable, exact event references, reasoning and one actionable next step. Missing evidence means unassessed, not failure. Not-applicable also requires evidence, e.g. a request was declined before commitment. Evaluate at a decision boundary or scenario finish, not while the learner is still clarifying. A later correction supersedes an earlier mistake for scoring; retain the original event as a learning moment without double punishment.

## Observable acceptance rules

- Clarification: learner establishes form fields and whether submission reserves a slot; learns launch priority and approval dependency before offering corresponding work. Already specified facts do not require repeated questions. Declining a request makes its implementation clarification not applicable.
- Scope: learner references baseline correctly, and names exact included, excluded or removed items in an amendment. Asking whether an item is included is valid inquiry. Charging a second fee for the included contact form is an error only if the learner persists after contract clarification.
- Economics: learner reviews the computed impact (via logged impact review), or accurately states its fee and hours. A commercially defensible choice includes no change, paid addition, documented equal-effort exchange or bounded, informed goodwill. No minimum price is a universal correct answer. Hidden willingness to pay never forms a scoring target. Lower rate alone is not a mistake. Unbounded free work or a false calculation is.
- Agreement: mutation uses explicit client acceptance of identified full terms; receipt/thanks/maybe is insufficient. A documented decline leaving the original contract intact is a valid outcome and can satisfy documentation. Mark acceptance not applicable when no amendment is pursued.
- Feasibility: final commitment fits the public capacity model and preserves hard dependencies. Do not penalize an infeasible draft that is corrected before commitment. Do not penalize the learner for undisclosed client constraints. When the engine rejects an impossible commitment, score the learner's resulting resolution, not merely the rejected draft.

## Evidence adapter safety

Only a server adapter may create observations. It must validate the transcript/event log, verify exact quote substrings and actor, map each criterion to a current decision, and use engine facts for arithmetic and feasibility. Model-suggested observations require this validation; uncertain evidence stays not-observed. UI button activity is acceptable evidence if event quote is a canonical displayed label. The provided evaluator verifies criterion identity, duplicate observations and event membership; semantic entailment and quote matching remain the adapter's responsibility.

## Release acceptance

Identical validated input produces deeply identical output. Empty logs yield null scores. Every strength/mistake carries evidence and practical advice. Duplicate criteria, unknown event references and mismatched dimensions fail closed. No points for more money alone, aggressive language, length, politeness proxies or hidden constraints. Two reviewers must independently map annotated transcripts to the rubric and resolve disagreements before calling the rubric calibrated.
