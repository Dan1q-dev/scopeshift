import {
  historyEntrySchema,
  negotiationActionSchema,
  negotiationTurnSchema,
  projectStateSchema,
  type Agreement,
  type HistoryEntry,
  type NegotiationAction,
  type NegotiationTurn,
  type ProjectState,
  type Scenario,
  type ScopeChange,
} from "@/types/scope";

export interface EngineSnapshot {
  readonly scenarioId: string;
  readonly project: ProjectState;
  readonly eventIndex: number;
  readonly turns: readonly NegotiationTurn[];
  readonly pendingProposal: Agreement | null;
}

export type TrustedTurnInput = HistoryEntry & { action: NegotiationAction };

export class EngineHistoryError extends Error {
  readonly code = "INVALID_HISTORY";

  constructor(message: string) {
    super(message);
    this.name = "EngineHistoryError";
  }
}

export function initialState(scenario: Scenario): EngineSnapshot {
  const contract = scenario.initialContract;
  return {
    scenarioId: scenario.id,
    project: projectStateSchema.parse({
      scenarioId: scenario.id,
      totalFeeCents: contract.feeCents,
      estimatedHours: contract.estimatedHours,
      deadlineDays: contract.deadlineDays,
      effectiveHourlyRateCents: Math.round(contract.feeCents / contract.estimatedHours),
      activeScopeItems: [...contract.scopeItems],
      acceptedAgreementIds: [],
    }),
    eventIndex: 0,
    turns: [],
    pendingProposal: null,
  };
}

export function currentEvent(scenario: Scenario, state: EngineSnapshot): Scenario["events"][number] | null {
  if (scenario.id !== state.scenarioId || state.project.scenarioId !== scenario.id) {
    throw new EngineHistoryError("The simulation belongs to another scenario.");
  }
  return scenario.events[state.eventIndex] ?? null;
}

function boundedReply(message: string) {
  return message.length <= 4_000 ? message : `${message.slice(0, 3_997)}...`;
}

