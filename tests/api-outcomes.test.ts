import { expect, it } from "vitest";
import { POST } from "@/app/api/negotiate/route";
import { negotiateResponseSchema, type HistoryEntry } from "@/types/scope";

const entry = (turnId: string, eventId: string, userMessage: string): HistoryEntry => ({ turnId, eventId, userMessage });
const paid = entry("http-paid", "booking-request", "I can add booking for an extra $400 and two more days.");
const rush = entry("http-rush", "earlier-delivery", "I can deliver two days earlier for an extra $150.");
const swap = entry("http-swap", "scope-swap", "Replace the portfolio gallery with testimonials at the same price and deadline.");

it("real Route Handler returns evaluated paid/free, decline, counteroffer, retry and replay", async () => {
  let cookie = "";
  async function send(history: HistoryEntry[]) {
    const response = await POST(new Request("http://localhost/api/negotiate", {
      method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ scenarioId: "web-project-01", history }),
    }));
    expect(response.status).toBe(200);
    cookie = response.headers.get("Set-Cookie")!.split(";")[0];
    expect(response.headers.get("X-ScopeShift-Evaluation")).toBe("evidence-v2");
    return negotiateResponseSchema.parse(await response.json());
  }
  const p = await send([paid]);
  const f = await send([entry("http-free", "booking-request", "I can add it for free with no change to the deadline.")]);
  expect(p.project).toMatchObject({ totalFeeCents: 190000, estimatedHours: 26, deadlineDays: 9 });
  expect(f.project).toMatchObject({ totalFeeCents: 150000, estimatedHours: 26, deadlineDays: 7 });
  const d = await send([entry("http-decline", "booking-request", "I decline this request.")]);
  expect(d.project).toMatchObject({ totalFeeCents: 150000, estimatedHours: 20 });
  expect(d.currentEventId).toBe("earlier-delivery");
  const expensive = entry("http-expensive", "booking-request", "I can add booking for an extra $900 and two more days.");
  const counter = await send([expensive]);
  expect(counter.turns[0].agreement?.status).toBe("counteroffered");
  expect(counter.project.totalFeeCents).toBe(150000);
  const accepted = await send([expensive, entry("http-accept", "booking-request", "I accept your offer.")]);
  expect(accepted.project.acceptedAgreementIds).toEqual(["http-accept"]);
  const original = await send([paid, rush, swap]);
  expect(original.project).toMatchObject({ totalFeeCents: 205000, estimatedHours: 26, deadlineDays: 7 });
  expect(await send([paid, rush, swap])).toEqual(original);
  const replay = await send([paid, entry("http-replay-decline", "earlier-delivery", "I decline this request."), entry("http-replay-swap", "scope-swap", swap.userMessage)]);
  expect(replay.project).toMatchObject({ totalFeeCents: 190000, estimatedHours: 26, deadlineDays: 9 });
  expect(replay.turns[0]).toEqual(original.turns[0]);
  expect(await send([paid, rush, swap])).toEqual(original);
});
