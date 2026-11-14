import "server-only";
import { createHash } from "node:crypto";
import { currentEvent, initialState, processTurn, EngineHistoryError } from "./engine";
import { pendingEvaluation, type SimulationEvaluator } from "./evaluation-port";
import { ReplayStoreError, type ReplayStore } from "./replay-store";
import { scenarioRevision } from "./session-store";
import type { InterpretationContext } from "@/lib/ai/rules-interpreter";
import { negotiateResponseSchema, type HistoryEntry, type NegotiationAction, type NegotiationTurn, type Scenario } from "@/types/scope";

export interface LlmNegotiationOptions {
  scope: string;
  version: string;
  store: ReplayStore;
  interpret: (context: InterpretationContext & { turns: readonly NegotiationTurn[] }) => Promise<NegotiationAction>;
  evaluate?: SimulationEvaluator;
}

export async function negotiateWithLlm(scenario: Scenario, history: readonly HistoryEntry[], options: LlmNegotiationOptions) {
  let state = initialState(scenario);
  let prefixHash = scenarioRevision(scenario, options.version);
  for (const [index, entry] of history.entries()) {
    const event = currentEvent(scenario, state);
    if (!event || event.id !== entry.eventId) throw new EngineHistoryError("History does not follow the current scenario event.");
    prefixHash = createHash("sha256").update(`${prefixHash}\n${JSON.stringify([entry.turnId, entry.eventId, entry.userMessage])}`).digest("hex");
    const receipt = await options.store.getOrCreate({ scope: options.scope, version: options.version, scenarioId: scenario.id, entry, prefixHash }, async () => {
      if (index !== history.length - 1) throw new EngineHistoryError("An earlier turn is not recorded for this session. Restart the attempt and submit one new turn at a time.");
      const action = await options.interpret({ message: entry.userMessage, scenario, event, project: structuredClone(state.project), pendingProposal: structuredClone(state.pendingProposal), turns: structuredClone(state.turns) });
      const next = processTurn(scenario, state, { ...entry, action });
      return next.turns.at(-1)!;
    });
    const next = processTurn(scenario, state, { ...entry, action: receipt.action });
    if (JSON.stringify(next.turns.at(-1)) !== JSON.stringify(receipt)) {
      throw new ReplayStoreError("A stored turn no longer matches the simulation engine.");
    }
    state = next;
  }
  const activeEvent = currentEvent(scenario, state);
  return negotiateResponseSchema.parse({
    scenarioId: scenario.id,
    turns: state.turns,
    project: state.project,
    evaluation: (options.evaluate ?? pendingEvaluation)({ scenario, turns: structuredClone(state.turns), project: structuredClone(state.project), completed: !activeEvent }),
    currentEventId: activeEvent?.id ?? null,
    completed: !activeEvent,
  });
}
