import { describe, expect, it } from "vitest";
import { buildProposedChangeOrder } from "@/lib/real-projects/change-order";
import { calculateFinancialImpact } from "@/lib/real-projects/finance";
import type { RealClientRequest, RealProject } from "@/types/real-project";
import { restoreSavedChangeOrder } from "./saved-change-order";

// Synthetic saved history only. No real agreement or client data.
function fixture() {
  const timestamp = "2026-11-15T00:00:00.000Z";
  const agreement = "Build a website with a contact form. Booking is excluded.";
  const clientMessage = "Please add appointment booking.";
  const agreementId = "00000000-0000-4000-8000-000000000002";
  const requestDocumentId = "00000000-0000-4000-8000-000000000003";
  const project: RealProject = {
    id: "00000000-0000-4000-8000-000000000001", name: "Synthetic website",
    sourceRevision: 1, originalFeeCents: 150_000, originalEstimatedHours: 20, originalDeadline: "2026-11-30",
    documents: [{
      id: agreementId, kind: "agreement", label: "Original agreement", revision: 1,
      canonicalText: agreement, contentHash: "a".repeat(64),
      passages: [{ id: "agreement_p1", start: 0, end: agreement.length, text: agreement }],
    }],
    createdAt: timestamp, updatedAt: timestamp,
  };
  const request: RealClientRequest = {
    id: "00000000-0000-4000-8000-000000000004", projectId: project.id, clientMessage,
    sourceRevision: 1, projectSnapshot: structuredClone(project), status: "confirmed",
    requestDocument: {
      id: requestDocumentId, kind: "client_request", label: "Booking request", revision: 1,
      canonicalText: clientMessage, contentHash: "b".repeat(64),
      passages: [{ id: "request_p1", start: 0, end: clientMessage.length, text: clientMessage }],
    },
    analysis: {
      id: "00000000-0000-4000-8000-000000000005", version: "real-scope-v1", sourceRevision: 1,
      summary: "Booking is an additional request.", limitations: [], createdAt: timestamp,
      items: [{
        id: "booking", title: "Appointment booking", requestedWork: "Add appointment booking.",
        classification: "excluded", explanation: "The agreement excludes booking.", userReviewRequired: true,
        contractEvidence: [{ documentId: agreementId, passageId: "agreement_p1", quote: agreement, start: 0, end: agreement.length }],
        requestEvidence: [{ documentId: requestDocumentId, passageId: "request_p1", quote: clientMessage, start: 0, end: clientMessage.length }],
        unknowns: ["Available slots are unspecified."], clarificationQuestions: ["Who supplies available slots?"],
      }],
    },
    review: {
      revision: 1, sourceRevision: 1, confirmedAt: timestamp,
      items: [{ itemId: "booking", classification: "excluded", reason: "The agreement excludes booking." }],
    },
    impact: null, impactHash: "c".repeat(64), error: null, createdAt: timestamp, updatedAt: timestamp,
  };
  request.impact = calculateFinancialImpact(project, {
    reviewRevision: 1, selectedItemIds: ["booking"], additionalEstimatedHours: 6, removedScope: [],
    pricing: { mode: "fixed", feeDeltaCents: 40_000 }, additionalExpensesCents: 2_000,
    deadlineExtensionDays: 2, assumptions: ["The client supplies available slots."],
  }, request.review!);
  return { project, request };
}

describe("restoreSavedChangeOrder", () => {
  it("restores the same source-linked proposal after history is serialized and reloaded", () => {
    const { project, request } = fixture();
    const expected = buildProposedChangeOrder(project, request, request.impact!);
    const restored = restoreSavedChangeOrder(JSON.parse(JSON.stringify(request)));
    expect(restored).toEqual(expected);
    expect(restored?.body).toContain("Proposed total fee: $1,900.00");
    expect(restored?.body).toContain("Who supplies available slots?");
    expect(restored?.status).toBe("proposed");
  });

  it("keeps the historical proposal tied to its snapshot after the project changes", () => {
    const { project, request } = fixture();
    const expected = restoreSavedChangeOrder(request);
    project.sourceRevision = 2;
    project.originalFeeCents = 200_000;
    project.name = "Updated website";
    const before = structuredClone({ project, request });
    expect(restoreSavedChangeOrder(request)).toEqual(expected);
    expect(expected).toMatchObject({ sourceRevision: 1, title: "Proposed change order: Synthetic website" });
    expect({ project, request }).toEqual(before);
  });

  it("leaves an unpriced or unconfirmed request without a fabricated proposal", () => {
    const { request } = fixture();
    expect(restoreSavedChangeOrder({ ...request, impact: null, impactHash: null })).toBeNull();
    expect(restoreSavedChangeOrder({ ...request, review: null })).toBeNull();
    expect(restoreSavedChangeOrder({ ...request, analysis: null })).toBeNull();
    expect(restoreSavedChangeOrder({ ...request, status: "ready" })).toBeNull();
    expect(restoreSavedChangeOrder({ ...request, impactHash: null })).toBeNull();
  });

  it("fails safely for malformed or incomplete stored values", () => {
    for (const value of [null, undefined, {}, { impact: {} }, "invalid history"]) {
      expect(restoreSavedChangeOrder(value)).toBeNull();
    }
    const { request } = fixture();
    expect(restoreSavedChangeOrder({ ...request, impactHash: "invalid" })).toBeNull();
    expect(restoreSavedChangeOrder({ ...request, projectSnapshot: null })).toBeNull();
  });

  it("rejects inconsistent saved totals, sources and reviews without interrupting restoration", () => {
    const { request } = fixture();
    expect(restoreSavedChangeOrder({ ...request, impact: { ...request.impact, proposedFeeCents: 1 } })).toBeNull();
    expect(restoreSavedChangeOrder({ ...request, sourceRevision: 2 })).toBeNull();
    expect(restoreSavedChangeOrder({ ...request, review: { ...request.review, revision: 2 } })).toBeNull();
    expect(restoreSavedChangeOrder({ ...request, projectId: "00000000-0000-4000-8000-000000000006" })).toBeNull();
  });
});
