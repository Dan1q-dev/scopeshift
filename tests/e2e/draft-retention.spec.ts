import { expect, test, type Page } from "@playwright/test";
import type { NegotiationDraft, RealClientRequest, RealProject } from "../../src/types/real-project";

// Explicit synthetic saved records: verifies browser editing, not OpenAI or storage.
const projectId = "324d586a-14c4-4d08-833a-0698d2a12261";
const requestId = "424d586a-14c4-4d08-833a-0698d2a12261";
const agreementId = "3b8adbf7-be79-4843-866d-e29f96a97ae9";
const requestDocumentId = "dc446be7-2608-4143-9992-76b5a4f90696";
const timestamp = "2026-11-15T10:00:00.000Z";
const agreementText = "Build five pages. Booking is excluded.";
const clientMessage = "Could you add consultation booking?";

async function savedDrafts(page: Page) {
  const project: RealProject = {
    id: projectId, name: "Draft retention fixture", originalFeeCents: 150000, originalEstimatedHours: 20,
    originalDeadline: "2026-11-22", sourceRevision: 1, createdAt: timestamp, updatedAt: timestamp,
    documents: [{ id: agreementId, kind: "agreement", label: "Agreement", revision: 1, canonicalText: agreementText,
      contentHash: "a".repeat(64), passages: [{ id: "agreement_p1", start: 0, end: agreementText.length, text: agreementText }] }],
  };
  const request: RealClientRequest = {
    id: requestId, projectId, clientMessage, sourceRevision: 1, projectSnapshot: project,
    requestDocument: { id: requestDocumentId, kind: "client_request", label: "Request", revision: 1, canonicalText: clientMessage,
      contentHash: "b".repeat(64), passages: [{ id: "request_p1", start: 0, end: clientMessage.length, text: clientMessage }] },
    status: "confirmed", analysis: { id: "d2791a38-1194-4228-8ad9-9c8e80e70877", version: "real-scope-v1", sourceRevision: 1,
      summary: "Booking is excluded.", items: [{ id: "booking", title: "Booking", requestedWork: "Add booking.", classification: "excluded",
        contractEvidence: [{ documentId: agreementId, passageId: "agreement_p1", start: 0, end: agreementText.length, quote: agreementText }],
        requestEvidence: [{ documentId: requestDocumentId, passageId: "request_p1", start: 0, end: clientMessage.length, quote: clientMessage }],
        explanation: "The agreement excludes booking.", unknowns: [], clarificationQuestions: [], userReviewRequired: true }],
      limitations: ["Synthetic fixture."], createdAt: timestamp },
    review: { revision: 1, sourceRevision: 1, items: [{ itemId: "booking", classification: "excluded", reason: "" }], confirmedAt: timestamp },
    impact: { sourceRevision: 1, reviewRevision: 1,
      input: { reviewRevision: 1, selectedItemIds: ["booking"], additionalEstimatedHours: 6, removedScope: [],
        pricing: { mode: "fixed", feeDeltaCents: 40000 }, additionalExpensesCents: 0, deadlineExtensionDays: 2, assumptions: [] },
      originalFeeCents: 150000, proposedFeeCents: 190000, additionalCompensationCents: 40000,
      originalEstimatedHours: 20, updatedEstimatedHours: 26, removedEstimatedHours: 0, netAdditionalHours: 6,
      originalEffectiveHourlyRateCents: 7500, updatedEffectiveHourlyRateCents: 7308, additionalExpensesCents: 0,
      additionalCompensationAfterExpensesCents: 40000, originalDeadline: "2026-11-22", proposedDeadline: "2026-11-24" },
    impactHash: "c".repeat(64), error: null, createdAt: timestamp, updatedAt: timestamp,
  };
  const drafts: NegotiationDraft[] = (["professional", "friendly"] as const).map((style, index) => ({
    id: `${index + 5}24d586a-14c4-4d08-833a-0698d2a12261`, projectId, requestId, sourceRevision: 1,
    reviewRevision: 1, impactHash: request.impactHash!, style, status: "proposed",
    generatedBody: `Synthetic ${style} response.`, body: `Synthetic ${style} response.`, createdAt: timestamp, updatedAt: timestamp,
  }));
  const saves: { body: string; expectedUpdatedAt: string }[] = [];
  await page.route("**/api/session", (route) => route.fulfill({ json: { mode: "openai", historyStorage: "postgres" } }));
  await page.route("**/api/real-projects**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (method === "PATCH" && path.includes("/drafts/")) {
      const body = route.request().postDataJSON();
      saves.push(body);
      const draft = drafts.find((item) => path.endsWith(item.id))!;
      if (body.expectedUpdatedAt !== draft.updatedAt) {
        await route.fulfill({ status: 409, json: { error: { code: "CONFLICT", message: "A newer saved draft exists." } } });
      } else {
        draft.body = body.body; draft.updatedAt = "2026-11-15T10:02:00.000Z";
        await route.fulfill({ json: { draft } });
      }
    } else if (path.endsWith("/drafts")) await route.fulfill({ json: { drafts } });
    else if (path.endsWith("/requests")) await route.fulfill({ json: { requests: [request] } });
    else if (path.includes("/requests/")) await route.fulfill({ json: { request } });
    else if (path === `/api/real-projects/${projectId}`) await route.fulfill({ json: { project } });
    else if (path === "/api/real-projects") {
      const { documents: _documents, ...summary } = project;
      void _documents;
      await route.fulfill({ json: { projects: [summary] } });
    } else await route.fulfill({ status: 500 });
  });
  await page.goto("/real-projects");
  await page.getByRole("button", { name: /Draft retention fixture.*rev 1/ }).click();
  await page.getByRole("button", { name: /Could you add consultation booking\?.*confirmed/ }).click();
  await expect(page.getByRole("textbox", { name: "Editable response", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy proposed Change Order", exact: true })).toBeVisible();
  return { drafts, saves };
}

test("unsaved drafts survive tab switches, save explicitly, and discard independently", async ({ page }) => {
  const fixture = await savedDrafts(page);
  const response = page.getByRole("textbox", { name: "Editable response", exact: true });
  const professional = page.getByRole("tab", { name: /Clear and professional/ });
  const friendly = page.getByRole("tab", { name: /Friendly and collaborative/ });
  await response.fill("My unsaved professional revision.");
  await expect(professional).toContainText("Unsaved");
  await friendly.click();
  await expect(response).toHaveCount(1);
  await expect(response).toHaveValue("Synthetic friendly response.");
  await response.fill("My unsaved friendly revision.");
  await professional.click();
  await expect(response).toHaveValue("My unsaved professional revision.");
  expect(fixture.saves).toHaveLength(0);
  await page.getByRole("button", { name: "Save edited draft", exact: true }).click();
  await expect(professional).not.toContainText("Unsaved");
  expect(fixture.saves).toEqual([{ body: "My unsaved professional revision.", expectedUpdatedAt: timestamp }]);
  await friendly.click();
  await expect(response).toHaveValue("My unsaved friendly revision.");
  await page.getByRole("button", { name: "Discard edits", exact: true }).click();
  await expect(response).toHaveValue("Synthetic friendly response.");
  await professional.click();
  await expect(response).toHaveValue("My unsaved professional revision.");
  await expect(page.getByRole("button", { name: "Save edited draft", exact: true })).toBeDisabled();
  await page.reload();
  await page.getByRole("button", { name: /Draft retention fixture.*rev 1/ }).click();
  await page.getByRole("button", { name: /Could you add consultation booking\?.*confirmed/ }).click();
  await expect(response).toHaveValue("My unsaved professional revision.");
  await expect(page.getByRole("button", { name: "Copy proposed Change Order", exact: true })).toBeVisible();
});

test("refresh preserves unsaved draft text and the original conflict version", async ({ page }) => {
  const fixture = await savedDrafts(page);
  const response = page.getByRole("textbox", { name: "Editable response", exact: true });
  await response.fill("My unsaved version must survive.");
  fixture.drafts[0].body = "Saved elsewhere after editing started.";
  fixture.drafts[0].updatedAt = "2026-11-15T10:01:00.000Z";
  await page.getByRole("button", { name: "Refresh saved drafts", exact: true }).click();
  await expect(response).toHaveValue("My unsaved version must survive.");
  await expect(page.getByText(/A newer saved version is available/)).toBeVisible();
  await page.getByRole("button", { name: "Save edited draft", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "CONFLICT" })).toBeVisible();
  expect(fixture.saves[0].expectedUpdatedAt).toBe(timestamp);
  await expect(response).toHaveValue("My unsaved version must survive.");
  await page.getByRole("button", { name: "Discard edits", exact: true }).click();
  await expect(response).toHaveValue("Saved elsewhere after editing started.");
});

test("an inactive unsaved draft still warns before closing the page", async ({ page }) => {
  await savedDrafts(page);
  await page.getByRole("textbox", { name: "Editable response", exact: true }).fill("Unsaved inactive draft.");
  await page.getByRole("tab", { name: /Friendly and collaborative/ }).click();
  const dialog = page.waitForEvent("dialog");
  const closing = page.close({ runBeforeUnload: true });
  const warning = await dialog;
  expect(warning.type()).toBe("beforeunload");
  await warning.dismiss();
  await closing;
  await page.getByRole("tab", { name: /Clear and professional/ }).click();
  await expect(page.getByRole("textbox", { name: "Editable response", exact: true })).toHaveValue("Unsaved inactive draft.");
});
