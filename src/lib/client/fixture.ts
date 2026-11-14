// DEVELOPMENT FIXTURE - NOT THE PRODUCT ENGINE.
// Used only while POST /api/negotiate answers 501 NOT_IMPLEMENTED, so the UI can be built
// against the shared contract. It is a keyword script, not AI and not the simulation engine.
// The interface shows a visible "development fixture" banner whenever this code produced the data.
// Remove this file once the backend is integrated.
import { ScopeShiftApiError } from "@/lib/client/api";
import { initialProject } from "@/lib/client/derive";
import type { Agreement, NegotiateRequest, NegotiateResponse, NegotiationAction, NegotiationTurn, PublicScenario, ScopeChange, ScopeItem } from "@/types/scope";

type PublicEvent = PublicScenario["events"][number];
const FIXTURE_FEE_LIMIT_CENTS = 40_000; // arbitrary fixture threshold, not a scenario rule

function parseFeeCents(text: string) {
  const match = text.match(/\$\s?([\d,]+(?:\.\d{1,2})?)/);
  return match ? Math.round(Number(match[1].replace(/,/g, "")) * 100) : null;
}

function parseDayDelta(text: string) {
  const match = text.match(/(\d+)\s+(?:more |extra |additional )?days?/);
  if (!match) return 0;
  return /earlier|sooner|faster/.test(text) ? -Number(match[1]) : Number(match[1]);
}

function removedIds(text: string, active: readonly ScopeItem[]) {
  if (!/instead|swap|replace|remove|drop/.test(text)) return [];
  return active.filter((item) => text.includes(item.title.toLowerCase().split(" ").at(-1) ?? item.title.toLowerCase())).map((item) => item.id);
}

function interpret(message: string, event: PublicEvent, active: readonly ScopeItem[]) {
  const text = message.toLowerCase();
  const feeCents = parseFeeCents(text);
  const change: ScopeChange = {
    feeDeltaCents: feeCents ?? 0,
    deadlineDeltaDays: parseDayDelta(text),
    addScopeItemIds: event.availableScopeItems.map((item) => item.id),
    removeScopeItemIds: removedIds(text, active),
  };
  if (feeCents !== null) {
    const ok = feeCents <= FIXTURE_FEE_LIMIT_CENTS;
    return { action: { kind: "propose", change } as NegotiationAction, change, status: ok ? "accepted" as const : "rejected" as const, closes: ok,
      reply: ok ? "That works for me. Let's go ahead on those terms." : "That is more than I can approve for this change. Could you suggest something lower?" };
  }
  if (/\b(yes|sure|ok|okay|no problem|happy to|will do|i agree|deal)\b/.test(text)) {
    return { action: { kind: "propose", change } as NegotiationAction, change, status: "accepted" as const, closes: true,
      reply: "Great, thank you. Let's do that." };
  }
  if (/\b(no|can't|cannot|won't|decline|unable|not able|keep the)\b/.test(text)) {
    return { action: { kind: "decline", reason: message } as NegotiationAction, change: null, status: null, closes: true,
      reply: "Understood. We will keep the contract as it is." };
  }
  if (text.includes("?")) {
    return { action: { kind: "clarify", question: message } as NegotiationAction, change: null, status: null, closes: false,
      reply: event.availableScopeItems[0]?.description ?? "Nothing else changes on my side. What would you propose?" };
  }
  return { action: { kind: "unresolved", reason: "The fixture could not read a clear proposal." } as NegotiationAction, change: null, status: null, closes: false,
    reply: "I am not sure what you are proposing. Could you state the price, the date, and what is included?" };
}

export function fixtureNegotiate(scenario: PublicScenario, request: NegotiateRequest): NegotiateResponse {
  const project = initialProject(scenario);
  const catalog = new Map(scenario.events.flatMap((event) => event.availableScopeItems).map((item) => [item.id, item]));
  const turns: NegotiationTurn[] = [];
  let eventIndex = 0;

  for (const entry of request.history) {
    const event = scenario.events[eventIndex];
    if (!event || event.id !== entry.eventId) throw new ScopeShiftApiError("INVALID_HISTORY", "History does not match the scenario order.", 400);
    const result = interpret(entry.userMessage, event, project.activeScopeItems);
    let agreement: Agreement | null = null;
    if (result.change && result.status) {
      const remaining = project.activeScopeItems.filter((item) => !result.change.removeScopeItemIds.includes(item.id));
      const additions = result.change.addScopeItemIds.flatMap((id) => (catalog.has(id) && !remaining.some((item) => item.id === id) ? [catalog.get(id)!] : []));
      const nextScope = [...remaining, ...additions];
      const feasible = nextScope.length > 0 && project.deadlineDays + result.change.deadlineDeltaDays >= 1;
      const status = result.status === "accepted" && !feasible ? "rejected" : result.status;
      agreement = { id: `agr-${entry.turnId}`, eventId: event.id, sourceTurnId: entry.turnId, status, change: result.change,
        explanation: status === "accepted" ? "Fixture: the client accepted this proposal." : "Fixture: the client did not accept this proposal." };
      if (status === "accepted") {
        project.totalFeeCents += result.change.feeDeltaCents;
        project.deadlineDays += result.change.deadlineDeltaDays;
        project.activeScopeItems = nextScope;
        project.estimatedHours = nextScope.reduce((sum, item) => sum + item.estimatedHours, 0);
        project.effectiveHourlyRateCents = Math.round(project.totalFeeCents / project.estimatedHours);
        project.acceptedAgreementIds.push(agreement.id);
      }
      if (status !== "accepted") result.closes = false;
    }
    turns.push({ turnId: entry.turnId, eventId: event.id, userMessage: entry.userMessage, action: result.action, clientReply: result.reply, agreement });
    if (result.closes) eventIndex += 1;
  }

  return {
    scenarioId: scenario.id,
    turns,
    project,
    evaluation: { criteria: [], strengths: [], improvements: [] },
    currentEventId: scenario.events[eventIndex]?.id ?? null,
    completed: eventIndex >= scenario.events.length,
  };
}
