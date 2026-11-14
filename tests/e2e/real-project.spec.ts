import { expect, test, type Page } from "@playwright/test";
import type { FinancialImpact, NegotiationDraft, RealClientRequest, RealProject, ScopeReviewInput } from "../../src/types/real-project";

// Explicit synthetic HTTP fixtures. These tests verify the UI contract and consent
// flow, not live OpenAI, database isolation, or a production deployment.
const projectId = "324d586a-14c4-4d08-833a-0698d2a12261";
const agreementId = "3b8adbf7-be79-4843-866d-e29f96a97ae9";
const requestDocumentId = "dc446be7-2608-4143-9992-76b5a4f90696";
const analysisId = "d2791a38-1194-4228-8ad9-9c8e80e70877";
const timestamp = "2026-11-15T10:00:00.000Z";
const agreement = "Build five pages and a contact form. Appointment booking is not specified.";
const clientMessage = "Could you add consultation booking?";

async function syntheticApi(page: Page, loseFirstAnalysisResponse = false, failFirstDraftOperation = false) {
  let project: RealProject | null = null;
  let request: RealClientRequest | null = null;
  const drafts: NegotiationDraft[] = [];
  const analysisIds: string[] = [];
  const analysisCalls: string[] = [];
  const draftIds: string[] = [];
  let failedDraftId: string | null = null;
  await page.route("**/api/session", (route) => route.fulfill({ json: { mode: "openai", historyStorage: "postgres" } }));
  await page.route("**/api/real-projects**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    const body = method === "GET" || method === "DELETE" ? null : route.request().postDataJSON();
    if (path === "/api/real-projects" && method === "GET") {
      const summaries = project ? [{ ...project }] : [];
      await route.fulfill({ json: { projects: summaries.map((item) => ({ id: item.id, name: item.name, originalFeeCents: item.originalFeeCents, originalEstimatedHours: item.originalEstimatedHours, originalDeadline: item.originalDeadline, sourceRevision: item.sourceRevision, createdAt: item.createdAt, updatedAt: item.updatedAt })) } });
    } else if (path === "/api/real-projects" && method === "POST") {
      project = { id: projectId, name: body.name, originalFeeCents: body.originalFeeCents, originalEstimatedHours: body.originalEstimatedHours, originalDeadline: body.originalDeadline, sourceRevision: 1, documents: [{ id: agreementId, kind: "agreement", label: "Agreement", revision: 1, canonicalText: body.agreementText, contentHash: "a".repeat(64), passages: [{ id: `${agreementId}_p1`, start: 0, end: body.agreementText.length, text: body.agreementText }] }], createdAt: timestamp, updatedAt: timestamp };
      await route.fulfill({ status: 201, json: { project } });
    } else if (path === `/api/real-projects/${projectId}` && method === "GET") await route.fulfill({ json: { project } });
    else if (path === `/api/real-projects/${projectId}` && method === "DELETE") {
      project = null; request = null; drafts.length = 0;
      await route.fulfill({ json: { deleted: true } });
    } else if (path.endsWith("/requests") && method === "GET") await route.fulfill({ json: { requests: request ? [request] : [] } });
    else if (path.endsWith("/requests") && method === "POST") {
      analysisCalls.push(body.clientMessage);
      analysisIds.push(body.requestId);
      request = { id: body.requestId, projectId, clientMessage: body.clientMessage, sourceRevision: 1, projectSnapshot: project!, requestDocument: { id: requestDocumentId, kind: "client_request", label: "Client request", revision: 1, canonicalText: body.clientMessage, contentHash: "b".repeat(64), passages: [{ id: `${requestDocumentId}_p1`, start: 0, end: body.clientMessage.length, text: body.clientMessage }] }, status: "ready", analysis: { id: analysisId, version: "real-scope-v1", sourceRevision: 1, summary: "Booking is not explicitly covered by the pasted agreement.", items: [{ id: "item_001", title: "Consultation booking", requestedWork: "Add consultation booking.", classification: "not_specified", contractEvidence: [{ documentId: agreementId, passageId: `${agreementId}_p1`, start: 0, end: agreement.length, quote: agreement }], requestEvidence: [{ documentId: requestDocumentId, passageId: `${requestDocumentId}_p1`, start: 0, end: body.clientMessage.length, quote: body.clientMessage }], explanation: "A missing commitment needs review, not an automatic billable decision.", unknowns: ["Available-slot source is unknown."], clarificationQuestions: ["Who supplies available appointment slots?"], userReviewRequired: true }], limitations: ["Synthetic test interpretation, not a live model response."], createdAt: timestamp }, review: null, impact: null, impactHash: null, error: null, createdAt: timestamp, updatedAt: timestamp };
      if (loseFirstAnalysisResponse && analysisIds.length === 1) await route.abort("failed");
      else await route.fulfill({ json: { request } });
    } else if (path.endsWith("/review")) {
      const input = body as ScopeReviewInput;
      request = { ...request!, status: "confirmed", review: { sourceRevision: input.sourceRevision, revision: input.expectedReviewRevision + 1, items: input.items, confirmedAt: timestamp } };
      await route.fulfill({ json: { request } });
    } else if (path.endsWith("/impact")) {
      const impact: FinancialImpact = { sourceRevision: 1, reviewRevision: 1, input: body, originalFeeCents: 150000, proposedFeeCents: 190000, additionalCompensationCents: 40000, originalEstimatedHours: 20, updatedEstimatedHours: 26, removedEstimatedHours: 0, netAdditionalHours: 6, originalEffectiveHourlyRateCents: 7500, updatedEffectiveHourlyRateCents: 7308, additionalExpensesCents: 2000, additionalCompensationAfterExpensesCents: 38000, originalDeadline: "2026-11-22", proposedDeadline: "2026-11-24" };
      request = { ...request!, impact, impactHash: "c".repeat(64) };
      await route.fulfill({ json: { request, impact, changeOrder: { projectId, requestId: request.id, sourceRevision: 1, reviewRevision: 1, impactHash: request.impactHash, status: "proposed", title: "Proposed Change Order", body: "Proposed only: add consultation booking for $400, delivery 2026-11-24. Client acceptance is still required." } } });
    } else if (path.endsWith("/drafts") && method === "GET") await route.fulfill({ json: { drafts } });
    else if (path.endsWith("/drafts") && method === "POST") {
      draftIds.push(body.draftId);
      if (failFirstDraftOperation && !failedDraftId) failedDraftId = body.draftId;
      if (body.draftId === failedDraftId) {
        await route.fulfill({ status: 503, json: { error: { code: "AI_UNAVAILABLE", message: "This synthetic draft operation failed. Prepare a new draft explicitly to try another operation." } } });
        return;
      }
      const draft: NegotiationDraft = { id: body.draftId, projectId, requestId: request!.id, sourceRevision: 1, reviewRevision: 1, impactHash: request!.impactHash!, style: body.style, status: "proposed", generatedBody: "I can add consultation booking for $400, with delivery on November 24. Please confirm the proposed terms.", body: "I can add consultation booking for $400, with delivery on November 24. Please confirm the proposed terms.", createdAt: timestamp, updatedAt: timestamp };
      drafts.push(draft);
      await route.fulfill({ json: { draft } });
    } else if (path.includes("/drafts/") && method === "PATCH") {
      const draft = drafts.find((item) => path.endsWith(item.id))!;
      draft.body = body.body; draft.updatedAt = "2026-11-15T10:01:00.000Z";
      await route.fulfill({ json: { draft } });
    } else if (path.includes("/requests/") && method === "GET") await route.fulfill({ json: { request } });
    else await route.fulfill({ status: 500, json: { error: { code: "INTERNAL_ERROR", message: "Unhandled synthetic test route." } } });
  });
  return { analysisIds, analysisCalls, draftIds };
}

