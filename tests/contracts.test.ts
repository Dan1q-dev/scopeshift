import { describe, expect, it } from "vitest";
import { websiteProjectScenario } from "@/data/scenarios/website-project";
import {
  initialContractSchema,
  negotiateRequestSchema,
  scenarioSchema,
  scopeChangeSchema,
  toPublicScenario,
  toScenarioSummary,
} from "@/types/scope";

const validRequest = {
  scenarioId: "web-project-01",
  history: [{ turnId: "turn-1", eventId: "booking-request", userMessage: "Could we agree on $400 extra and two more days?" }],
};

describe("scenario foundation", () => {
  it("keeps the agreed baseline and all three distinct events", () => {
    expect(websiteProjectScenario.initialContract).toMatchObject({ feeCents: 150_000, estimatedHours: 20, deadlineDays: 7 });
    expect(websiteProjectScenario.events.map((event) => event.id)).toEqual(["booking-request", "earlier-delivery", "scope-swap"]);
    expect(Object.isFrozen(websiteProjectScenario.initialContract)).toBe(true);
    expect(Object.isFrozen(websiteProjectScenario.initialContract.scopeItems)).toBe(true);
  });

  it("never includes client budgets or hidden rules in public data", () => {
    const publicScenario = toPublicScenario(websiteProjectScenario);
    expect(publicScenario.events[0]).toHaveProperty("clientMessage");
    const serialized = JSON.stringify(publicScenario);
    expect(serialized).not.toContain("clientRules");
    expect(serialized).not.toContain("maxAdditionalFeeCents");
    expect(serialized).not.toContain("evaluationRules");
    expect(serialized).not.toContain("Sarah can approve at most");
    expect(toScenarioSummary(websiteProjectScenario)).toMatchObject({ id: "web-project-01", initialFeeCents: 150_000 });
    expect(toScenarioSummary(websiteProjectScenario)).not.toHaveProperty("events");
  });

  it("rejects inconsistent baseline hours, fractional cents, and duplicate events", () => {
    expect(initialContractSchema.safeParse({ ...websiteProjectScenario.initialContract, estimatedHours: 26 }).success).toBe(false);
    expect(initialContractSchema.safeParse({ ...websiteProjectScenario.initialContract, feeCents: 150_000.5 }).success).toBe(false);
    expect(scenarioSchema.safeParse({ ...websiteProjectScenario, events: [websiteProjectScenario.events[0], websiteProjectScenario.events[0]] }).success).toBe(false);
  });
});

describe("untrusted negotiation history", () => {
  it("accepts text history with stable turn identifiers", () => {
    expect(negotiateRequestSchema.parse(validRequest)).toEqual(validRequest);
  });

  it("rejects duplicate turns instead of applying an agreement twice", () => {
    expect(negotiateRequestSchema.safeParse({ ...validRequest, history: [validRequest.history[0], validRequest.history[0]] }).success).toBe(false);
  });

  it("rejects browser-provided money, state, actions, and accepted agreements", () => {
    for (const extra of [{ totalFeeCents: 1 }, { project: {} }, { agreement: { status: "accepted" } }]) {
      expect(negotiateRequestSchema.safeParse({ ...validRequest, ...extra }).success).toBe(false);
    }
    expect(negotiateRequestSchema.safeParse({ ...validRequest, history: [{ ...validRequest.history[0], action: { kind: "accept" } }] }).success).toBe(false);
  });

  it("bounds free text and history size", () => {
    expect(negotiateRequestSchema.safeParse({ ...validRequest, history: [] }).success).toBe(false);
    expect(negotiateRequestSchema.safeParse({ ...validRequest, history: [{ ...validRequest.history[0], userMessage: "   " }] }).success).toBe(false);
    expect(negotiateRequestSchema.safeParse({ ...validRequest, history: [{ ...validRequest.history[0], userMessage: "x".repeat(2_001) }] }).success).toBe(false);
    expect(negotiateRequestSchema.safeParse({ ...validRequest, history: Array.from({ length: 51 }, (_, index) => ({ ...validRequest.history[0], turnId: `turn-${index}` })) }).success).toBe(false);
  });

  it("rejects an ambiguous add-and-remove mutation", () => {
    expect(scopeChangeSchema.safeParse({ feeDeltaCents: 0, deadlineDeltaDays: 0, addScopeItemIds: ["gallery"], removeScopeItemIds: ["gallery"] }).success).toBe(false);
  });
});
