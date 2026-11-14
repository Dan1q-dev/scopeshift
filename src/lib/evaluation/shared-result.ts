import { evaluationResultSchema, type EvaluationCategory, type EvaluationResult } from "@/types/scope";
import { evaluate, dimensions, type Dimension, type Observation } from "./index";

const category: Record<Dimension, EvaluationCategory> = {
  clarification: "clarification", scope: "scope_management", economics: "economic_decision",
  agreement: "explicit_agreement", feasibility: "feasibility",
};

/** Input must already be semantically validated by the server evidence adapter.
 * eventToTurn binds observed event IDs to real shared-contract turn IDs.
 * Unassessed dimensions are omitted, never converted to zero or full points.
 */
export function toSharedEvaluation(observations: Observation[], eventToTurn: Readonly<Record<string, string>>): EvaluationResult {
  const scored = evaluate(observations, Object.keys(eventToTurn));
  return evaluationResultSchema.parse({
    criteria: dimensions.flatMap(dimension => {
      const score = scored.scores[dimension];
      if (score.score === null) return [];
      const entries = observations.filter(o => o.dimension === dimension && (o.status === "met" || o.status === "missed"));
      return [{
        category: category[dimension], earnedPoints: score.earned, maxPoints: score.possible,
        evidence: entries.flatMap(o => o.evidence.map(e => ({
          turnId: eventToTurn[e.eventId], ruleId: o.criterionId,
          observation: `${o.explanation} Evidence: ${e.quote}`,
        }))),
        advice: entries.map(o => o.advice).join(" "),
      }];
    }),
    strengths: scored.strengths.map(o => o.explanation),
    improvements: scored.mistakes.map(o => o.advice),
  });
}
