import "server-only";
import { interpretMessage } from "@/lib/ai/rules-interpreter";
import { currentEvent, initialState, processTurn, EngineHistoryError } from "@/lib/simulation/engine";
import { pendingEvaluation, type SimulationEvaluator } from "@/lib/simulation/evaluation-port";
import { negotiateResponseSchema, type HistoryEntry, type Scenario } from "@/types/scope";

/** Rebuild a complete branch from the authoritative scenario on every request.
 * The default interpreter is synchronous and deterministic rules-v1.
 * A future LLM implementation requires durable interpreted-turn storage first.
 */
export function negotiateHistory(scenario: Scenario, history: readonly HistoryEntry[], evaluate: SimulationEvaluator = pendingEvaluation) {
  let state = initialState(scenario);
  for (const entry of history) {
    const event = currentEvent(scenario, state);
    if (!event || event.id !== entry.eventId) throw new EngineHistoryError("History does not follow the current scenario event.");
    const action = interpretMessage({ message: entry.userMessage, scenario, event, project: state.project, pendingProposal: state.pendingProposal });
    state = processTurn(scenario, state, { ...entry, action });
  }
  const activeEvent = currentEvent(scenario, state);
  return negotiateResponseSchema.parse({
    scenarioId: scenario.id,
    turns: state.turns,
    project: state.project,
    evaluation: evaluate({ scenario, turns: structuredClone(state.turns), project: structuredClone(state.project), completed: !activeEvent }),
    currentEventId: activeEvent?.id ?? null,
    completed: !activeEvent,
  });
}
