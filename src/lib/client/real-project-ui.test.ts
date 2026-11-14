import { describe, expect, it } from "vitest";
import type { RealClientRequest, RealProject } from "@/types/real-project";
import {
  classificationCounts, errorGuidance, formatDate, formatSignedUsd, impactValuesFromRequest,
  parseImpactValues, practiceSuggestion, previewImpact, quoteContext, stepStates, type ImpactFormValues,
} from "./real-project-ui";

// Synthetic fixtures only. No real agreement or client message.
const timestamp = "2026-11-15T10:00:00.000Z";
const agreement = "Build five pages and a contact form. Appointment booking is not specified.";
const project: RealProject = {
  id: "324d586a-14c4-4d08-833a-0698d2a12261", name: "Synthetic website", originalFeeCents: 150000, originalEstimatedHours: 20,
  originalDeadline: "2026-11-22", sourceRevision: 1, createdAt: timestamp, updatedAt: timestamp,
  documents: [{ id: "3b8adbf7-be79-4843-866d-e29f96a97ae9", kind: "agreement", label: "Original agreement", revision: 1, canonicalText: agreement, contentHash: "a".repeat(64), passages: [{ id: "doc_p1", start: 0, end: agreement.length, text: agreement }] }],
};
const request = {
  id: "41f1bb80-0996-4ac6-a189-c5a99fa0c790", projectId: project.id, clientMessage: "Could you add consultation booking?", sourceRevision: 1,
  projectSnapshot: project, requestDocument: project.documents[0], status: "confirmed", analysis: null,
  review: { revision: 1, sourceRevision: 1, confirmedAt: timestamp, items: [{ itemId: "item_1", classification: "not_specified", reason: "" }, { itemId: "item_2", classification: "included", reason: "" }] },
  impact: null, impactHash: null, error: null, createdAt: timestamp, updatedAt: timestamp,
} as unknown as RealClientRequest;

const values = (patch: Partial<ImpactFormValues> = {}): ImpactFormValues => ({
  selected: ["item_1"], additionalHours: "6", removedScope: [], pricingMode: "fixed", amount: "400", expenses: "20", days: "2", assumptions: "Client supplies slots.\n\n", ...patch,
});

describe("formatting", () => {
  it("formats calendar dates without shifting the day", () => {
    expect(formatDate("2026-11-24")).toBe("Nov 24, 2026");
  });
  it("signs money deltas", () => {
    expect(formatSignedUsd(40000)).toBe("+$400.00");
    expect(formatSignedUsd(-192)).toBe("-$1.92");
    expect(formatSignedUsd(0)).toBe("$0.00");
  });
});

describe("quoteContext", () => {
  it("returns the quote with surrounding text and cut markers", () => {
    const start = agreement.indexOf("contact form");
    const context = quoteContext({ canonicalText: agreement }, start, start + "contact form".length, 10);
    expect(context).toEqual({ before: "ges and a ", quote: "contact form", after: ". Appointm", leadingCut: true, trailingCut: true });
  });
  it("rejects offsets outside the document", () => {
    expect(quoteContext({ canonicalText: "short" }, 2, 99)).toBeNull();
    expect(quoteContext({ canonicalText: "short" }, 3, 3)).toBeNull();
  });
  it("does not split a surrogate pair at the excerpt edge", () => {
    const text = "x😀abc";
    const context = quoteContext({ canonicalText: text }, 3, 4, 1)!;
    expect(context.before + context.quote + context.after).not.toMatch(/^[\uDC00-\uDFFF]/);
  });
});

describe("parseImpactValues", () => {
  it("builds the API input from form values", () => {
    expect(parseImpactValues(values(), 1)).toEqual({ status: "ok", input: {
      reviewRevision: 1, selectedItemIds: ["item_1"], additionalEstimatedHours: 6, removedScope: [],
      pricing: { mode: "fixed", feeDeltaCents: 40000 }, additionalExpensesCents: 2000, deadlineExtensionDays: 2, assumptions: ["Client supplies slots."],
    } });
  });
  it("reports missing values as incomplete and wrong values as invalid", () => {
    expect(parseImpactValues(values({ additionalHours: "" }), 1).status).toBe("incomplete");
    expect(parseImpactValues(values({ selected: [] }), 1).status).toBe("incomplete");
    expect(parseImpactValues(values({ additionalHours: "1.234" }), 1)).toEqual({ status: "invalid", message: "Hours support at most two decimal places." });
    expect(parseImpactValues(values({ days: "1.5" }), 1).status).toBe("invalid");
    expect(parseImpactValues(values({ pricingMode: "hourly", amount: "-5" }), 1).status).toBe("invalid");
  });
  it("allows a fixed credit", () => {
    const parsed = parseImpactValues(values({ amount: "-100" }), 1);
    expect(parsed.status === "ok" && parsed.input.pricing).toEqual({ mode: "fixed", feeDeltaCents: -10000 });
  });
});

describe("previewImpact", () => {
  it("uses the server rules for the documented example", () => {
    const preview = previewImpact(request, values());
    expect(preview.status).toBe("ok");
    if (preview.status !== "ok") return;
    expect(preview.impact).toMatchObject({ proposedFeeCents: 190000, updatedEstimatedHours: 26, updatedEffectiveHourlyRateCents: 7308, additionalCompensationAfterExpensesCents: 38000, proposedDeadline: "2026-11-24" });
  });
  it("explains values the server would reject", () => {
    expect(previewImpact(request, values({ removedScope: [{ description: "Gallery", estimatedHours: "30" }] }))).toEqual({ status: "invalid", message: "Removed hours cannot exceed the original estimated hours." });
  });
  it("prefills items that are not already included", () => {
    expect(impactValuesFromRequest(request).selected).toEqual(["item_1"]);
  });
});

describe("stepStates", () => {
  const analyzed = { ...request, analysis: { id: "x" }, review: null } as unknown as RealClientRequest;
  it("marks the first unfinished step as current", () => {
    expect(stepStates({ request: null, draftCount: 0, stale: false, reviewDirty: false })).toEqual({ request: "current", review: "locked", price: "locked", respond: "locked" });
    expect(stepStates({ request: analyzed, draftCount: 0, stale: false, reviewDirty: false })).toEqual({ request: "done", review: "current", price: "locked", respond: "locked" });
  });
  it("locks later steps for a stale snapshot or unsaved review", () => {
    expect(stepStates({ request: analyzed, draftCount: 0, stale: true, reviewDirty: false }).review).toBe("locked");
    const priced = { ...request, analysis: { id: "x" }, impact: { input: {} } } as unknown as RealClientRequest;
    expect(stepStates({ request: priced, draftCount: 1, stale: false, reviewDirty: true })).toEqual({ request: "done", review: "current", price: "locked", respond: "locked" });
  });
});

describe("other helpers", () => {
  it("counts classifications", () => {
    expect(classificationCounts([{ classification: "included" }, { classification: "ambiguous" }, { classification: "ambiguous" }])).toEqual({ included: 1, excluded: 0, not_specified: 0, ambiguous: 2 });
  });
  it("suggests a matching Practice request", () => {
    expect(practiceSuggestion(request).focus).toBe("Request 1 of 3");
    const swap = { ...request, impact: { input: { removedScope: [{ description: "Gallery", estimatedHours: 4 }] } } } as unknown as RealClientRequest;
    expect(practiceSuggestion(swap).focus).toBe("Request 3 of 3");
  });
  it("gives guidance for known error codes only", () => {
    expect(errorGuidance("STALE_SOURCE")).toMatch(/new analysis/);
    expect(errorGuidance("SOMETHING_ELSE")).toBeNull();
  });
});
