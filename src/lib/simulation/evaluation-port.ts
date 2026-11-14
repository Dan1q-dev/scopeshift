import type { EvaluationResult, NegotiationTurn, ProjectState, Scenario } from "@/types/scope";

/** Albina's evaluator plugs into negotiateHistory through this interface.
 * The default is explicitly pending, with no invented scores or feedback.
 */
export interface EvaluationContext {
  scenario: Scenario;
  turns: readonly NegotiationTurn[];
  project: ProjectState;
  completed: boolean;
  allowGeneratedClientReply?: boolean;
}

export type SimulationEvaluator = (context: EvaluationContext) => EvaluationResult;

export const pendingEvaluation: SimulationEvaluator = () => ({ criteria: [], strengths: [], improvements: [] });