async function createProject(page: Page) {
  await page.goto("/real-projects");
  await page.getByLabel("Project name", { exact: true }).fill("Synthetic website");
  await page.getByLabel("Agreed fee (USD)", { exact: true }).fill("1500");
  await page.getByLabel("Original estimated hours", { exact: true }).fill("20");
  await page.getByLabel("Agreed delivery date", { exact: true }).fill("2026-11-22");
  await page.getByLabel(/^Agreement \/ statement of work/).fill(agreement);
  await expect(page.getByRole("button", { name: "Save project", exact: true })).toBeDisabled();
  await page.getByRole("checkbox", { name: /I have reviewed this text and agree to save/ }).check();
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Synthetic website", exact: true })).toBeVisible();
}

test("synthetic UI flow requires consent and review, calculates a proposal, edits history, and deletes", async ({ page }) => {
  const fixture = await syntheticApi(page);
  await createProject(page);
  await page.getByLabel("Client request text", { exact: true }).fill(clientMessage);
  await expect(page.getByRole("button", { name: "Analyze request", exact: true })).toBeDisabled();
  expect(fixture.analysisCalls).toHaveLength(0);
  await page.getByRole("checkbox", { name: /authorize sending this request and these sources to OpenAI/ }).check();
  await page.getByRole("button", { name: "Analyze request", exact: true }).click();
  await expect(page.getByText("Who supplies available appointment slots?", { exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: /^Your classification for Consultation booking/ }).selectOption("excluded");
  await page.getByRole("checkbox", { name: /I checked every item and the quoted sources/ }).check();
  await expect(page.getByRole("button", { name: "Confirm reviewed scope", exact: true })).toBeDisabled();
  await page.getByLabel("Reason for your correction (required)", { exact: true }).fill("I independently confirmed this scope boundary with the client.");
  await page.getByRole("checkbox", { name: /I checked every item and the quoted sources/ }).check();
  await page.getByRole("button", { name: "Confirm reviewed scope", exact: true }).click();
  await page.getByLabel("Additional estimated hours", { exact: true }).fill("6");
  await page.getByLabel("Deadline extension (calendar days)", { exact: true }).fill("2");
  await page.getByLabel("Additional fee / credit (USD)", { exact: true }).fill("400");
  await page.getByLabel("Additional expenses (USD)", { exact: true }).fill("20");
  await page.getByRole("checkbox", { name: /I checked these estimates and the selected scope/ }).check();
  await page.getByRole("button", { name: "Calculate proposed impact", exact: true }).click();
  await expect(page.getByLabel("Proposed project impact", { exact: true })).toContainText("$1,900.00");
  await expect(page.getByLabel("Proposed project impact", { exact: true })).toContainText("$73.08/h");
  await expect(page.getByRole("button", { name: "Generate draft", exact: true })).toBeDisabled();
  await page.getByRole("checkbox", { name: /authorize sending the source text, request, reviewed scope/ }).check();
  await page.getByRole("button", { name: "Generate draft", exact: true }).click();
  const response = page.getByLabel("Editable response", { exact: true });
  await response.fill("Thanks! I propose booking for an additional $400, due November 24. Please confirm.");
  await page.getByRole("button", { name: "Save edited draft", exact: true }).click();
  await expect(page.getByText("Your edits are not saved yet.", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: "artifacts/real-project-mode/real-project-reference-desktop.png", fullPage: true });
  await page.reload();
  await page.getByRole("button", { name: /Synthetic website.*rev 1/ }).click();
  await page.getByRole("button", { name: /Could you add consultation booking\?.*confirmed/ }).click();
  await expect(page.getByLabel("Editable response", { exact: true })).toHaveValue("Thanks! I propose booking for an additional $400, due November 24. Please confirm.");
  await expect(page.getByRole("link", { name: "Practice Mode", exact: true })).toHaveAttribute("href", "/simulation");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({ path: "artifacts/real-project-mode/real-project-reference-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Delete project and history", exact: true }).click();
  await page.getByRole("button", { name: "Confirm delete project", exact: true }).click();
  await expect(page.getByText("No saved projects yet.", { exact: true })).toBeVisible();
  expect(fixture.analysisCalls).toEqual([clientMessage]);
});

test("synthetic lost analysis response retries with the same operation UUID", async ({ page }) => {
  const fixture = await syntheticApi(page, true);
  await createProject(page);
  await page.getByLabel("Client request text", { exact: true }).fill(clientMessage);
  await page.getByRole("checkbox", { name: /authorize sending this request and these sources to OpenAI/ }).check();
  await page.getByRole("button", { name: "Analyze request", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "NETWORK_ERROR" })).toContainText("connection was interrupted");
  await page.getByRole("button", { name: "Analyze request", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Review each requested change", exact: true })).toBeVisible();
  expect(fixture.analysisIds).toHaveLength(2);
  expect(fixture.analysisIds[0]).toBe(fixture.analysisIds[1]);
});

test("synthetic failed draft retains retry identity until explicit new operation and renewed consent", async ({ page }) => {
  const fixture = await syntheticApi(page, false, true);
  await createProject(page);
  await page.getByLabel("Client request text", { exact: true }).fill(clientMessage);
  await page.getByRole("checkbox", { name: /authorize sending this request and these sources to OpenAI/ }).check();
  await page.getByRole("button", { name: "Analyze request", exact: true }).click();
  await page.getByRole("checkbox", { name: /I checked every item and the quoted sources/ }).check();
  await page.getByRole("button", { name: "Confirm reviewed scope", exact: true }).click();
  await page.getByLabel("Additional estimated hours", { exact: true }).fill("6");
  await page.getByLabel("Deadline extension (calendar days)", { exact: true }).fill("2");
  await page.getByLabel("Additional fee / credit (USD)", { exact: true }).fill("400");
  await page.getByLabel("Additional expenses (USD)", { exact: true }).fill("20");
  await page.getByRole("checkbox", { name: /I checked these estimates and the selected scope/ }).check();
  await page.getByRole("button", { name: "Calculate proposed impact", exact: true }).click();
  const generate = page.getByRole("button", { name: "Generate draft", exact: true });
  const consent = page.getByRole("checkbox", { name: /authorize sending the source text, request, reviewed scope/ });
  await consent.check();
  await generate.click();
  await expect(page.getByRole("alert").filter({ hasText: "AI_UNAVAILABLE" })).toContainText("synthetic draft operation failed");
  await generate.click();
  await expect(page.getByRole("alert").filter({ hasText: "AI_UNAVAILABLE" })).toContainText("synthetic draft operation failed");
  expect(fixture.draftIds).toHaveLength(2);
  expect(fixture.draftIds[0]).toBe(fixture.draftIds[1]);
  await page.getByRole("button", { name: "Prepare a new draft", exact: true }).click();
  await expect(consent).not.toBeChecked();
  await expect(generate).toBeDisabled();
  await expect(page.getByText(/This may make another paid OpenAI request/)).toBeVisible();
  await consent.check();
  await generate.click();
  await expect(page.getByLabel("Editable response", { exact: true })).toBeVisible();
  expect(fixture.draftIds).toHaveLength(3);
  expect(fixture.draftIds[2]).not.toBe(fixture.draftIds[0]);
});