function usd(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function strategyFor(change: ScopeChange): "scope_swap" | "paid_change" | "free_change" {
  if (change.addScopeItemIds.length > 0 && change.removeScopeItemIds.length > 0) return "scope_swap";
  return change.feeDeltaCents > 0 ? "paid_change" : "free_change";
}

interface ProposalValidation {
  project: ProjectState | null;
  reason: string | null;
}

function validateProposal(
  scenario: Scenario,
  state: EngineSnapshot,
  change: ScopeChange,
  checkBudget: boolean,
): ProposalValidation {
  const event = currentEvent(scenario, state);
  if (!event) return { project: null, reason: "This scenario is already complete." };
  const reject = (reason: string): ProposalValidation => ({ project: null, reason });
  const active = new Map(state.project.activeScopeItems.map((item) => [item.id, item]));
  const available = new Map(event.availableScopeItems.map((item) => [item.id, item]));

  if (change.addScopeItemIds.some((id) => active.has(id))) {
    return reject("Some of that work is already included in our current contract.");
  }
  if (change.addScopeItemIds.some((id) => !available.has(id))) {
    return reject("That addition is not defined for the current change request. Please clarify its scope first.");
  }
  if (change.removeScopeItemIds.some((id) => !active.has(id))) {
    return reject("The work you want to remove is not in our current agreed scope.");
  }
  if (change.feeDeltaCents === 0 && change.deadlineDeltaDays === 0 && change.addScopeItemIds.length === 0 && change.removeScopeItemIds.length === 0) {
    return reject("These terms do not change the contract. Please propose a defined change or decline the request.");
  }
  if (event.availableScopeItems.length > 0 && change.addScopeItemIds.length === 0) {
    return reject("Please include the requested new work in the proposed scope, or decline this request.");
  }
  // A request without new scope represents an acceleration in this scenario model.
  if (event.availableScopeItems.length === 0 && change.deadlineDeltaDays >= 0) {
    return reject("Please propose an earlier delivery date, or retain the existing agreement by declining this request.");
  }
  if (!event.clientRules.validStrategies.includes(strategyFor(change))) {
    return reject("I cannot agree to that type of change for this request. We can discuss another approach or retain our current agreement.");
  }

  const nextItems = state.project.activeScopeItems.filter((item) => !change.removeScopeItemIds.includes(item.id));
  for (const id of change.addScopeItemIds) nextItems.push(available.get(id)!);
  const estimatedHours = nextItems.reduce((hours, item) => hours + item.estimatedHours, 0);
  const totalFeeCents = state.project.totalFeeCents + change.feeDeltaCents;
  const deadlineDays = state.project.deadlineDays + change.deadlineDeltaDays;
  const rules = event.clientRules;

  if (totalFeeCents < 0 || !Number.isSafeInteger(totalFeeCents)) return reject("The proposed total fee is not valid.");
  if (estimatedHours <= 0) return reject("The project must retain a defined, non-empty scope.");
  if (deadlineDays < rules.earliestDeadlineDays || deadlineDays > rules.latestDeadlineDays) {
    return reject("I cannot agree to that delivery date. Please propose another date or retain the current contract.");
  }
  // Scenario days start at the original contract. This is capacity planning, not an elapsed-time model.
  if (estimatedHours > rules.maximumHoursPerDay * deadlineDays) {
    return reject("That deadline is not feasible for the agreed amount of work. Please allow more time or reduce the scope.");
  }
  if (checkBudget && change.feeDeltaCents > rules.maxAdditionalFeeCents) {
    return reject("I cannot approve that additional fee.");
  }

  const project = projectStateSchema.safeParse({
    scenarioId: scenario.id,
    totalFeeCents,
    estimatedHours,
    deadlineDays,
    effectiveHourlyRateCents: Math.round(totalFeeCents / estimatedHours),
    activeScopeItems: nextItems,
    acceptedAgreementIds: [...state.project.acceptedAgreementIds],
  });
  return project.success ? { project: project.data, reason: null } : reject("The proposed project terms are outside the supported limits.");
}

function agreedReply(project: ProjectState) {
  return `Agreed. The contract now totals ${usd(project.totalFeeCents)}, with ${project.estimatedHours} estimated hours and delivery by day ${project.deadlineDays}. The scope amendment is recorded in this agreement.`;
}

function agreement(entry: HistoryEntry, change: ScopeChange, status: Agreement["status"], explanation: string): Agreement {
  return {
    // Agreement IDs have their own namespace. Reusing the unique turn ID avoids truncation or collisions.
    id: entry.turnId,
    eventId: entry.eventId,
    sourceTurnId: entry.turnId,
    status,
    change,
    explanation,
  };
}

function acceptProject(project: ProjectState, agreementId: string): ProjectState {
  if (project.acceptedAgreementIds.includes(agreementId)) {
    throw new EngineHistoryError("This agreement has already been applied.");
  }
  return { ...project, acceptedAgreementIds: [...project.acceptedAgreementIds, agreementId] };
}

export function processTurn(scenario: Scenario, state: EngineSnapshot, input: TrustedTurnInput): EngineSnapshot {
  const entryResult = historyEntrySchema.safeParse({ turnId: input.turnId, eventId: input.eventId, userMessage: input.userMessage });
  const actionResult = negotiationActionSchema.safeParse(input.action);
  if (!entryResult.success || !actionResult.success) throw new EngineHistoryError("The interpreted turn is invalid.");
  const entry = entryResult.data;
  const action = actionResult.data;
  const event = currentEvent(scenario, state);
  if (!event) throw new EngineHistoryError("This scenario is already complete.");
  if (state.turns.some((turn) => turn.turnId === entry.turnId)) throw new EngineHistoryError("The turn ID has already been used in this history.");
  if (event.id !== entry.eventId) throw new EngineHistoryError("The history does not follow the current scenario event.");
  if (state.turns.length >= 50) throw new EngineHistoryError("The simulation has reached its supported history limit.");

  let project = state.project;
  let eventIndex = state.eventIndex;
  let pendingProposal = state.pendingProposal;
  let turnAgreement: Agreement | null = null;
  let clientReply: string;

  switch (action.kind) {
    case "clarify":
      clientReply = `Here is the defined request: ${event.clientMessage} ${event.availableScopeItems.map((item) => item.description).join(" ")} Please confirm the scope, fee and delivery terms before we agree to a change.`;
      break;
    case "unresolved":
      clientReply = "I am not sure which terms you are proposing. Please state the work to add or remove, any additional fee, and the delivery date. Our current contract remains unchanged.";
      break;
    case "decline":
      if (!event.clientRules.validStrategies.includes("decline") && !event.clientRules.validStrategies.includes("keep_contract")) {
        clientReply = "Let's discuss another approach to this request before closing it. The existing contract remains unchanged.";
        break;
      }
      clientReply = "Understood. We will keep the current contract for this request and move on.";
      eventIndex += 1;
      pendingProposal = null;
      break;
    case "accept": {
      if (!pendingProposal || pendingProposal.id !== action.proposalId || pendingProposal.eventId !== event.id) {
        clientReply = "There is no matching open client offer to accept. Please propose specific terms or refer to the current offer.";
        break;
      }
      const validation = validateProposal(scenario, state, pendingProposal.change, true);
      if (!validation.project) throw new EngineHistoryError("The pending client offer is no longer valid.");
      project = acceptProject(validation.project, entry.turnId);
      clientReply = agreedReply(project);
      turnAgreement = agreement(entry, pendingProposal.change, "accepted", clientReply);
      eventIndex += 1;
      pendingProposal = null;
      break;
    }
    case "propose": {
      pendingProposal = null;
      const validation = validateProposal(scenario, state, action.change, false);
      if (!validation.project) {
        clientReply = validation.reason!;
        turnAgreement = agreement(entry, action.change, "rejected", clientReply);
        break;
      }
      if (action.change.feeDeltaCents > event.clientRules.maxAdditionalFeeCents) {
        const counterChange = { ...action.change, feeDeltaCents: event.clientRules.maxAdditionalFeeCents };
        const counter = validateProposal(scenario, state, counterChange, true);
        if (counter.project) {
          clientReply = `I cannot approve your proposed fee. I can offer ${usd(counterChange.feeDeltaCents)} extra for this scope, with delivery by day ${counter.project.deadlineDays}. Do you accept these terms?`;
          turnAgreement = agreement(entry, counterChange, "counteroffered", clientReply);
          pendingProposal = turnAgreement;
        } else {
          clientReply = "I cannot approve that additional fee. Please propose different terms or retain our current agreement.";
          turnAgreement = agreement(entry, action.change, "rejected", clientReply);
        }
        break;
      }
      project = acceptProject(validation.project, entry.turnId);
      clientReply = agreedReply(project);
      turnAgreement = agreement(entry, action.change, "accepted", clientReply);
      eventIndex += 1;
      break;
    }
  }

  const turn = negotiationTurnSchema.parse({ ...entry, action, clientReply: boundedReply(clientReply), agreement: turnAgreement });
  return { scenarioId: scenario.id, project, eventIndex, turns: [...state.turns, turn], pendingProposal };
}

export function replay(scenario: Scenario, inputs: readonly TrustedTurnInput[]): EngineSnapshot {
  return inputs.reduce((state, input) => processTurn(scenario, state, input), initialState(scenario));
}
