import { describe, expect, it, vi } from "vitest";
import { websiteProjectScenario as scenario } from "@/data/scenarios/website-project";
import { negotiateResponseSchema, type EvaluationResult, type HistoryEntry } from "@/types/scope";
import { EngineHistoryError } from "./engine";
import { negotiateHistory } from "./negotiate";
import type { SimulationEvaluator } from "./evaluation-port";

function entry(turnId: string, eventId: string, userMessage: string): HistoryEntry {
  return { turnId, eventId, userMessage };
}

const paidBooking = entry("booking-paid", "booking-request", "I can add booking for an extra $400 and two more days. Would that work?");
const freeBooking = entry("booking-free", "booking-request", "I can add it for free with no change to the deadline.");
const rush = entry("rush", "earlier-delivery", "I can deliver two days earlier for an extra $150.");
const swap = entry("swap", "scope-swap", "Replace the portfolio gallery with testimonials at the same price and deadline.");

describe("negotiation driver integration", () => {
  it("runs a full three-event branch through the interpreter and deterministic engine", () => {
    const result = negotiateHistory(scenario, [paidBooking, rush, swap]);

    expect(result.completed).toBe(true);
    expect(result.currentEventId).toBeNull();
    expect(result.turns.map((turn) => turn.agreement?.status)).toEqual(["accepted", "accepted", "accepted"]);
    expect(result.project).toMatchObject({ totalFeeCents: 205_000, estimatedHours: 26, deadlineDays: 7, effectiveHourlyRateCents: 7_885 });
    expect(result.project.activeScopeItems.map((item) => item.id)).toContain("testimonials-section");
    expect(result.project.activeScopeItems.map((item) => item.id)).not.toContain("portfolio-gallery");
    expect(scenario.initialContract).toMatchObject({ feeCents: 150_000, estimatedHours: 20, deadlineDays: 7 });
  });

  it("retries identically and compares genuinely different paid and free outcomes", () => {
    const paid = negotiateHistory(scenario, [paidBooking]);
    const repeated = negotiateHistory(scenario, [paidBooking]);
    const free = negotiateHistory(scenario, [freeBooking]);

    expect(repeated).toEqual(paid);
    expect(paid.project).toMatchObject({ totalFeeCents: 190_000, estimatedHours: 26, deadlineDays: 9, effectiveHourlyRateCents: 7_308 });
    expect(free.project).toMatchObject({ totalFeeCents: 150_000, estimatedHours: 26, deadlineDays: 7, effectiveHourlyRateCents: 5_769 });
    expect(paid.project.acceptedAgreementIds).toEqual([paidBooking.turnId]);
  });

  it("preserves a prefix when replaying a later decision with a new turn ID", () => {
    const firstBranch = negotiateHistory(scenario, [paidBooking, rush]);
    const alternative = negotiateHistory(scenario, [paidBooking, entry("keep-date", "earlier-delivery", "No, I cannot take this on. Let us keep the original contract.")]);

    expect(alternative.turns[0]).toEqual(firstBranch.turns[0]);
    expect(alternative.project).toMatchObject({ totalFeeCents: 190_000, estimatedHours: 26, deadlineDays: 9 });
    expect(alternative.currentEventId).toBe("scope-swap");
  });

  it("rejects duplicate IDs and skipped, stale or post-completion events", () => {
    const question = entry("question", "booking-request", "Could you clarify the booking requirements?");
    expect(() => negotiateHistory(scenario, [question, question])).toThrow(EngineHistoryError);
    expect(() => negotiateHistory(scenario, [rush])).toThrow(EngineHistoryError);
    expect(() => negotiateHistory(scenario, [paidBooking, question])).toThrow(EngineHistoryError);
    expect(() => negotiateHistory(scenario, [paidBooking, rush, swap, entry("after-completion", "scope-swap", "What next?")])).toThrow(EngineHistoryError);
  });

  it("does not treat an unclear response as a confirmed amendment", () => {
    const result = negotiateHistory(scenario, [entry("ambiguous", "booking-request", "Sure.")]);

    expect(result.project).toMatchObject({ totalFeeCents: 150_000, estimatedHours: 20, deadlineDays: 7, acceptedAgreementIds: [] });
    expect(result.currentEventId).toBe("booking-request");
    expect(result.turns[0].agreement).toBeNull();
    expect(result.completed).toBe(false);
  });

  it("accepts a real counteroffer through text while a bare acceptance cannot create one", () => {
    const counterRequest = entry("high-price", "booking-request", "I can add booking for an extra $900 and two more days. Would that work?");
    const counter = negotiateHistory(scenario, [counterRequest]);
    const accepted = negotiateHistory(scenario, [counterRequest, entry("accept-counter", "booking-request", "I accept your offer.")]);
    const invented = negotiateHistory(scenario, [entry("accept-invented", "booking-request", "I accept your offer.")]);

    expect(counter.turns[0].agreement?.status).toBe("counteroffered");
    expect(counter.project.totalFeeCents).toBe(150_000);
    expect(accepted.turns[1].agreement?.status).toBe("accepted");
    expect(accepted.project).toMatchObject({ totalFeeCents: 190_000, estimatedHours: 26, deadlineDays: 9 });
    expect(invented.project.acceptedAgreementIds).toEqual([]);
    expect(invented.currentEventId).toBe("booking-request");
  });

  it("exposes a valid public response without inventing evaluation or leaking scenario rules", () => {
    const result = negotiateHistory(scenario, [paidBooking]);
    const serialized = JSON.stringify(result);

    expect(negotiateResponseSchema.safeParse(result).success).toBe(true);
    expect(result.evaluation.criteria.length).toBeGreaterThan(0);
    for (const privateField of ["clientRules", "maxAdditionalFeeCents", "evaluationRules", "maximumHoursPerDay"]) {
      expect(serialized).not.toContain(privateField);
    }
  });

  it("lets Albina evaluate the actual reconstructed branch through the typed port", () => {
    const evaluation: EvaluationResult = {
      criteria: [{
        category: "explicit_agreement",
        earnedPoints: 1,
        maxPoints: 1,
        evidence: [{ turnId: paidBooking.turnId, ruleId: "booking-documentation", observation: "A defined fee, scope and date were accepted." }],
        advice: "Retain the accepted amendment when recording the project.",
      }],
      strengths: ["Recorded an accepted amendment."],
      improvements: [],
    };
    const evaluate = vi.fn<SimulationEvaluator>(() => evaluation);
    const result = negotiateHistory(scenario, [paidBooking], evaluate);

    expect(evaluate).toHaveBeenCalledOnce();
    expect(evaluate).toHaveBeenCalledWith({ scenario, turns: result.turns, project: result.project, completed: false });
    expect(result.evaluation).toEqual(evaluation);
  });

  it("isolates contract state and recorded turns from a mutating evaluator", () => {
    const expected = negotiateHistory(scenario, [paidBooking]);
    const mutate: SimulationEvaluator = ({ project, turns }) => {
      project.totalFeeCents = 1;
      project.acceptedAgreementIds.push("invented-agreement");
      turns[0].clientReply = "Changed by an incorrectly implemented evaluator.";
      if (turns[0].agreement) turns[0].agreement.status = "rejected";
      return { criteria: [], strengths: [], improvements: [] };
    };

    const result = negotiateHistory(scenario, [paidBooking], mutate);

    expect(result.project).toEqual(expected.project);
    expect(result.turns).toEqual(expected.turns);
    expect(scenario.initialContract.feeCents).toBe(150_000);
  });

  it("rejects inconsistent evaluator scores before returning an invalid response", () => {
    const invalidEvaluator: SimulationEvaluator = () => ({
      criteria: [{
        category: "explicit_agreement",
        earnedPoints: 2,
        maxPoints: 1,
        evidence: [{ turnId: paidBooking.turnId, ruleId: "booking-documentation", observation: "Invalid scoring fixture." }],
        advice: "Use a score within the declared maximum.",
      }],
      strengths: [],
      improvements: [],
    });

    expect(() => negotiateHistory(scenario, [paidBooking], invalidEvaluator)).toThrow();
  });
});
