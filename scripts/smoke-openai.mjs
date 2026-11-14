import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const base = process.argv[2] ?? "http://127.0.0.1:3100";
const artifact = new URL("../.scopeshift/openai-smoke-retry.json", import.meta.url);
let cookie = "";

async function post(history, expectedCalls, expectedStatus = 200) {
  const response = await fetch(`${base}/api/negotiate`, {
    method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ scenarioId: "web-project-01", history }),
  });
  const result = await response.json();
  assert.equal(response.status, expectedStatus, JSON.stringify(result));
  if (expectedStatus === 200) {
    assert.equal(response.headers.get("x-scopeshift-interpreter"), "openai-v2");
    assert.equal(response.headers.get("x-scopeshift-openai-calls"), String(expectedCalls));
    assert.equal(response.headers.get("x-scopeshift-evaluation"), "evidence-v2");
  }
  return result;
}

if (process.argv.includes("--retry")) {
  const saved = JSON.parse(await readFile(artifact, "utf8"));
  cookie = saved.cookie;
  assert.deepEqual(await post(saved.history, 0), saved.result);
  console.log("OpenAI restart replay passed: identical branch, zero new OpenAI calls.");
} else {
  const session = await fetch(`${base}/api/session`);
  assert.equal(session.status, 200, "Session initialization must succeed.");
  assert.equal((await session.json()).mode, "openai");
  cookie = session.headers.get("set-cookie").split(";")[0];
  const entry = (eventId, userMessage) => ({ turnId: crypto.randomUUID(), eventId, userMessage });
  const history = [entry("booking-request", "I propose adding consultation booking for an additional four hundred dollars, with delivery on day nine.")];
  const paid = await post(history, 2);
  assert.equal(paid.turns[0].agreement?.status, "accepted");
  assert.deepEqual([paid.project.totalFeeCents, paid.project.estimatedHours, paid.project.deadlineDays], [190_000, 26, 9]);
  assert.deepEqual(await post(history, 0), paid);
  await post([{ ...history[0], userMessage: "I will add it for free." }], undefined, 409);
  history.push(entry("earlier-delivery", "I can bring delivery forward from day nine to day seven for another one hundred and fifty dollars."));
  const rushed = await post(history, 2);
  assert.equal(rushed.turns.at(-1).agreement?.status, "accepted");
  history.push(entry("scope-swap", "Let's exchange the four-hour portfolio gallery for the four-hour testimonials section. Keep the fee and delivery day unchanged."));
  const result = await post(history, 2);
  assert.equal(result.completed, true);
  assert.deepEqual([result.project.totalFeeCents, result.project.estimatedHours, result.project.deadlineDays], [205_000, 26, 7]);
  assert.equal(result.project.effectiveHourlyRateCents, 7_885);
  assert.equal(result.evaluation.criteria.reduce((sum, criterion) => sum + criterion.earnedPoints, 0), 9);
  const question = await post([entry("booking-request", "Before I commit, which details would visitors need to provide when booking?")], 2);
  assert.equal(question.turns[0].action.kind, "clarify");
  assert.equal(question.project.totalFeeCents, 150_000);
  assert.equal(question.turns[0].agreement, null);
  await mkdir(new URL("../.scopeshift/", import.meta.url), { recursive: true });
  await writeFile(artifact, JSON.stringify({ cookie, history, result }), { mode: 0o600 });
  console.log("Live OpenAI HTTP smoke passed: written-out prices and dates, real paid branch, clarification, retry with zero new calls, conflict and full completion.");
}
