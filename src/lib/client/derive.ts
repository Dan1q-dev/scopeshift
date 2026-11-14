import type { Agreement, NegotiateResponse, NegotiationTurn, ProjectState, PublicScenario, ScopeItem } from "@/types/scope";

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

export type EvidenceParts = { action: string; rule: string; verified: string };

/**
 * Splits an evaluator observation written as "Action: ... Rule: ... Verified: ..." into its parts.
 * The learner's own message, when known, anchors the split so its wording cannot shift the boundaries.
 * Any other wording returns null and is shown as plain text.
 */
export function evidenceParts(observation: string, userMessage?: string): EvidenceParts | null {
  const prefix = `Action: ${userMessage} Rule: `;
  if (userMessage !== undefined) {
    if (!observation.startsWith(prefix)) return null;
    const rest = /^([\s\S]*?) Verified: ([\s\S]*)$/.exec(observation.slice(prefix.length));
    return rest ? { action: userMessage, rule: rest[1], verified: rest[2] } : null;
  }
  const match = /^Action: ([\s\S]*?) Rule: ([\s\S]*?) Verified: ([\s\S]*)$/.exec(observation);
  return match ? { action: match[1], rule: match[2], verified: match[3] } : null;
}

/** Presents the old empty-removal wording only when its accepted turn confirms it. */
export function normalizeLegacyScopeEvidence(verified: string, turn?: NegotiationTurn): string {
  const agreement = turn?.agreement;
  if (!turn || !agreement || agreement.status !== "accepted" || agreement.sourceTurnId !== turn.turnId
    || agreement.eventId !== turn.eventId || agreement.change.removeScopeItemIds.length) return verified;
  const match = /^Accepted catalog amendment: added \[([a-zA-Z0-9_-]+(?:, [a-zA-Z0-9_-]+)*)\], removed \[\]\.$/.exec(verified);
  if (!match) return verified;
  const addedIds = match[1].split(", ");
  if (addedIds.length !== agreement.change.addScopeItemIds.length
    || addedIds.some((id, index) => id !== agreement.change.addScopeItemIds[index])) return verified;
  return `Accepted scope amendment. Added: ${addedIds.join(", ")}. No deliverables removed.`;
}

/** Replaces internal agreement and scope item IDs in evaluator text with the names shown elsewhere in the UI. */
export function readableIds(text: string, scenario: PublicScenario, response: NegotiateResponse): string {
  const eventTitle = (id: string) => scenario.events.find((event) => event.id === id)?.title ?? id;
  const names = new Map<string, string>();
  for (const turn of response.turns) if (turn.agreement) names.set(turn.agreement.id, `"${eventTitle(turn.agreement.eventId)}"`);
  for (const item of [...scenario.initialContract.scopeItems, ...scenario.events.flatMap((event) => event.availableScopeItems)]) names.set(item.id, item.title);
  if (!names.size) return text;
  const ids = [...names.keys()].sort((left, right) => right.length - left.length)
    .map((id) => id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const tokens = new RegExp(`(?<![\\p{L}\\p{N}_-])(?:${ids.join("|")})(?![\\p{L}\\p{N}_-])`, "gu");
  // A single pass preserves unknown IDs and does not reprocess replacement names.
  return text.replace(tokens, (id) => names.get(id) ?? id);
}

export function findScopeItem(scenario: PublicScenario, id: string): ScopeItem | undefined {
  return [...scenario.initialContract.scopeItems, ...scenario.events.flatMap((event) => event.availableScopeItems)].find((item) => item.id === id);
}
