import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { realProjectCreateSchema, scopeClassificationSchema, type FinancialImpactInput, type ConfirmedScopeReview } from "@/types/real-project";
import { buildRealProject, canonicalSource, createSourceDocument, resolveSourceQuote, groundScopeAnalysis } from "@/lib/real-projects/source";
import { calculateFinancialImpact } from "@/lib/real-projects/finance";

function fixture(id: string) {
  return realProjectCreateSchema.parse(JSON.parse(readFileSync(new URL(`./fixtures/real-project-v1-acceptance/${id}/project.json`, import.meta.url), "utf8")));
}
describe.each(["mixed-website", "podcast-amendment", "presentation-ambiguity"])("Additional agreement: %s", id => {
  it("uses the actual project schema and contains every positive oracle quote", () => {
    const input = fixture(id);
    const oracle = JSON.parse(readFileSync(new URL(`./fixtures/real-project-v1-acceptance/${id}/expected.json`, import.meta.url), "utf8")) as {items: {allowed: string[]; quote: string | null}[]};
    for (const item of oracle.items) {
      for (const classification of item.allowed) expect(scopeClassificationSchema.safeParse(classification).success).toBe(true);
      if (item.quote) expect(canonicalSource(input.agreementText + "\n" + input.amendmentsText)).toContain(item.quote);
    }
  });
  it("production source resolver rejects invented quotes and a valid quote attributed to the wrong document", () => {
    const project = buildRealProject(fixture(id)); const doc = project.documents[0];
    expect(() => resolveSourceQuote({ documentId: doc.id, passageId: doc.passages[0].id, quote: "Every change is legally payable at $500." }, project.documents)).toThrow();
    const request = createSourceDocument("Please add one extra feature.", "client_request", "Synthetic request");
    expect(() => resolveSourceQuote({ documentId: request.id, passageId: doc.passages[0].id, quote: doc.passages[0].text }, [request])).toThrow();
  });
});

it("canonical CRLF and Unicode quotes preserve actual UTF-16 offsets, including repeated text", () => {
  const doc = createSourceDocument('First "Ready 🚀".\r\n\r\nSecond "Ready 🚀".', "agreement", "Repeated quote");
  expect(doc.canonicalText).not.toContain("\r");
  for (const passage of doc.passages) {
    const quote = resolveSourceQuote({ documentId: doc.id, passageId: passage.id, quote: '"Ready 🚀"' }, [doc]);
    expect(doc.canonicalText.slice(quote.start, quote.end)).toBe('"Ready 🚀"');
    expect(quote.start).toBeGreaterThanOrEqual(passage.start);
  }
});
it("absence cannot be grounded as an exclusion without actual agreement evidence", () => {
  const project = buildRealProject(fixture("mixed-website"));
  const doc = createSourceDocument("Please add booking.", "client_request", "Synthetic request");
  const item = { title: "Booking", requestedWork: "Add booking", classification: "excluded" as const,
    contractEvidence: [], requestEvidence: [{ documentId: doc.id, passageId: doc.passages[0].id, quote: "Please add booking." }],
    explanation: "Synthetic invalid output: treating silence as exclusion.", unknowns: [], clarificationQuestions: [] };
  expect(() => groundScopeAnalysis({ summary: "Synthetic test", items: [item], limitations: [] }, project, doc)).toThrow();
  const grounded = groundScopeAnalysis({ summary: "Synthetic test", items: [{ ...item, classification: "not_specified" }], limitations: [] }, project, doc);
  expect(grounded.items[0].classification).toBe("not_specified");
  expect(grounded.items[0].userReviewRequired).toBe(true);
});

