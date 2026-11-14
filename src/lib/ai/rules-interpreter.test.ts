import { describe, expect, it } from "vitest";
import { websiteProjectScenario } from "@/data/scenarios/website-project";
import type { Agreement, ProjectState, Scenario } from "@/types/scope";
import { INTERPRETER_VERSION, interpretMessage } from "./rules-interpreter";

const scenario = websiteProjectScenario;
const project: ProjectState = {
  scenarioId: scenario.id,
  totalFeeCents: 150_000,
  estimatedHours: 20,
  deadlineDays: 7,
  effectiveHourlyRateCents: 7_500,
  activeScopeItems: [...scenario.initialContract.scopeItems],
  acceptedAgreementIds: [],
};
function interpret(message: string, event: Scenario["events"][number] = scenario.events[0], pendingProposal?: Agreement) {
  return interpretMessage({ message, scenario, event, project, pendingProposal });
}

describe("rules-v1 English interpreter", () => {
  it("identifies its deterministic implementation", () => {
    expect(INTERPRETER_VERSION).toBe("rules-v1");
  });

  it("extracts a paid booking offer with an explicit deadline extension", () => {
    expect(interpret("I can add booking for an extra $400 and two more days. Would that work?")).toEqual({
      kind: "propose", change: { feeDeltaCents: 40_000, deadlineDeltaDays: 2, addScopeItemIds: ["consultation-booking"], removeScopeItemIds: [] },
    });
  });

  it("extracts free additional work with unchanged terms", () => {
    for (const message of ["I can add it for free with no change to the deadline", "I can do that for free"]) {
      expect(interpret(message)).toMatchObject({ kind: "propose", change: { feeDeltaCents: 0, deadlineDeltaDays: 0, addScopeItemIds: ["consultation-booking"] } });
    }
  });

  it("preserves cents exactly and accepts a missing date only as unchanged", () => {
    expect(interpret("I can add booking for an extra $399.95")).toMatchObject({ kind: "propose", change: { feeDeltaCents: 39_995, deadlineDeltaDays: 0 } });
  });

  it("treats requirements and budget questions as clarification", () => {
    for (const message of ["Could you clarify which fields booking needs?", "Would $400 cover this request?", "What is your budget?", "Should we keep the original contract?", "Can we keep the current scope?"]) {
      expect(interpret(message)).toMatchObject({ kind: "clarify", question: message });
    }
  });

  it("keeps a genuine refusal separate from a counteroffer", () => {
    expect(interpret("No, I cannot take this on. Let us keep the original contract.")).toMatchObject({ kind: "decline" });
    expect(interpret("I cannot do that, but I can add booking for $400.")).toMatchObject({ kind: "unresolved" });
    expect(interpret('The client said "keep the original contract".')).toMatchObject({ kind: "unresolved" });
  });

  it("can exchange a named active item at unchanged price and date", () => {
    expect(interpret("Replace the portfolio gallery with testimonials at the same price and deadline", scenario.events[2])).toEqual({
      kind: "propose", change: { feeDeltaCents: 0, deadlineDeltaDays: 0, addScopeItemIds: ["testimonials-section"], removeScopeItemIds: ["portfolio-gallery"] },
    });
    expect(interpret("Replace testimonials with the portfolio gallery at the same price and deadline", scenario.events[2])).toMatchObject({ kind: "unresolved" });
    expect(interpret("Replace the portfolio gallery with testimonials and a mobile app at the same price and deadline", scenario.events[2])).toMatchObject({ kind: "unresolved" });
    expect(interpret("Replace the portfolio gallery and homepage with testimonials at the same price and deadline", scenario.events[2])).toMatchObject({ kind: "unresolved" });
  });

  it("extracts a rush fee and absolute or relative delivery dates", () => {
    for (const message of ["I can deliver two days earlier for an extra $150", "I can deliver by day 5 for an extra $150"]) {
      expect(interpret(message, scenario.events[1])).toEqual({
        kind: "propose", change: { feeDeltaCents: 15_000, deadlineDeltaDays: -2, addScopeItemIds: [], removeScopeItemIds: [] },
      });
    }
  });

  it("accepts only a real pending proposal with explicit acceptance", () => {
    const pending: Agreement = { id: "proposal-1", eventId: "booking-request", sourceTurnId: "turn-1", status: "counteroffered", explanation: "Offer", change: { feeDeltaCents: 40_000, deadlineDeltaDays: 2, addScopeItemIds: ["consultation-booking"], removeScopeItemIds: [] } };
    expect(interpret("I accept your offer", undefined, pending)).toEqual({ kind: "accept", proposalId: "proposal-1" });
    expect(interpret("I accept your offer")).toMatchObject({ kind: "unresolved" });
    expect(interpret("Sure", undefined, pending)).toMatchObject({ kind: "unresolved" });
    expect(interpret("I accept your offer", undefined, { ...pending, status: "accepted" })).toMatchObject({ kind: "unresolved" });
  });

  it("does not silently resolve contradictory, conditional or negated terms", () => {
    for (const message of [
      "I can add booking for $400 or $350",
      "I can add booking for $400 for free",
      "I can add booking for not an extra $400",
      "I can add booking for $400 and two more days, with the same deadline",
      "I can add booking for free if my manager agrees",
      "I can not add booking for free",
      "I can add booking for $400 and deliver tomorrow",
      "I can add booking for $400.005",
      "I can add booking for $400.99.99",
      "I can add booking for $-400",
    ]) expect(interpret(message), message).toMatchObject({ kind: "unresolved" });
  });

  it("does not convert total prices, quoted budgets or undefined scope into amendments", () => {
    for (const message of [
      "I can add booking for a total of $1900",
      "I can add booking for $1900 total",
      "I can add booking if your budget is $400",
      "I can add booking and calendar sync for $400",
      "I can add booking with payments for $400",
      "I can add booking with a mobile application for $400",
      "I can add an astronaut for $400",
      "I can add booking and an astronaut for $400",
      "I can add testimonials for $400",
      "I can do that",
      "You said I can add booking for $400",
      "Imagine I can add booking for $400",
      'The client said "I can add booking for $400"',
      "I can add booking for $400/hour",
      "I can add booking for $400 per hour",
      "I can add booking for up to $400",
      "I can add booking for less than $400",
      "I can add booking for $400 and a photo editor",
      "I can add booking for $400 and photo editing",
      "I can add booking for $400 and two more days and photo editing",
      "I can add booking for $400 and two photo editors",
      "I can add booking for $400 and I will build a photo editor",
    ]) expect(interpret(message), message).toMatchObject({ kind: "unresolved" });
  });
});
