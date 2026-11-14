import { describe, expect, it } from "vitest";
import type { FinancialImpactInput, RealClientRequest, RealProject } from "@/types/real-project";
import { buildProposedChangeOrder } from "./change-order";
import { calculateFinancialImpact } from "./finance";

const timestamp = "2026-11-15T00:00:00.000Z";
const agreementId = "00000000-0000-4000-8000-000000000002";
const requestDocumentId = "00000000-0000-4000-8000-000000000003";
const agreementText = "The website includes a contact form. Appointment booking is excluded.";
const clientMessage = "Please add a booking form with time-slot selection.";

function fixture() {
  const project: RealProject = {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Business website",
    originalFeeCents: 150_000,
    originalEstimatedHours: 20,
    originalDeadline: "2026-11-30",
    sourceRevision: 1,
    documents: [{
      id: agreementId,
      kind: "agreement",
      label: "Original website agreement",
      revision: 1,
      canonicalText: agreementText,
      contentHash: "a".repeat(64),
      passages: [{ id: "agreement_p001", start: 0, end: agreementText.length, text: agreementText }],
    }],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const request: RealClientRequest = {
    id: "00000000-0000-4000-8000-000000000004",
    projectId: project.id,
    clientMessage,
    sourceRevision: 1,
    projectSnapshot: structuredClone(project),
    requestDocument: {
      id: requestDocumentId,
      kind: "client_request",
      label: "Client booking request",
      revision: 1,
      canonicalText: clientMessage,
      contentHash: "b".repeat(64),
      passages: [{ id: "request_p001", start: 0, end: clientMessage.length, text: clientMessage }],
    },
    status: "confirmed",
    analysis: {
      id: "00000000-0000-4000-8000-000000000005",
      version: "real-scope-v1",
      sourceRevision: 1,
      summary: "The client requests booking functionality beyond a contact form.",
      items: [{
        id: "booking",
        title: "Consultation booking",
        requestedWork: "Allow visitors to select a consultation time slot.",
        classification: "ambiguous",
        contractEvidence: [{ documentId: agreementId, passageId: "agreement_p001", quote: agreementText, start: 0, end: agreementText.length }],
        requestEvidence: [{ documentId: requestDocumentId, passageId: "request_p001", quote: clientMessage, start: 0, end: clientMessage.length }],
        explanation: "Review the booking exclusion against the requested feature.",
        unknowns: ["The source of available time slots is unspecified."],
        clarificationQuestions: ["Who manages appointment availability?"],
        userReviewRequired: true,
      }],
      limitations: [],
      createdAt: timestamp,
    },
    review: {
      revision: 1,
      sourceRevision: 1,
      items: [{ itemId: "booking", classification: "excluded", reason: "The final sentence explicitly excludes booking." }],
      confirmedAt: timestamp,
    },
    impact: null,
    impactHash: "c".repeat(64),
    error: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const input: FinancialImpactInput = {
    reviewRevision: 1,
    selectedItemIds: ["booking"],
    additionalEstimatedHours: 6,
    removedScope: [{ description: "Remove the portfolio gallery", estimatedHours: 4 }],
    pricing: { mode: "fixed", feeDeltaCents: 40_000 },
    additionalExpensesCents: 5_000,
    deadlineExtensionDays: 2,
    assumptions: ["The client supplies the approved slot list."],
  };
  const impact = calculateFinancialImpact(project, input, request.review!);
  request.impact = impact;
  return { project, request, input, impact };
}

describe("buildProposedChangeOrder", () => {
  it("builds a deterministic proposal with original scope, reviewed changes and precise proposed terms", () => {
    const { project, request, impact } = fixture();
    const order = buildProposedChangeOrder(project, request, impact);
    expect(order).toMatchObject({
      projectId: project.id,
      requestId: request.id,
      sourceRevision: 1,
      reviewRevision: 1,
      impactHash: request.impactHash,
      status: "proposed",
      title: "Proposed change order: Business website",
    });
    for (const text of [
      "PROPOSED CHANGE ORDER - NOT ACCEPTED", agreementId, agreementText,
      "Consultation booking", "Allow visitors to select a consultation time slot.",
      "User-confirmed classification: Explicitly excluded.",
      "The final sentence explicitly excludes booking.",
      "Remove the portfolio gallery (4 estimated hours removed)",
      "Original agreed fee: $1,500.00", "Additional compensation / credit: +$400.00",
      "Proposed total fee: $1,900.00", "Updated estimated hours: 22",
      "$50.00. These are not automatically added to the proposed fee.",
      "Original delivery date: 2026-11-30", "Proposed delivery date: 2026-12-02 (2 calendar days",
      "The client supplies the approved slot list.", "Who manages appointment availability?",
      "The source of available time slots is unspecified.",
      "The client has not accepted these terms", "not legal advice or a legally binding contract",
    ]) expect(order.body).toContain(text);
    expect(order.body).not.toContain("User-confirmed classification: Ambiguous");
    expect(buildProposedChangeOrder(project, request, impact)).toEqual(order);
  });

  it("describes missing evidence conservatively without treating silence as an exclusion", () => {
    const { project, request, impact } = fixture();
    request.analysis!.items[0].contractEvidence = [];
    request.review!.items[0].classification = "not_specified";
    const order = buildProposedChangeOrder(project, request, impact);
    expect(order.body).toContain("No source excerpt establishes that these changes are already included or excluded.");
    expect(order.body).toContain("User-confirmed classification: Not explicitly specified.");
  });

  it("formats a credit and no removed work without implying a new agreement", () => {
    const { project, request, input } = fixture();
    input.pricing = { mode: "fixed", feeDeltaCents: -5_000 };
    input.removedScope = [];
    const impact = calculateFinancialImpact(project, input, request.review!);
    const order = buildProposedChangeOrder(project, request, impact);
    expect(order.body).toContain("Additional compensation / credit: -$50.00");
    expect(order.body).toContain("No work is proposed for removal.");
    expect(order.status).toBe("proposed");
  });

  it("requires a complete confirmed user review", () => {
    const { project, request, impact } = fixture();
    expect(() => buildProposedChangeOrder(project, { ...request, status: "ready" }, impact)).toThrow("Confirm the complete scope analysis");
    expect(() => buildProposedChangeOrder(project, { ...request, review: null }, impact)).toThrow("Confirm the complete scope analysis");
    request.analysis!.items.push({ ...request.analysis!.items[0], id: "payment" });
    expect(() => buildProposedChangeOrder(project, request, impact)).toThrow("every analyzed item exactly once");
  });

  it("rejects stale sources, another project and mismatched confirmed review revisions", () => {
    const { project, request, impact } = fixture();
    expect(() => buildProposedChangeOrder({ ...project, sourceRevision: 2 }, request, impact)).toThrow("agreement changed");
    expect(() => buildProposedChangeOrder({ ...project, id: "00000000-0000-4000-8000-000000000006" }, request, impact)).toThrow("does not belong");
    request.review!.revision = 2;
    expect(() => buildProposedChangeOrder(project, request, impact)).toThrow("current confirmed review");
  });

  it("rejects forged saved totals even when they satisfy the response schema", () => {
    const { project, request, impact } = fixture();
    expect(() => buildProposedChangeOrder(project, request, { ...impact, proposedFeeCents: 200_000 })).toThrow("does not match the confirmed estimates");
    expect(() => buildProposedChangeOrder(project, request, { ...impact, updatedEstimatedHours: 24 })).toThrow("does not match the confirmed estimates");
  });

  it("requires a valid persisted impact reference", () => {
    const { project, request, impact } = fixture();
    expect(() => buildProposedChangeOrder(project, { ...request, impactHash: null }, impact)).toThrow("validated impact reference");
    expect(() => buildProposedChangeOrder(project, request, impact, "not-a-digest")).toThrow("validated impact reference");
  });

  it("preserves its caller-owned inputs", () => {
    const values = fixture();
    const before = structuredClone(values);
    buildProposedChangeOrder(values.project, values.request, values.impact);
    expect(values).toEqual(before);
  });
});