const project = buildRealProject(fixture("mixed-website"));
const review: ConfirmedScopeReview = { sourceRevision: 1, revision: 1, confirmedAt: "2026-11-15T00:00:00.000Z", items: [{ itemId: "item_1", classification: "ambiguous", reason: "Clarify booking behavior." }] };
const input = (overrides: Partial<FinancialImpactInput> = {}): FinancialImpactInput => ({ reviewRevision: 1, selectedItemIds: ["item_1"], additionalEstimatedHours: 0, removedScope: [], pricing: { mode: "fixed", feeDeltaCents: 0 }, additionalExpensesCents: 0, deadlineExtensionDays: 0, assumptions: ["All effort and prices are user-confirmed estimates."], ...overrides });

it.each([
  ["paid proposal", input({ additionalEstimatedHours: 6, pricing: { mode: "fixed", feeDeltaCents: 40000 }, additionalExpensesCents: 2000, deadlineExtensionDays: 2 }), 190000, 26, 7308, 38000, "2026-11-24"],
  ["bounded goodwill", input({ additionalEstimatedHours: 6 }), 150000, 26, 5769, 0, "2026-11-22"],
  ["equal-effort swap", input({ additionalEstimatedHours: 4, removedScope: [{ description: "Agreed gallery", estimatedHours: 4 }] }), 150000, 20, 7500, 0, "2026-11-22"],
  ["net removal credit", input({ removedScope: [{ description: "Two hours removed", estimatedHours: 2 }], pricing: { mode: "hourly", hourlyRateCents: 10000 } }), 130000, 18, 7222, -20000, "2026-11-22"],
  ["explicit fee reduction", input({ pricing: { mode: "fixed", feeDeltaCents: -10000 } }), 140000, 20, 7000, -10000, "2026-11-22"],
  ["zero addition", input(), 150000, 20, 7500, 0, "2026-11-22"],
  ["half-cent charge", input({ additionalEstimatedHours: 0.5, pricing: { mode: "hourly", hourlyRateCents: 1 } }), 150001, 20.5, 7317, 1, "2026-11-22"],
  ["half-cent credit", input({ removedScope: [{ description: "Half hour", estimatedHours: 0.5 }], pricing: { mode: "hourly", hourlyRateCents: 1 } }), 149999, 19.5, 7692, -1, "2026-11-22"],
] as const)("actual calculator: %s", (_label, values, fee, hours, rate, afterExpenses, date) => {
  const before = structuredClone(project);
  const impact = calculateFinancialImpact(project, values, review);
  expect(impact).toMatchObject({ proposedFeeCents: fee, updatedEstimatedHours: hours, updatedEffectiveHourlyRateCents: rate, additionalCompensationAfterExpensesCents: afterExpenses, proposedDeadline: date });
  expect(project).toEqual(before); // A calculation never accepts an amendment.
});

it.each([
  ["negative expenses", input({ additionalExpensesCents: -1 })],
  ["negative rate", input({ pricing: { mode: "hourly", hourlyRateCents: -1 } })],
  ["negative extra hours", input({ additionalEstimatedHours: -1 })],
  ["zero final hours", input({ removedScope: [{ description: "All original work", estimatedHours: 20 }] })],
  ["excess removal", input({ removedScope: [{ description: "Exceeds original work", estimatedHours: 21 }] })],
  ["negative total fee", input({ pricing: { mode: "fixed", feeDeltaCents: -150001 } })],
  ["unsupported amount", input({ pricing: { mode: "fixed", feeDeltaCents: 100000000 } })],
  ["stale review", input({ reviewRevision: 2 })],
] as const)("rejects %s", (_label, values) => expect(() => calculateFinancialImpact(project, values, review)).toThrow());

it("rejects invalid dates, zero baseline hours and stale source revisions", () => {
  expect(() => buildRealProject({ ...fixture("mixed-website"), originalDeadline: "2026-02-30" })).toThrow();
  expect(() => buildRealProject({ ...fixture("mixed-website"), originalEstimatedHours: 0 })).toThrow();
  expect(() => calculateFinancialImpact(project, input(), { ...review, sourceRevision: 2 })).toThrow();
});
