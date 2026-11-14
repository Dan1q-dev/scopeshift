import { expect, it } from "vitest";
import { evaluationResultSchema } from "@/types/scope";
import { toSharedEvaluation } from "@/lib/evaluation/shared-result";
import type { Observation } from "@/lib/evaluation";

it("omits unassessed scores and conforms to the shared response schema", () => {
  expect(toSharedEvaluation([], {})).toEqual({ criteria: [], strengths: [], improvements: [] });
  const observations: Observation[] = ["fields", "priority"].map(criterionId => ({
    criterionId, dimension: "clarification", status: "met",
    evidence: [{ eventId: "observed-1", quote: "Which fields and launch date do you need?" }],
    explanation: "Fixture: requirements clarified before commitment.", advice: "Record the clarified requirements.",
  }));
  const result = toSharedEvaluation(observations, { "observed-1": "turn-1" });
  expect(evaluationResultSchema.safeParse(result).success).toBe(true);
  expect(result.criteria[0]).toMatchObject({ category: "clarification", earnedPoints: 2, maxPoints: 2 });
  expect(result.criteria[0].evidence[0].turnId).toBe("turn-1");
});
