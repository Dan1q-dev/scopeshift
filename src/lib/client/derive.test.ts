import { describe, expect, it } from "vitest";
import { agreementsOf, evidenceParts, readableIds } from "@/lib/client/derive";
import type { Agreement, NegotiateResponse, NegotiationTurn, PublicScenario } from "@/types/scope";

const agreement = (id: string, eventId: string, status: Agreement["status"]) => ({ id, eventId, status }) as Agreement;
const turn = (turnId: string, value?: Agreement) => ({ turnId, agreement: value }) as unknown as NegotiationTurn;
const responseWith = (turns: NegotiationTurn[]) => ({ turns }) as NegotiateResponse;

const scenario = {
  initialContract: { scopeItems: [{ id: "portfolio-gallery", title: "Portfolio gallery" }] },
  events: [
    { id: "booking-request", title: "An extra booking feature", availableScopeItems: [{ id: "consultation-booking", title: "Consultation booking" }] },
    { id: "scope-swap", title: "Replacing part of the agreed work", availableScopeItems: [] },
  ],
} as unknown as PublicScenario;

describe("agreementsOf", () => {
  it("returns no decisions without a response", () => {
    expect(agreementsOf(null)).toEqual([]);
  });

  it("drops a counteroffer replaced by a later decision on the same request", () => {
    const response = responseWith([
      turn("t1", agreement("a1", "booking-request", "counteroffered")),
      turn("t2", agreement("a2", "booking-request", "accepted")),
      turn("t3"),
    ]);
    expect(agreementsOf(response).map((item) => item.id)).toEqual(["a2"]);
  });

  it("keeps a pending counteroffer and decisions on other requests", () => {
    const response = responseWith([
      turn("t1", agreement("a1", "booking-request", "accepted")),
      turn("t2", agreement("a2", "scope-swap", "counteroffered")),
    ]);
    expect(agreementsOf(response).map((item) => item.id)).toEqual(["a1", "a2"]);
  });
});

describe("evidenceParts", () => {
  it("splits an observation into action, rule and verified result", () => {
    expect(evidenceParts("Action: I can add it. Rule: Propose a defined addition. Verified: Accepted scope amendment.", "I can add it.")).toEqual({
      action: "I can add it.",
      rule: "Propose a defined addition.",
      verified: "Accepted scope amendment.",
    });
  });

  it("keeps the learner message whole when it contains the separator words", () => {
    const message = "My Rule: fees first. Verified: yes?";
    expect(evidenceParts(`Action: ${message} Rule: Ask a question. Verified: Asked a question.`, message)).toEqual({
      action: message,
      rule: "Ask a question.",
      verified: "Asked a question.",
    });
  });

  it("splits without a known learner message", () => {
    expect(evidenceParts("Action: Sure. Rule: State terms. Verified: No terms.")).toEqual({ action: "Sure.", rule: "State terms.", verified: "No terms." });
  });

  it("returns null for any other wording", () => {
    expect(evidenceParts("The client accepted the proposal.", "Sure.")).toBeNull();
    expect(evidenceParts("Action: Sure. Rule: State terms.", "Sure.")).toBeNull();
  });
});

describe("readableIds", () => {
  const response = responseWith([turn("t1", agreement("d5364d14-eeba-45b4-aa12-ce7b8cf546a9", "booking-request", "accepted"))]);

  it("replaces an agreement ID with the request title", () => {
    expect(readableIds("Agreement d5364d14-eeba-45b4-aa12-ce7b8cf546a9 is recorded once.", scenario, response)).toBe('Agreement "An extra booking feature" is recorded once.');
  });

  it("replaces scope item IDs with their titles", () => {
    expect(readableIds("added [consultation-booking], removed [portfolio-gallery]", scenario, response)).toBe("added [Consultation booking], removed [Portfolio gallery]");
  });

  it("leaves text without known IDs unchanged", () => {
    expect(readableIds("No deliverables removed.", scenario, response)).toBe("No deliverables removed.");
  });
});
