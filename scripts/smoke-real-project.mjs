import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Synthetic acceptance only. Explicit flag prevents paid calls during ordinary CI.
const base = process.argv[2];
if (!base || !process.argv.includes("--allow-ai")) throw new Error("Usage: node scripts/smoke-real-project.mjs <base-url> --allow-ai (two real OpenAI calls)");
const origin = new URL(base).origin;
let cookie = "";
let projectId;
const checks = [];
async function call(path, { method = "GET", body, useCookie = cookie, expected = 200 } = {}) {
  const response = await fetch(`${origin}${path}`, { method, signal: AbortSignal.timeout(90000), headers: {
    ...(useCookie ? { Cookie: useCookie } : {}), Origin: origin,
    ...(body === undefined ? {} : { "Content-Type": "application/json" }),
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json();
  assert.equal(response.status, expected, `${method} ${path}: ${response.status} ${data.error?.code ?? "unexpected response"}`);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  return { response, data };
}

try {
  const session = await call("/api/session");
  cookie = session.response.headers.get("set-cookie")?.split(";")[0] ?? "";
  assert.ok(cookie); assert.equal(session.data.historyStorage, "postgres");
  const input = { name: `Synthetic acceptance ${randomUUID().slice(0, 8)}`, originalFeeCents: 150000, originalEstimatedHours: 20,
    originalDeadline: "2026-12-01", agreementText: "Develop a responsive five-page business website and a contact form. The form includes name, email, message, and an email notification. Appointment booking and calendar synchronization are explicitly excluded.", amendmentsText: "The client will provide the approved website copy." };
  const created = await call("/api/real-projects", { method: "POST", body: input, expected: 201 });
  projectId = created.data.project.id;
  checks.push("create and persistent project");
  const path = `/api/real-projects/${projectId}`;
  const requestInput = { requestId: randomUUID(), clientMessage: "Please add appointment booking, synchronize it with Google Calendar, and add a phone field to the contact form.", aiConsent: true };
  const analyzed = (await call(`${path}/requests`, { method: "POST", body: requestInput })).data.request;
  assert.equal(analyzed.status, "ready"); assert.ok(analyzed.analysis.items.length >= 3);
  for (const item of analyzed.analysis.items) {
    assert.equal(item.userReviewRequired, true);
    assert.ok(item.requestEvidence.length);
    for (const quote of [...item.contractEvidence, ...item.requestEvidence]) {
      const source = [...analyzed.projectSnapshot.documents, analyzed.requestDocument].find(({ id }) => id === quote.documentId);
      assert.ok(source); assert.equal(source.canonicalText.slice(quote.start, quote.end), quote.quote);
    }
    if (["included", "excluded"].includes(item.classification)) assert.ok(item.contractEvidence.length);
  }
  checks.push("real OpenAI analysis, atomic items and exact source evidence");
  const retried = (await call(`${path}/requests`, { method: "POST", body: requestInput })).data.request;
  assert.equal(retried.analysis.id, analyzed.analysis.id); checks.push("idempotent analysis retry");
  const requestPath = `${path}/requests/${analyzed.id}`;
  const review = { sourceRevision: 1, expectedReviewRevision: 0, items: analyzed.analysis.items.map((item, index) => ({ itemId: item.id,
    classification: index === 0 ? "ambiguous" : item.classification, reason: index === 0 ? "Synthetic user correction: confirm amendment coverage before deciding." : "" })) };
  const confirmed = (await call(`${requestPath}/review`, { method: "PUT", body: review })).data.request;
  assert.equal(confirmed.review.items[0].classification, "ambiguous");
  const calculated = (await call(`${requestPath}/impact`, { method: "POST", body: { reviewRevision: 1,
    selectedItemIds: analyzed.analysis.items.map(({ id }) => id), additionalEstimatedHours: 6, removedScope: [],
    pricing: { mode: "fixed", feeDeltaCents: 40000 }, additionalExpensesCents: 2000, deadlineExtensionDays: 2,
    assumptions: ["Client provides the available consultation slots."] } })).data;
  assert.equal(calculated.impact.proposedFeeCents, 190000); assert.equal(calculated.impact.updatedEstimatedHours, 26);
  assert.equal(calculated.impact.updatedEffectiveHourlyRateCents, 7308); assert.equal(calculated.impact.proposedDeadline, "2026-12-03");
  assert.equal(calculated.changeOrder.status, "proposed"); checks.push("user correction, deterministic impact and proposed change order");
  const draftInput = { draftId: randomUUID(), style: "professional", reviewRevision: 1, impactHash: calculated.request.impactHash, aiConsent: true };
  const draft = (await call(`${requestPath}/drafts`, { method: "POST", body: draftInput })).data.draft;
  assert.equal(draft.status, "proposed"); assert.match(draft.body, /1,900\.00/);
  assert.equal((await call(`${requestPath}/drafts`, { method: "POST", body: draftInput })).data.draft.id, draft.id);
  const edited = (await call(`${requestPath}/drafts/${draft.id}`, { method: "PATCH", body: { body: `${draft.body}\n\nSynthetic freelancer edit.`, expectedUpdatedAt: draft.updatedAt } })).data.draft;
  assert.match(edited.body, /Synthetic freelancer edit/); assert.equal(edited.generatedBody, draft.generatedBody);
  assert.equal((await call(`${requestPath}/drafts`)).data.drafts[0].body, edited.body);
  assert.equal((await call(`${path}/requests`)).data.requests[0].review.revision, 1); checks.push("real OpenAI draft, retry, edits and restored history");
  const other = await call("/api/session", { useCookie: "" });
  const otherCookie = other.response.headers.get("set-cookie")?.split(";")[0] ?? "";
  await call(path, { useCookie: otherCookie, expected: 404 });
  await call(requestPath, { useCookie: otherCookie, expected: 404 });
  await call(`${requestPath}/drafts`, { useCookie: otherCookie, expected: 404 }); checks.push("cross-session resources return 404");
  await call(path, { method: "PATCH", body: { ...input, agreementText: `${input.agreementText}\nUpdated source for synthetic staleness check.`, expectedSourceRevision: 1 } });
  const stale = await call(`${requestPath}/drafts`, { method: "POST", body: { ...draftInput, draftId: randomUUID() }, expected: 409 });
  assert.equal(stale.data.error.code, "STALE_SOURCE"); checks.push("source edits invalidate future drafting");
  await call(path, { method: "DELETE" });
  await call(path, { expected: 404 }); await call(requestPath, { expected: 404 }); await call(`${requestPath}/drafts`, { expected: 404 });
  projectId = undefined; checks.push("project and child history deletion");
  console.log(JSON.stringify({ result: "REAL_PROJECT_SMOKE_OK", origin, checks, realAiCalls: 2 }, null, 2));
} finally {
  if (projectId) {
    try { await call(`/api/real-projects/${projectId}`, { method: "DELETE" }); }
    catch { console.error("Synthetic acceptance cleanup failed; delete the test project through its original session."); }
  }
}
