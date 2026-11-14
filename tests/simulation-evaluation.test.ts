import { describe, expect, it } from "vitest";
import { websiteProjectScenario as scenario } from "@/data/scenarios/website-project";
import { negotiateWithEvaluation as run } from "@/lib/evaluation/negotiate-with-evaluation";
import { evaluateSimulation } from "@/lib/evaluation/simulation-evaluator";
import type { HistoryEntry } from "@/types/scope";
import { initialState, processTurn } from "@/lib/simulation/engine";

const entry = (id: string, eventId: string, userMessage: string): HistoryEntry => ({ turnId: id, eventId, userMessage });
const booking = entry("paid", "booking-request", "I can add booking for an extra $400 and two more days. Would that work?");
const rush = entry("rush", "earlier-delivery", "I can deliver two days earlier for an extra $150.");
const swap = entry("swap", "scope-swap", "Replace the portfolio gallery with testimonials at the same price and deadline.");

describe("real engine with evidence evaluator", () => {
  it("completes a branch, cites actual turns and preserves deterministic retry", () => {
    const result = run(scenario, [booking, rush, swap]);
    expect(result.completed).toBe(true);
    expect(result.project).toMatchObject({ totalFeeCents: 205000, estimatedHours: 26, deadlineDays: 7 });
    expect(result.evaluation.criteria.reduce((sum, criterion) => sum + criterion.earnedPoints, 0)).toBe(9);
    expect(new Set(result.evaluation.criteria.map(criterion => criterion.category)).size).toBe(result.evaluation.criteria.length);
    for (const criterion of result.evaluation.criteria) {
      for (const evidence of criterion.evidence) {
        const turn = result.turns.find(item => item.turnId === evidence.turnId)!;
        const event = scenario.events.find(item => item.id === turn.eventId)!;
        expect(event.clientRules.evaluationRules.some(rule => rule.id === evidence.ruleId && rule.category === criterion.category)).toBe(true);
        expect(evidence.observation).toContain(turn.userMessage);
      }
    }
    expect(result.evaluation.criteria.every(c => c.evidence.every(e => result.turns.some(t => t.turnId === e.turnId)))).toBe(true);
    expect(result.evaluation.strengths.join(" ")).toContain("equal-effort");
    expect(run(scenario, [booking, rush, swap])).toEqual(result);
  });
  it("does not penalize free work or make up an economic judgment score", () => {
    const result = run(scenario, [entry("free", "booking-request", "I can add it for free with no change to the deadline.")]);
    expect(result.project).toMatchObject({ totalFeeCents: 150000, estimatedHours: 26, effectiveHourlyRateCents: 5769 });
    expect(result.evaluation.criteria.some(c => c.category === "economic_decision")).toBe(false);
    expect(result.evaluation.improvements.join(" ")).toContain("$57.69/hour");
  });
  it("counteroffer remains unchanged until accepted, then applies once", () => {
    const expensive = entry("expensive", "booking-request", "I can add booking for an extra $900 and two more days.");
    const pending = run(scenario, [expensive]);
    expect(pending.turns[0].agreement?.status).toBe("counteroffered");
    expect(pending.evaluation.criteria).toEqual([]);
    expect(pending.project.totalFeeCents).toBe(150000);
    const accepted = run(scenario, [expensive, entry("accept", "booking-request", "I accept your offer.")]);
    expect(accepted.project.acceptedAgreementIds).toEqual(["accept"]);
    expect(accepted.project.totalFeeCents).toBe(190000);
    expect(() => run(scenario, [expensive, expensive])).toThrow();
  });
  it("an impossible rush preserves state and does not become a learner failure", () => {
    const result = run(scenario, [booking, entry("bad-rush", "earlier-delivery", "I can deliver by day 5 for an extra $150.")]);
    expect(result.turns[1].agreement?.status).toBe("rejected");
    expect(result.project.deadlineDays).toBe(9);
    expect(result.evaluation.criteria.every(c => c.evidence[0].turnId === "paid")).toBe(true);
  });
  it("decline is a valid no-change outcome with unassessed scores", () => {
    const result = run(scenario, [entry("decline", "booking-request", "I decline this request.")]);
    expect(result.project.totalFeeCents).toBe(150000);
    expect(result.currentEventId).toBe("earlier-delivery");
    expect(result.evaluation.criteria).toEqual([]);
  });
  it("does not award points for absent scenario rules or repeated inquiries", () => {
    const withoutCapacity = { ...scenario, events: scenario.events.map(event => ({ ...event,
      clientRules: { ...event.clientRules, evaluationRules: event.clientRules.evaluationRules.filter(rule => rule.id !== "booking-capacity") },
    })) };
    expect(run(withoutCapacity, [booking]).evaluation.criteria.some(criterion => criterion.category === "feasibility")).toBe(false);
    const repeated = run(scenario, [entry("q1", "booking-request", "Which fields are required?"), entry("q2", "booking-request", "Which fields are required?")]);
    expect(repeated.evaluation.criteria).toHaveLength(1);
    expect(repeated.evaluation.criteria[0]).toMatchObject({ earnedPoints: 1, maxPoints: 1 });
  });
  it("keeps maximum-length question evidence within the HTTP schema limits", () => {
    const message = "Which fields are required? ".padEnd(2000, "x");
    const result = run(scenario, [entry("long-question", "booking-request", message)]);
    expect(result.evaluation.criteria).toHaveLength(1);
    expect(result.evaluation.criteria[0].evidence[0].observation).toContain(message);
    expect(result.evaluation.criteria[0].evidence[0].observation.length).toBeLessThanOrEqual(4000);
  });
  it("recognizes explicit unchanged-fee wording in a verified equal-effort exchange", () => {
    const result = run(scenario, [booking, rush, swap]);
    const turns = result.turns.map(turn => turn.turnId === "swap" ? {
      ...turn, userMessage: "Let's exchange the four-hour portfolio gallery for the four-hour testimonials section. Keep the fee and delivery day unchanged.",
    } : turn);
    const evaluation = evaluateSimulation({ scenario, turns, project: result.project, completed: true });
    expect(evaluation.criteria.find(criterion => criterion.category === "economic_decision")).toMatchObject({ earnedPoints: 1, maxPoints: 1 });
    expect(evaluation.criteria.flatMap(criterion => criterion.evidence).find(evidence => evidence.ruleId === "swap-economics")?.observation).toContain("Keep the fee and delivery day unchanged");
  });
  it.each([
    ["swap-two", "I can add booking, but only if we remove two other features.", "unresolved"],
    ["fields", "Which exact fields do you need in the booking form? Does a submission reserve a place, or will you confirm availability manually?", "clarify"],
    ["included", "This change is already included in our contract. Why are we discussing an extra fee?", "clarify"],
    ["ambiguous", "Sure.", "unresolved"],
  ])("safely handles %s without mutating economics", (id, message, kind) => {
    const result = run(scenario, [entry(id, "booking-request", message)]);
    expect(result.turns[0].action.kind).toBe(kind);
    expect(result.project).toMatchObject({ totalFeeCents: 150000, estimatedHours: 20, deadlineDays: 7, acceptedAgreementIds: [] });
  });
  it("rejects tampered evidence or project rather than awarding fabricated points", () => {
    const result = run(scenario, [booking]);
    expect(() => evaluateSimulation({ scenario, turns: result.turns, project: { ...result.project, totalFeeCents: 1 }, completed: false })).toThrow("Unverified");
    expect(() => evaluateSimulation({ scenario, turns: [{ ...result.turns[0], clientReply: "Invented acceptance" }], project: result.project, completed: false })).toThrow("Unverified");
  });
  it("handles two explicitly named removals in one scope exchange", () => {
    const result = run(scenario, [entry("two-named", "booking-request", "Replace contact form and portfolio gallery with booking at the same price and deadline.")]);
    expect(result.turns[0].action.kind).toBe("propose");
    expect(result.turns[0].agreement?.status).toBe("accepted");
    expect(result.project).toMatchObject({ totalFeeCents: 150000, estimatedHours: 18, deadlineDays: 7 });
    expect(result.project.activeScopeItems.map(item => item.id)).toEqual(["core-pages", "consultation-booking"]);
    expect(result.evaluation.criteria).toHaveLength(3);
  });
  it("supports the two-item swap in the engine when a trusted interpreter supplies exact IDs", () => {
    const state = processTurn(scenario, initialState(scenario), {
      ...entry("two-trusted", "booking-request", "Replace contact form and portfolio gallery with booking at the same price and deadline."),
      action: { kind: "propose", change: { feeDeltaCents: 0, deadlineDeltaDays: 0,
        addScopeItemIds: ["consultation-booking"], removeScopeItemIds: ["contact-form", "portfolio-gallery"] } },
    });
    expect(state.project).toMatchObject({ totalFeeCents: 150000, estimatedHours: 18, deadlineDays: 7 });
    expect(state.project.activeScopeItems.map(i => i.id)).toEqual(["core-pages", "consultation-booking"]);
  });
  it("answers booking-field clarification with explicit fields", () => {
    const result = run(scenario, [entry("exact-fields", "booking-request", "Which exact fields should be in the booking form?")]);
    expect(result.turns[0].clientReply).toMatch(/name/i);
    expect(result.turns[0].clientReply).toMatch(/email/i);
    expect(result.turns[0].clientReply).toContain("still need confirmation");
    expect(result.project.acceptedAgreementIds).toEqual([]);
  });
  it("explains included contact form versus additional booking", () => {
    const result = run(scenario, [entry("already-included", "booking-request", "This change is already included in our contract. Why are we discussing an extra fee?")]);
    expect(result.turns[0].clientReply).toMatch(/contact form/i);
    expect(result.turns[0].clientReply).toMatch(/already included|original contract/i);
    expect(result.turns[0].clientReply).toContain("No appointment scheduling");
    expect(result.turns[0].clientReply).toContain("6 additional hours");
    expect(result.project).toMatchObject({ totalFeeCents: 150000, estimatedHours: 20 });
  });
  it("answers reservation questions without inventing unspecified booking behavior", () => {
    const result = run(scenario, [entry("reservation", "booking-request", "Does submitting the form reserve a place, or will you confirm availability manually?")]);
    expect(result.turns[0].clientReply).toContain("not yet agreed");
    expect(result.turns[0].clientReply).toContain("where available slots come from");
    expect(result.turns[0].agreement).toBeNull();
    expect(result.project).toMatchObject({ totalFeeCents: 150000, estimatedHours: 20, deadlineDays: 7 });
  });
  it.each([
    "Replace contact form and an unknown task with booking at the same price and deadline.",
    "Replace booking with contact form and portfolio gallery at the same price and deadline.",
    "Replace contact form or portfolio gallery with booking at the same price and deadline.",
  ])("does not silently remove a partial or reversed list: %s", (message) => {
    const result = run(scenario, [entry("invalid-swap", "booking-request", message)]);
    expect(result.turns[0].action.kind).toBe("unresolved");
    expect(result.project.acceptedAgreementIds).toEqual([]);
    expect(result.project.estimatedHours).toBe(20);
    expect(result.turns[0].clientReply).toContain("Current active scope");
  });
});
