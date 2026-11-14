import { describe, expect, it } from "vitest";
import { websiteProjectScenario as scenario } from "@/data/scenarios/website-project";
import { EngineHistoryError, currentEvent, initialState, processTurn, replay, type TrustedTurnInput } from "./engine";
import type { NegotiationAction, ScopeChange } from "@/types/scope";

const change = (overrides: Partial<ScopeChange> = {}): ScopeChange => ({
  feeDeltaCents: 40_000,
  deadlineDeltaDays: 2,
  addScopeItemIds: ["consultation-booking"],
  removeScopeItemIds: [],
  ...overrides,
});
const input = (turnId: string, eventId: string, action: NegotiationAction): TrustedTurnInput => ({ turnId, eventId, userMessage: "Explicit terms supplied by the learner.", action });
const paidBooking = input("booking-1", "booking-request", { kind: "propose", change: change() });

describe("deterministic simulation engine", () => {
  it("applies the accepted paid change and preserves the original contract and prior snapshot", () => {
    const start = initialState(scenario);
    const state = processTurn(scenario, start, paidBooking);
    expect(state.project).toMatchObject({ totalFeeCents: 190_000, estimatedHours: 26, deadlineDays: 9, effectiveHourlyRateCents: 7_308, acceptedAgreementIds: ["booking-1"] });
    expect(currentEvent(scenario, state)?.id).toBe("earlier-delivery");
    expect(state.turns[0].agreement?.status).toBe("accepted");
    expect(start.project.totalFeeCents).toBe(150_000);
    expect(start.turns).toHaveLength(0);
    expect(scenario.initialContract).toMatchObject({ feeCents: 150_000, estimatedHours: 20, deadlineDays: 7 });
  });

  it("permits a feasible free addition without pretending it preserved the hourly rate", () => {
    const state = processTurn(scenario, initialState(scenario), input("free", "booking-request", { kind: "propose", change: change({ feeDeltaCents: 0, deadlineDeltaDays: 0 }) }));
    expect(state.project).toMatchObject({ totalFeeCents: 150_000, estimatedHours: 26, deadlineDays: 7, effectiveHourlyRateCents: 5_769 });
    expect(state.turns[0].agreement?.status).toBe("accepted");
  });

  it("leaves questions, ambiguous messages and declined changes unapplied", () => {
    const start = initialState(scenario);
    const questions = replay(scenario, [
      input("question", "booking-request", { kind: "clarify", question: "What does booking include?" }),
      input("ambiguous", "booking-request", { kind: "unresolved", reason: "No explicit proposal." }),
    ]);
    expect(questions.project).toEqual(start.project);
    expect(currentEvent(scenario, questions)?.id).toBe("booking-request");
    const declined = processTurn(scenario, questions, input("decline", "booking-request", { kind: "decline", reason: "We will retain the original scope." }));
    expect(declined.project).toEqual(start.project);
    expect(currentEvent(scenario, declined)?.id).toBe("earlier-delivery");
  });

  it("makes a genuine budget counteroffer and only changes the project after explicit acceptance", () => {
    const start = initialState(scenario);
    const counter = processTurn(scenario, start, input("expensive", "booking-request", { kind: "propose", change: change({ feeDeltaCents: 90_000 }) }));
    expect(counter.project).toEqual(start.project);
    expect(counter.pendingProposal?.change.feeDeltaCents).toBe(40_000);
    expect(counter.turns[0].agreement?.status).toBe("counteroffered");
    const wrong = processTurn(scenario, counter, input("wrong", "booking-request", { kind: "accept", proposalId: "invented" }));
    expect(wrong.project).toEqual(start.project);
    const accepted = processTurn(scenario, wrong, input("accept", "booking-request", { kind: "accept", proposalId: "expensive" }));
    expect(accepted.project.totalFeeCents).toBe(190_000);
    expect(accepted.project.acceptedAgreementIds).toEqual(["accept"]);
    expect(accepted.pendingProposal).toBeNull();
  });

  it("rejects impossible commitments without applying even an otherwise acceptable fee", () => {
    const booking = replay(scenario, [paidBooking]);
    const impossible = processTurn(scenario, booking, input("rush", "earlier-delivery", { kind: "propose", change: change({ feeDeltaCents: 15_000, deadlineDeltaDays: -4, addScopeItemIds: [] }) }));
    expect(impossible.project).toEqual(booking.project);
    expect(impossible.turns.at(-1)?.agreement?.status).toBe("rejected");
    expect(impossible.turns.at(-1)?.clientReply).toContain("not feasible");
    expect(currentEvent(scenario, impossible)?.id).toBe("earlier-delivery");
  });

  it("honors the scenario strategy whitelist rather than inventing a capacity failure", () => {
    const booking = processTurn(scenario, initialState(scenario), input("skip", "booking-request", { kind: "decline", reason: "Keep the original scope." }));
    const freeRush = processTurn(scenario, booking, input("rush", "earlier-delivery", { kind: "propose", change: change({ feeDeltaCents: 0, deadlineDeltaDays: -2, addScopeItemIds: [] }) }));
    expect(freeRush.turns.at(-1)?.agreement?.status).toBe("rejected");
    expect(freeRush.turns.at(-1)?.clientReply).toContain("type of change");
    expect(freeRush.turns.at(-1)?.clientReply).not.toContain("not feasible");
  });

  it("completes a paid rush and an equal-effort swap without charging for extra hours", () => {
    const state = replay(scenario, [
      paidBooking,
      input("rush", "earlier-delivery", { kind: "propose", change: change({ feeDeltaCents: 10_000, deadlineDeltaDays: -2, addScopeItemIds: [] }) }),
      input("swap", "scope-swap", { kind: "propose", change: change({ feeDeltaCents: 0, deadlineDeltaDays: 0, addScopeItemIds: ["testimonials-section"], removeScopeItemIds: ["portfolio-gallery"] }) }),
    ]);
    expect(state.project).toMatchObject({ totalFeeCents: 200_000, estimatedHours: 26, deadlineDays: 7 });
    expect(state.project.activeScopeItems.map((item) => item.id)).toContain("testimonials-section");
    expect(state.project.activeScopeItems.map((item) => item.id)).not.toContain("portfolio-gallery");
    expect(currentEvent(scenario, state)).toBeNull();
    expect(state.eventIndex).toBe(3);
    expect(() => processTurn(scenario, state, input("after", "scope-swap", { kind: "decline", reason: "Done." }))).toThrow(EngineHistoryError);
  });

  it("rejects wrong events, repeated turn IDs and future scope without mutating state", () => {
    const start = initialState(scenario);
    expect(() => processTurn(scenario, start, input("future-event", "scope-swap", { kind: "clarify", question: "Skip ahead?" }))).toThrow(EngineHistoryError);
    const question = input("same-id", "booking-request", { kind: "clarify", question: "Please clarify." });
    expect(() => replay(scenario, [question, question])).toThrow(EngineHistoryError);
    const future = processTurn(scenario, start, input("future-scope", "booking-request", { kind: "propose", change: change({ addScopeItemIds: ["testimonials-section"] }) }));
    expect(future.project).toEqual(start.project);
    expect(future.turns[0].agreement?.status).toBe("rejected");
    const missing = processTurn(scenario, start, input("missing-scope", "booking-request", { kind: "propose", change: change({ removeScopeItemIds: ["missing"] }) }));
    expect(missing.project).toEqual(start.project);
    expect(missing.turns[0].agreement?.status).toBe("rejected");
  });

  it("supports safe integer money, rejects malformed changes and does not accept monetary-only scope requests", () => {
    const start = initialState(scenario);
    expect(() => processTurn(scenario, start, input("fractional", "booking-request", { kind: "propose", change: change({ feeDeltaCents: 0.5 }) }))).toThrow(EngineHistoryError);
    const paymentOnly = processTurn(scenario, start, input("fee-only", "booking-request", { kind: "propose", change: change({ addScopeItemIds: [] }) }));
    expect(paymentOnly.project).toEqual(start.project);
    expect(paymentOnly.turns[0].agreement?.status).toBe("rejected");
  });

  it("replays exact outcomes and recomputes a different branch from the unchanged baseline", () => {
    expect(replay(scenario, [paidBooking])).toEqual(replay(scenario, [paidBooking]));
    const alternative = replay(scenario, [input("alternative", "booking-request", { kind: "propose", change: change({ feeDeltaCents: 0, deadlineDeltaDays: 0 }) })]);
    expect(alternative.project.totalFeeCents).toBe(150_000);
    expect(replay(scenario, [paidBooking]).project.totalFeeCents).toBe(190_000);
  });

  it("accepts a maximum-length turn ID without truncating or colliding agreement IDs", () => {
    const longId = "a".repeat(100);
    const state = processTurn(scenario, initialState(scenario), { ...paidBooking, turnId: longId });
    expect(state.turns[0].agreement?.id).toBe(longId);
    expect(state.project.acceptedAgreementIds).toEqual([longId]);
  });
});
