import type { Agreement, NegotiateResponse, ProjectState, PublicScenario, ScopeItem } from "@/types/scope";

/** Project state before any negotiation. Mirrors the documented rate formula from docs/API_CONTRACT.md. */
export function initialProject(scenario: PublicScenario): ProjectState {
  const contract = scenario.initialContract;
  return {
    scenarioId: scenario.id,
    totalFeeCents: contract.feeCents,
    estimatedHours: contract.estimatedHours,
    deadlineDays: contract.deadlineDays,
    effectiveHourlyRateCents: Math.round(contract.feeCents / contract.estimatedHours),
    activeScopeItems: [...contract.scopeItems],
    acceptedAgreementIds: [],
  };
}

/**
 * Decisions to list for an attempt. A client counteroffer that a later decision on the same request
 * replaced is left out, so one request is not listed twice. The chat keeps the full history.
 */
export function agreementsOf(response: NegotiateResponse | null): Agreement[] {
  const all = response ? response.turns.flatMap((turn) => (turn.agreement ? [turn.agreement] : [])) : [];
  return all.filter((agreement, index) => agreement.status !== "counteroffered" || !all.slice(index + 1).some((later) => later.eventId === agreement.eventId));
}

export type ScopeDiffEntry = { item: ScopeItem; state: "original" | "added" | "removed" };

/** Compares the original contract scope with the currently agreed scope. */
export function scopeDiff(scenario: PublicScenario, project: ProjectState): ScopeDiffEntry[] {
  const activeIds = new Set(project.activeScopeItems.map((item) => item.id));
  const originalIds = new Set(scenario.initialContract.scopeItems.map((item) => item.id));
  return [
    ...scenario.initialContract.scopeItems.map((item): ScopeDiffEntry => ({ item, state: activeIds.has(item.id) ? "original" : "removed" })),
    ...project.activeScopeItems.filter((item) => !originalIds.has(item.id)).map((item): ScopeDiffEntry => ({ item, state: "added" })),
  ];
}

export function findScopeItem(scenario: PublicScenario, id: string): ScopeItem | undefined {
  return [...scenario.initialContract.scopeItems, ...scenario.events.flatMap((event) => event.availableScopeItems)].find((item) => item.id === id);
}
