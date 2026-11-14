import "server-only";
import { createHash } from "node:crypto";
import { currentEvent, initialState, processTurn, EngineHistoryError } from "./engine";
import { pendingEvaluation, type SimulationEvaluator } from "./evaluation-port";
import { ReplayStoreError, type ReplayStore } from "./replay-store";
import { scenarioRevision } from "./session-store";
import type { OpenAIClientReplyContext } from "@/lib/ai/openai-client-reply";
import type { InterpretationContext } from "@/lib/ai/rules-interpreter";
import {
  negotiateResponseSchema,
  negotiationTurnSchema,
  type HistoryEntry,
  type NegotiationAction,
  type NegotiationTurn,
  type Scenario,
} from "@/types/scope";

export interface LlmNegotiationOptions {
  scope: string;
  version: string;
  store: ReplayStore;
  interpret: (context: InterpretationContext & { turns: readonly NegotiationTurn[] }) => Promise<NegotiationAction>;
  reply?: (context: OpenAIClientReplyContext) => Promise<string>;
  evaluate?: SimulationEvaluator;
}

function interpretationScope(scope: string) {
  const candidate = `${scope}:interpret`;
  if (candidate.length <= 512) return candidate;
  return `interpret:${createHash("sha256").update(scope).digest("hex")}`;
}

export async function negotiateWithLlm(scenario: Scenario, history: readonly HistoryEntry[], options: LlmNegotiationOptions) {
  let state = initialState(scenario);
  const verifiedTurns: NegotiationTurn[] = [];
  let prefixHash = scenarioRevision(scenario, options.version);
  const interpretScope = interpretationScope(options.scope);

  for (const [index, entry] of history.entries()) {
    const event = currentEvent(scenario, state);
    if (!event || event.id !== entry.eventId) throw new EngineHistoryError("History does not follow the current scenario event.");
    prefixHash = createHash("sha256").update(`${prefixHash}\n${JSON.stringify([entry.turnId, entry.eventId, entry.userMessage])}`).digest("hex");

    const receipt = await options.store.getOrCreate({ scope: options.scope, version: options.version, scenarioId: scenario.id, entry, prefixHash }, async () => {
      if (index !== history.length - 1) {
        throw new EngineHistoryError("An earlier turn is not recorded for this session. Restart the attempt and submit one new turn at a time.");
      }

      if (!options.reply) {
        const action = await options.interpret({
          message: entry.userMessage,
          scenario,
          event,
          project: structuredClone(state.project),
          pendingProposal: structuredClone(state.pendingProposal),
          turns: structuredClone(verifiedTurns),
        });
        return processTurn(scenario, state, { ...entry, action }).turns.at(-1)!;
      }

      const engineTurn = await options.store.getOrCreate(
        { scope: interpretScope, version: options.version, scenarioId: scenario.id, entry, prefixHash },
        async () => {
          const action = await options.interpret({
            message: entry.userMessage,
            scenario,
            event,
            project: structuredClone(state.project),
            pendingProposal: structuredClone(state.pendingProposal),
            turns: structuredClone(verifiedTurns),
          });
          return processTurn(scenario, state, { ...entry, action }).turns.at(-1)!;
        },
      );

      const verifiedEngineState = processTurn(scenario, state, { ...entry, action: engineTurn.action });
      const verifiedEngineTurn = verifiedEngineState.turns.at(-1)!;
      if (JSON.stringify(verifiedEngineTurn) !== JSON.stringify(engineTurn)) {
        throw new ReplayStoreError("A stored turn no longer matches the simulation engine.");
      }

      const nextEvent = currentEvent(scenario, verifiedEngineState);
      const clientReply = await options.reply({
        scenario,
        event,
        nextEvent,
        projectBefore: structuredClone(state.project),
        projectAfter: structuredClone(verifiedEngineState.project),
        pendingProposalBefore: structuredClone(state.pendingProposal),
        pendingProposalAfter: structuredClone(verifiedEngineState.pendingProposal),
        turns: structuredClone(verifiedTurns),
        userMessage: entry.userMessage,
        engineTurn: structuredClone(verifiedEngineTurn),
        requestResolved: verifiedEngineState.eventIndex > state.eventIndex,
        scenarioCompleted: !nextEvent,
      });

      return negotiationTurnSchema.parse({ ...verifiedEngineTurn, clientReply });
    });

    const parsedReceipt = negotiationTurnSchema.safeParse(receipt);
    if (!parsedReceipt.success) {
      throw new ReplayStoreError("A stored turn no longer matches the simulation engine.");
    }
    const next = processTurn(scenario, state, { ...entry, action: parsedReceipt.data.action });
    const verifiedEngineTurn = next.turns.at(-1)!;
    const expected = options.reply
      ? { ...verifiedEngineTurn, clientReply: parsedReceipt.data.clientReply }
      : verifiedEngineTurn;
    if (JSON.stringify(expected) !== JSON.stringify(parsedReceipt.data)) {
      throw new ReplayStoreError("A stored turn no longer matches the simulation engine.");
    }
    verifiedTurns.push(parsedReceipt.data);
    state = next;
  }

  const activeEvent = currentEvent(scenario, state);
  return negotiateResponseSchema.parse({
    scenarioId: scenario.id,
    turns: verifiedTurns,
    project: state.project,
    evaluation: (options.evaluate ?? pendingEvaluation)({
      scenario,
      turns: structuredClone(verifiedTurns),
      project: structuredClone(state.project),
      completed: !activeEvent,
      allowGeneratedClientReply: Boolean(options.reply),
    }),
    currentEventId: activeEvent?.id ?? null,
    completed: !activeEvent,
  });
}
