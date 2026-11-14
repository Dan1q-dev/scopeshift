import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const base = (process.argv[2] || "http://127.0.0.1:3100").replace(/\/$/, "");
const artifact = new URL("../.scopeshift/persistence-smoke.json", import.meta.url);
const scenarioId = "web-project-01";
const scenarioResponse = await fetch(`${base}/api/scenarios/${scenarioId}`);
assert.equal(scenarioResponse.status, 200);
const eventIds = (await scenarioResponse.json()).scenario.events.map((event) => event.id);
assert.equal(eventIds.length, 3);
const headers = (cookie) => ({ "Content-Type": "application/json", Cookie: cookie });

async function bootstrap() {
  const response = await fetch(`${base}/api/session`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { mode: "openai", historyStorage: "postgres" });
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);
  assert.match(response.headers.get("set-cookie"), /Max-Age=2592000/);
  return cookie;
}

async function post(cookie, request, calls) {
  const response = await fetch(`${base}/api/negotiate`, { method: "POST", headers: headers(cookie), body: JSON.stringify(request) });
  assert.equal(response.status, 200, `Negotiation failed with HTTP ${response.status}: ${await response.clone().text()}`);
  assert.equal(response.headers.get("x-scopeshift-openai-calls"), String(calls));
  assert.equal(response.headers.get("x-scopeshift-evaluation"), "evidence-v2");
  return response.json();
}

async function list(cookie) {
  const response = await fetch(`${base}/api/attempts?scenarioId=${scenarioId}`, { headers: { Cookie: cookie } });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /no-store/);
  return (await response.json()).attempts;
}

if (process.argv.includes("--retry")) {
  const saved = JSON.parse(await readFile(artifact, "utf8"));
  assert.equal(saved.base, base, "Use the same production alias after redeployment.");
  assert.deepEqual(await post(saved.cookie, saved.request, 0), saved.result);
  const attempts = await list(saved.cookie);
  for (const id of saved.attemptIds) assert.ok(attempts.some((attempt) => attempt.id === id));
  console.log("Persistent history and exact retry survived restart/redeployment; new OpenAI calls: 0.");
} else {
  const unauthenticated = await fetch(`${base}/api/attempts?scenarioId=${scenarioId}`);
  assert.equal(unauthenticated.status, 409);
  const cookie = await bootstrap();
  const attemptId = randomUUID();
  const request = { scenarioId, attemptId, history: [] };
  const turn = (eventId, userMessage) => ({ turnId: randomUUID(), eventId, userMessage });
  request.history.push(turn(eventIds[0], "I can add booking for an extra $400 and two more days."));
  const first = await post(cookie, request, 1);
  assert.deepEqual([first.project.totalFeeCents, first.project.estimatedHours, first.project.deadlineDays], [190000, 26, 9]);
  assert.deepEqual(await post(cookie, request, 0), first);
  assert.deepEqual((await list(cookie)).find((attempt) => attempt.id === attemptId)?.response, first);
  const otherCookie = await bootstrap();
  assert.equal((await list(otherCookie)).some((attempt) => attempt.id === attemptId), false);

  request.history.push(turn(eventIds[1], "I can deliver two days earlier for an extra $150."));
  const second = await post(cookie, request, 1);
  assert.deepEqual([second.project.totalFeeCents, second.project.deadlineDays], [205000, 7]);
  request.history.push(turn(eventIds[2], "Replace the portfolio gallery with testimonials at the same price and deadline."));
  const result = await post(cookie, request, 1);
  assert.equal(result.completed, true);
  assert.equal(result.project.effectiveHourlyRateCents, 7885);

  const alternative = { scenarioId, attemptId: randomUUID(), history: request.history.slice(0, 1) };
  assert.deepEqual(await post(cookie, alternative, 0), first);
  alternative.history.push(turn(eventIds[1], "I decline this request. Keep the agreed deadline."));
  const declined = await post(cookie, alternative, 1);
  assert.deepEqual([declined.project.totalFeeCents, declined.project.deadlineDays], [190000, 9]);
  alternative.history.push(turn(eventIds[2], "Replace the portfolio gallery with testimonials at the same price and deadline."));
  const alternateResult = await post(cookie, alternative, 1);
  assert.equal(alternateResult.completed, true);
  assert.equal(alternateResult.project.effectiveHourlyRateCents, 7308);
  const attempts = await list(cookie);
  assert.equal(attempts.length, 2);
  assert.ok(attempts.every((attempt) => attempt.response.completed));
  await mkdir(new URL("../.scopeshift/", import.meta.url), { recursive: true });
  await writeFile(artifact, JSON.stringify({ base, cookie, request, result, attemptIds: [attemptId, alternative.attemptId] }), { mode: 0o600 });
  console.log("Postgres/OpenAI smoke passed: paid path, Replay, two saved attempts, private history, exact retry.");
}
