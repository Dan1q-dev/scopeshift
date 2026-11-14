import { z } from "zod";
import {
  financialImpactInputSchema,
  financialImpactSchema,
  realDateSchema,
  realProjectSchema,
  scopeReviewSchema,
  type ConfirmedScopeReview,
  type FinancialImpact,
  type FinancialImpactInput,
  type RealProject,
} from "@/types/real-project";

function invalid(path: (string | number)[], message: string): never {
  throw new z.ZodError([{ code: "custom", path, message }]);
}

function safeInteger(value: number, path: (string | number)[]) {
  if (!Number.isSafeInteger(value)) invalid(path, "This calculation exceeds supported numeric limits.");
  return value;
}

/** Hours are represented as integer hundredths during every calculation. */
function hundredths(hours: number, path: (string | number)[]) {
  const units = Math.round(hours * 100);
  if (!Number.isFinite(hours) || Math.abs(hours * 100 - units) >= 0.000001) {
    invalid(path, "Hours support at most two decimal places.");
  }
  return safeInteger(units, path);
}

/** Half cents round away from zero, symmetrically for charges and credits. */
function roundRatio(numerator: number, denominator: number, path: (string | number)[]) {
  safeInteger(numerator, path);
  if (!Number.isSafeInteger(denominator) || denominator <= 0) invalid(path, "A positive calculation denominator is required.");
  const absolute = Math.abs(numerator);
  const whole = Math.floor(absolute / denominator);
  const remainder = absolute % denominator;
  const rounded = whole + (remainder * 2 >= denominator ? 1 : 0);
  return safeInteger(rounded === 0 ? 0 : Math.sign(numerator) * rounded, path);
}

function extendCalendarDate(value: string, days: number) {
  realDateSchema.parse(value);
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  if (!Number.isFinite(date.getTime())) invalid(["deadlineExtensionDays"], "The proposed calendar date is outside supported limits.");
  const proposed = date.toISOString().slice(0, 10);
  if (!realDateSchema.safeParse(proposed).success) invalid(["deadlineExtensionDays"], "The proposed calendar date is outside supported limits.");
  return proposed;
}

/**
 * The caller supplies a server-validated complete review. Classification itself
 * never sets a price: only the user's confirmed estimates and pricing do.
 * Effective rates are revenue per estimated hour, before expenses and taxes.
 */
export function calculateFinancialImpact(
  projectInput: RealProject,
  inputValue: FinancialImpactInput,
  reviewInput: ConfirmedScopeReview,
): FinancialImpact {
  const project = realProjectSchema.parse(projectInput);
  const input = financialImpactInputSchema.parse(inputValue);
  const review = scopeReviewSchema.parse(reviewInput);
  if (review.sourceRevision !== project.sourceRevision) invalid(["sourceRevision"], "Review the current agreement before calculating impact.");
  if (review.revision !== input.reviewRevision) invalid(["reviewRevision"], "Use the current confirmed review before calculating impact.");
  const reviewedIds = new Set(review.items.map((item) => item.itemId));
  if (reviewedIds.size !== review.items.length) invalid(["review"], "The confirmed review contains duplicate items.");
  if (input.selectedItemIds.some((id) => !reviewedIds.has(id))) invalid(["selectedItemIds"], "Select only items in the confirmed review.");

  const originalUnits = hundredths(project.originalEstimatedHours, ["originalEstimatedHours"]);
  const additionalUnits = hundredths(input.additionalEstimatedHours, ["additionalEstimatedHours"]);
  const removedUnits = input.removedScope.reduce((sum, item, index) => safeInteger(
    sum + hundredths(item.estimatedHours, ["removedScope", index, "estimatedHours"]),
    ["removedScope"],
  ), 0);
  if (removedUnits > originalUnits) invalid(["removedScope"], "Removed hours cannot exceed the original estimated hours.");
  const netUnits = additionalUnits - removedUnits;
  const updatedUnits = safeInteger(originalUnits + netUnits, ["updatedEstimatedHours"]);
  if (updatedUnits <= 0) invalid(["updatedEstimatedHours"], "Updated estimated hours must remain positive.");

  const feeDelta = input.pricing.mode === "fixed"
    ? input.pricing.feeDeltaCents
    : roundRatio(input.pricing.hourlyRateCents * netUnits, 100, ["pricing"]);
  const proposedFeeCents = safeInteger(project.originalFeeCents + feeDelta, ["proposedFeeCents"]);
  if (proposedFeeCents < 0) invalid(["pricing"], "The proposed total fee cannot be negative.");

  return financialImpactSchema.parse({
    sourceRevision: project.sourceRevision,
    reviewRevision: review.revision,
    input,
    originalFeeCents: project.originalFeeCents,
    proposedFeeCents,
    additionalCompensationCents: feeDelta,
    originalEstimatedHours: originalUnits / 100,
    updatedEstimatedHours: updatedUnits / 100,
    removedEstimatedHours: removedUnits / 100,
    netAdditionalHours: netUnits / 100,
    originalEffectiveHourlyRateCents: roundRatio(project.originalFeeCents * 100, originalUnits, ["originalEffectiveHourlyRateCents"]),
    updatedEffectiveHourlyRateCents: roundRatio(proposedFeeCents * 100, updatedUnits, ["updatedEffectiveHourlyRateCents"]),
    additionalExpensesCents: input.additionalExpensesCents,
    additionalCompensationAfterExpensesCents: safeInteger(feeDelta - input.additionalExpensesCents, ["additionalCompensationAfterExpensesCents"]),
    originalDeadline: project.originalDeadline,
    proposedDeadline: extendCalendarDate(project.originalDeadline, input.deadlineExtensionDays),
  });
}
