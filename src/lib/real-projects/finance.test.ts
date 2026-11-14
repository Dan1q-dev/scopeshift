import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { ConfirmedScopeReview, FinancialImpactInput, RealProject } from "@/types/real-project";
import { calculateFinancialImpact } from "./finance";

const timestamp = "2026-11-15T00:00:00.000Z";
const originalText = "Develop a business website with a contact form.";

function project(overrides: Partial<RealProject> = {}): RealProject {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Business website",
    originalFeeCents: 150_000,
    originalEstimatedHours: 20,
    originalDeadline: "2026-11-30",
    sourceRevision: 1,
    documents: [{
      id: "00000000-0000-4000-8000-000000000002",
      kind: "agreement",
      label: "Original agreement",
      revision: 1,
      canonicalText: originalText,
      contentHash: "a".repeat(64),
      passages: [{ id: "agreement_p001", start: 0, end: originalText.length, text: originalText }],
    }],
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

function review(overrides: Partial<ConfirmedScopeReview> = {}): ConfirmedScopeReview {
  return {
    revision: 1,
    sourceRevision: 1,
    items: [{ itemId: "booking", classification: "not_specified", reason: "" }],
    confirmedAt: timestamp,
    ...overrides,
  };
}

function input(overrides: Partial<FinancialImpactInput> = {}): FinancialImpactInput {
  return {
    reviewRevision: 1,
    selectedItemIds: ["booking"],
    additionalEstimatedHours: 6,
    removedScope: [],
    pricing: { mode: "fixed", feeDeltaCents: 40_000 },
    additionalExpensesCents: 0,
    deadlineExtensionDays: 2,
    assumptions: [],
    ...overrides,
  };
}

describe("calculateFinancialImpact", () => {
  it("calculates a proposal from user estimates without changing the original agreement", () => {
    const result = calculateFinancialImpact(project(), input(), review());
    expect(result).toMatchObject({
      sourceRevision: 1,
      reviewRevision: 1,
      originalFeeCents: 150_000,
      proposedFeeCents: 190_000,
      additionalCompensationCents: 40_000,
      originalEstimatedHours: 20,
      updatedEstimatedHours: 26,
      netAdditionalHours: 6,
      originalEffectiveHourlyRateCents: 7_500,
      updatedEffectiveHourlyRateCents: 7_308,
      originalDeadline: "2026-11-30",
      proposedDeadline: "2026-12-02",
    });
  });

  it("keeps expenses separate from the fee and reports compensation after added expenses", () => {
    const result = calculateFinancialImpact(project(), input({ additionalExpensesCents: 50_000 }), review());
    expect(result.proposedFeeCents).toBe(190_000);
    expect(result.additionalCompensationCents).toBe(40_000);
    expect(result.additionalExpensesCents).toBe(50_000);
    expect(result.additionalCompensationAfterExpensesCents).toBe(-10_000);
    expect(result.updatedEffectiveHourlyRateCents).toBe(7_308);
  });

  it("calculates hourly compensation only for net hours in a scope replacement", () => {
    const result = calculateFinancialImpact(project(), input({
      removedScope: [{ description: "Remove the portfolio gallery", estimatedHours: 4 }],
      pricing: { mode: "hourly", hourlyRateCents: 8_000 },
    }), review());
    expect(result).toMatchObject({
      removedEstimatedHours: 4,
      netAdditionalHours: 2,
      updatedEstimatedHours: 22,
      additionalCompensationCents: 16_000,
      proposedFeeCents: 166_000,
    });
  });

  it("supports an equal-effort swap with zero hourly compensation", () => {
    const result = calculateFinancialImpact(project(), input({
      removedScope: [{ description: "Remove the portfolio gallery", estimatedHours: 6 }],
      pricing: { mode: "hourly", hourlyRateCents: 8_000 },
    }), review());
    expect(result.netAdditionalHours).toBe(0);
    expect(result.updatedEstimatedHours).toBe(20);
    expect(result.additionalCompensationCents).toBe(0);
    expect(result.proposedFeeCents).toBe(150_000);
  });

  it("allows an explicit fixed credit when less work is proposed", () => {
    const result = calculateFinancialImpact(project(), input({
      additionalEstimatedHours: 0,
      removedScope: [{ description: "Remove the gallery", estimatedHours: 4 }],
      pricing: { mode: "fixed", feeDeltaCents: -20_000 },
    }), review());
    expect(result.proposedFeeCents).toBe(130_000);
    expect(result.updatedEstimatedHours).toBe(16);
    expect(result.additionalCompensationAfterExpensesCents).toBe(-20_000);
  });

  it.each([
    [0.5, [], 1],
    [0, [{ description: "Remove half an hour", estimatedHours: 0.5 }], -1],
  ])("rounds half-cent hourly charges and credits away from zero", (added, removed, expectedDelta) => {
    const result = calculateFinancialImpact(project(), input({
      additionalEstimatedHours: added,
      removedScope: removed,
      pricing: { mode: "hourly", hourlyRateCents: 1 },
    }), review());
    expect(result.additionalCompensationCents).toBe(expectedDelta);
  });

  it("avoids fractional-hour floating point drift", () => {
    const result = calculateFinancialImpact(project({ originalEstimatedHours: 0.1 }), input({
      additionalEstimatedHours: 0.2,
      pricing: { mode: "hourly", hourlyRateCents: 3_333 },
    }), review());
    expect(result.updatedEstimatedHours).toBe(0.3);
    expect(result.additionalCompensationCents).toBe(667);
    expect(result.updatedEffectiveHourlyRateCents).toBe(502_223);
  });

  it("accepts a zero fee, zero additional work and zero extra compensation", () => {
    const result = calculateFinancialImpact(project({ originalFeeCents: 0 }), input({
      additionalEstimatedHours: 0,
      pricing: { mode: "fixed", feeDeltaCents: 0 },
      deadlineExtensionDays: 0,
    }), review());
    expect(result.proposedFeeCents).toBe(0);
    expect(result.originalEffectiveHourlyRateCents).toBe(0);
    expect(result.updatedEffectiveHourlyRateCents).toBe(0);
    expect(result.proposedDeadline).toBe("2026-11-30");
  });

  it("supports high effective rates without confusing a rate with the total fee limit", () => {
    const result = calculateFinancialImpact(project({ originalFeeCents: 100_000_000, originalEstimatedHours: 0.01 }), input({
      additionalEstimatedHours: 0,
      pricing: { mode: "fixed", feeDeltaCents: 0 },
    }), review());
    expect(result.originalEffectiveHourlyRateCents).toBe(10_000_000_000);
    expect(result.updatedEffectiveHourlyRateCents).toBe(10_000_000_000);
  });

  it.each([
    ["2028-02-28", 2, "2028-03-01"],
    ["2026-12-31", 1, "2027-01-01"],
    ["2026-01-31", 1, "2026-02-01"],
    ["2026-03-07", 2, "2026-03-09"],
  ])("extends date-only deadlines by calendar days (%s)", (originalDeadline, deadlineExtensionDays, proposedDeadline) => {
    const result = calculateFinancialImpact(project({ originalDeadline }), input({ deadlineExtensionDays }), review());
    expect(result.proposedDeadline).toBe(proposedDeadline);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1.001, Number.MAX_SAFE_INTEGER])("rejects invalid original hours %s", (originalEstimatedHours) => {
    expect(() => calculateFinancialImpact(project({ originalEstimatedHours }), input(), review())).toThrow(z.ZodError);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, 1.001, Number.MAX_SAFE_INTEGER])("rejects invalid added hours %s", (additionalEstimatedHours) => {
    expect(() => calculateFinancialImpact(project(), input({ additionalEstimatedHours }), review())).toThrow(z.ZodError);
  });

  it.each([
    { additionalExpensesCents: -1 },
    { additionalExpensesCents: 1.5 },
    { additionalExpensesCents: Number.NaN },
    { pricing: { mode: "hourly", hourlyRateCents: -1 } },
    { pricing: { mode: "hourly", hourlyRateCents: Number.POSITIVE_INFINITY } },
    { pricing: { mode: "fixed", feeDeltaCents: Number.MAX_SAFE_INTEGER } },
    { pricing: { mode: "fixed", feeDeltaCents: 0.5 } },
    { deadlineExtensionDays: -1 },
    { deadlineExtensionDays: 1.5 },
    { deadlineExtensionDays: 366 },
  ] satisfies Partial<FinancialImpactInput>[]) ("rejects unsupported financial terms %j", (invalidInput) => {
    expect(() => calculateFinancialImpact(project(), input(invalidInput), review())).toThrow(z.ZodError);
  });

  it("rejects a discount larger than the original fee", () => {
    expect(() => calculateFinancialImpact(project(), input({ pricing: { mode: "fixed", feeDeltaCents: -150_001 } }), review())).toThrow("cannot be negative");
  });

  it("rejects calculated hourly compensation or a proposed fee beyond supported bounds", () => {
    expect(() => calculateFinancialImpact(project(), input({ pricing: { mode: "hourly", hourlyRateCents: 100_000_000 } }), review())).toThrow(z.ZodError);
    expect(() => calculateFinancialImpact(project({ originalFeeCents: 100_000_000 }), input(), review())).toThrow(z.ZodError);
  });

  it("rejects removing more than the original work or leaving zero estimated hours", () => {
    expect(() => calculateFinancialImpact(project(), input({ removedScope: [{ description: "Remove everything", estimatedHours: 21 }] }), review())).toThrow("cannot exceed");
    expect(() => calculateFinancialImpact(project(), input({ additionalEstimatedHours: 0, removedScope: [{ description: "Remove everything", estimatedHours: 20 }] }), review())).toThrow("must remain positive");
  });

  it("requires the current review and only confirmed, unique selected items", () => {
    expect(() => calculateFinancialImpact(project(), input(), review({ sourceRevision: 2 }))).toThrow("current agreement");
    expect(() => calculateFinancialImpact(project(), input({ reviewRevision: 2 }), review())).toThrow("current confirmed review");
    expect(() => calculateFinancialImpact(project(), input({ selectedItemIds: ["unreviewed"] }), review())).toThrow("confirmed review");
    expect(() => calculateFinancialImpact(project(), input({ selectedItemIds: ["booking", "booking"] }), review())).toThrow(z.ZodError);
    const duplicateReview = review();
    duplicateReview.items.push({ ...duplicateReview.items[0] });
    expect(() => calculateFinancialImpact(project(), input(), duplicateReview)).toThrow("duplicate items");
  });

  it.each(["2026-02-30", "2026-2-03", "not-a-date"]) ("rejects invalid original dates %s", (originalDeadline) => {
    expect(() => calculateFinancialImpact(project({ originalDeadline }), input(), review())).toThrow(z.ZodError);
  });

  it("rejects a proposed date beyond the supported four digit year", () => {
    expect(() => calculateFinancialImpact(project({ originalDeadline: "9999-12-31" }), input(), review())).toThrow("outside supported limits");
  });

  it("does not mutate caller-owned project, review or financial inputs", () => {
    const values = { project: project(), input: input(), review: review() };
    const before = structuredClone(values);
    calculateFinancialImpact(values.project, values.input, values.review);
    expect(values).toEqual(before);
  });
});
