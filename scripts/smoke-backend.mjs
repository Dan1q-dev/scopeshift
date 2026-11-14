import assert from "node:assert/strict";

const base = process.argv[2] ?? "http://127.0.0.1:3000";
let cookie = "";
const turn = (eventId, userMessage) => ({ turnId: crypto.randomUUID(), eventId, userMessage });
const booking = () => turn("booking-request", "I can add booking for an extra $400 and two more days. Would that work?");

async function negotiate(history, expectedStatus = 200) {
  const response = await fetch(`${base}/api/negotiate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify({ scenarioId: "web-project-01", history }),
  });
  if (response.headers.has("set-cookie")) cookie = response.headers.get("set-cookie").split(";")[0];
  const body = await response.json();
  assert.equal(response.status, expectedStatus, JSON.stringify(body));
  if (expectedStatus === 200) assert.equal(response.headers.get("x-scopeshift-interpreter"), "rules-v1");
  return body;
}

const detail = await fetch(`${base}/api/scenarios/web-project-01`);
assert.equal(detail.status, 200);
assert.ok(!JSON.stringify(await detail.json()).includes("clientRules"));

const paidTurn = booking();
const paid = await negotiate([paidTurn]);
assert.equal(paid.project.totalFeeCents, 190_000);
assert.equal(paid.project.estimatedHours, 26);
assert.equal(paid.project.deadlineDays, 9);
assert.equal(paid.project.effectiveHourlyRateCents, 7_308);
assert.deepEqual(await negotiate([paidTurn]), paid);
assert.equal((await negotiate([{ ...paidTurn, userMessage: "I can add it for free." }], 409)).error.code, "INVALID_HISTORY");

const free = await negotiate([turn("booking-request", "I can add it for free with no change to the deadline.")]);
assert.equal(free.project.totalFeeCents, 150_000);
assert.equal(free.project.estimatedHours, 26);
assert.equal(free.project.effectiveHourlyRateCents, 5_769);

const expensive = turn("booking-request", "I can add booking for an extra $900 and two more days. Would that work?");
const counter = await negotiate([expensive]);
assert.equal(counter.turns[0].agreement.status, "counteroffered");
assert.equal(counter.project.totalFeeCents, 150_000);
const accepted = await negotiate([expensive, turn("booking-request", "I accept your offer.")]);
assert.equal(accepted.project.totalFeeCents, 190_000);

const result = await negotiate([
  paidTurn,
  turn("earlier-delivery", "I can deliver two days earlier for an extra $150."),
  turn("scope-swap", "Replace the portfolio gallery with testimonials at the same price and deadline."),
]);
assert.equal(result.completed, true);
assert.equal(result.currentEventId, null);
assert.equal(result.project.totalFeeCents, 205_000);
assert.equal(result.project.estimatedHours, 26);
assert.equal(result.project.deadlineDays, 7);
assert.equal(result.project.acceptedAgreementIds.length, 3);
assert.deepEqual(result.evaluation.criteria, []);

const ambiguous = await negotiate([turn("booking-request", "Sure.")]);
assert.equal(ambiguous.project.totalFeeCents, 150_000);
assert.equal(ambiguous.turns[0].agreement, null);
assert.equal((await negotiate([turn("scope-swap", "I can do it for free.")], 400)).error.code, "INVALID_HISTORY");

console.log("Backend HTTP smoke passed: public scenario, paid/free outcomes, retry, conflict, counteroffer, full completion, ambiguity and event order.");
