import type { EvaluationResult, NegotiationTurn, ProjectState, Scenario } from "@/types/scope";

/** Typed dependency-injection boundary for evidence-based evaluation. */
export interface EvaluationContext {
  scenario: Scenario;
  turns: readonly NegotiationTurn[];
  project: ProjectState;
  completed: boolean;
}

export type SimulationEvaluator = (context: EvaluationContext) => EvaluationResult;

export const pendingEvaluation: SimulationEvaluator = () => ({ criteria: [], strengths: [], improvements: [] });

export { evaluateSimulation as defaultEvaluation } from "@/lib/evaluation/simulation-evaluator";

