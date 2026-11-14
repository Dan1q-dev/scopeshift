import { expect, test, type APIRequestContext } from "@playwright/test";
import type { HistoryEntry, NegotiateResponse } from "../../src/types/scope";

const entry = (turnId: string, eventId: string, userMessage: string): HistoryEntry => ({ turnId, eventId, userMessage });
const paid = entry("e2e-paid", "booking-request", "I can add booking for an extra $400 and two more days.");
const free = entry("e2e-free", "booking-request", "I can add it for free with no change to the deadline.");
const rush = entry("e2e-rush", "earlier-delivery", "I can deliver two days earlier for an extra $150.");
const swap = entry("e2e-swap", "scope-swap", "Replace the portfolio gallery with testimonials at the same price and deadline.");
async function negotiate(request: APIRequestContext, history: HistoryEntry[]): Promise<NegotiateResponse> {
  const response = await request.post("/api/negotiate", { data: { scenarioId: "web-project-01", history } });
  expect(response.status()).toBe(200);
  expect(response.headers()["x-scopeshift-evaluation"]).toBe("evidence-v2");
  return response.json();
}

test("HTTP paid/free branches have real, distinct economics and evidence", async ({ request }) => {
  const p = await negotiate(request, [paid]);
  const f = await negotiate(request, [free]);
  expect(p.project).toMatchObject({ totalFeeCents: 190000, estimatedHours: 26, deadlineDays: 9, effectiveHourlyRateCents: 7308 });
  expect(f.project).toMatchObject({ totalFeeCents: 150000, estimatedHours: 26, deadlineDays: 7, effectiveHourlyRateCents: 5769 });
  for (const result of [p, f]) {
    expect(result.evaluation.criteria.length).toBeGreaterThan(0);
    for (const c of result.evaluation.criteria) {
      expect(c.earnedPoints).toBe(1);
      expect(c.evidence.every(e => result.turns.some(t => t.turnId === e.turnId))).toBe(true);
      expect(c.evidence[0].observation).toContain("Rule:");
      expect(c.evidence[0].observation).toContain("Action:");
    }
  }
});

test("HTTP decline and counteroffer preserve state until acceptance", async ({ request }) => {
  const declined = await negotiate(request, [entry("e2e-decline", "booking-request", "I decline this request.")]);
  expect(declined.project).toMatchObject({ totalFeeCents: 150000, estimatedHours: 20, acceptedAgreementIds: [] });
  expect(declined.currentEventId).toBe("earlier-delivery");
  const expensive = entry("e2e-expensive", "booking-request", "I can add booking for an extra $900 and two more days.");
  const pending = await negotiate(request, [expensive]);
  expect(pending.turns[0].agreement?.status).toBe("counteroffered");
  expect(pending.project.totalFeeCents).toBe(150000);
  expect(pending.evaluation.criteria).toEqual([]);
  const accepted = await negotiate(request, [expensive, entry("e2e-accept", "booking-request", "I accept your offer.")]);
  expect(accepted.project).toMatchObject({ totalFeeCents: 190000, estimatedHours: 26, acceptedAgreementIds: ["e2e-accept"] });
});

test("HTTP retry is idempotent; Replay preserves the prefix and original outcome", async ({ request }) => {
  const original = await negotiate(request, [paid, rush, swap]);
  expect(original.completed).toBe(true);
  expect(original.project).toMatchObject({ totalFeeCents: 205000, estimatedHours: 26, deadlineDays: 7 });
  expect(await negotiate(request, [paid, rush, swap])).toEqual(original);
  const alternate = await negotiate(request, [paid,
    entry("replay-keep", "earlier-delivery", "I decline this request."),
    entry("replay-swap", "scope-swap", swap.userMessage)]);
  expect(alternate.completed).toBe(true);
  expect(alternate.turns[0]).toEqual(original.turns[0]);
  expect(alternate.project).toMatchObject({ totalFeeCents: 190000, estimatedHours: 26, deadlineDays: 9 });
  expect(await negotiate(request, [paid, rush, swap])).toEqual(original);
  expect(original.evaluation.criteria.some(c => c.category === "economic_decision")).toBe(true);
});
