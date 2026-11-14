import { ZodError } from "zod";
import { calculateFinancialImpact } from "@/lib/real-projects/finance";
import {
  financialImpactInputSchema,
  type FinancialImpact,
  type FinancialImpactInput,
  type RealClientRequest,
  type ScopeClassification,
  type SourceDocument,
} from "@/types/real-project";

// Presentation helpers for Real Project Mode. Money and hour arithmetic is never invented here:
// the live preview calls the same calculateFinancialImpact the server uses, and the server result
// is the saved one.

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatUsd = (cents: number) => usd.format(cents / 100);
export const formatSignedUsd = (cents: number) => (cents === 0 ? usd.format(0) : `${cents > 0 ? "+" : "-"}${usd.format(Math.abs(cents) / 100)}`);
export const formatRate = (cents: number) => `${formatUsd(cents)}/h`;
export const formatSignedRate = (cents: number) => `${formatSignedUsd(cents)}/h`;
export const formatHours = (hours: number) => `${Number(hours.toFixed(2))} h`;
export const formatSignedHours = (hours: number) => (hours === 0 ? "0 h" : `${hours > 0 ? "+" : "-"}${Number(Math.abs(hours).toFixed(2))} h`);
export const formatSignedDays = (days: number) => (days === 0 ? "No change" : `${days > 0 ? "+" : "-"}${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"}`);

/** Calendar dates are plain YYYY-MM-DD values, so they are formatted in UTC to avoid shifting a day. */
export function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
}

export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86_400_000);
}

/** Revenue per estimated hour before expenses and tax, in cents. Display only for the saved baseline. */
export const baselineRateCents = (feeCents: number, hours: number) => (hours > 0 ? Math.round(feeCents / hours) : 0);

export const classificationStyle: Record<ScopeClassification, { short: string; pill: string; bar: string; dot: string }> = {
  included: { short: "Included", pill: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200", bar: "bg-emerald-400", dot: "bg-emerald-400" },
  excluded: { short: "Excluded", pill: "border-rose-400/40 bg-rose-400/10 text-rose-200", bar: "bg-rose-400", dot: "bg-rose-400" },
  not_specified: { short: "Not specified", pill: "border-amber-400/40 bg-amber-400/10 text-amber-200", bar: "bg-amber-400", dot: "bg-amber-400" },
  ambiguous: { short: "Needs clarification", pill: "border-sky-400/40 bg-sky-400/10 text-sky-200", bar: "bg-sky-400", dot: "bg-sky-400" },
};

export const classificationOrder: ScopeClassification[] = ["included", "excluded", "not_specified", "ambiguous"];

export function classificationCounts(items: readonly { classification: ScopeClassification }[]) {
  const counts: Record<ScopeClassification, number> = { included: 0, excluded: 0, not_specified: 0, ambiguous: 0 };
  for (const item of items) counts[item.classification] += 1;
  return counts;
}

export type QuoteContext = { before: string; quote: string; after: string; leadingCut: boolean; trailingCut: boolean };

/** The text around a cited passage. Offsets are UTF-16 code units of the displayed canonical text. */
export function quoteContext(document: Pick<SourceDocument, "canonicalText">, start: number, end: number, radius = 170): QuoteContext | null {
  const text = document.canonicalText;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > text.length) return null;
  let from = Math.max(0, start - radius);
  let to = Math.min(text.length, end + radius);
  // Never split a surrogate pair at the edge of the excerpt.
  if (from > 0 && /[\uDC00-\uDFFF]/.test(text[from])) from += 1;
  if (to < text.length && /[\uDC00-\uDFFF]/.test(text[to])) to -= 1;
  return { before: text.slice(from, start), quote: text.slice(start, end), after: text.slice(end, to), leadingCut: from > 0, trailingCut: to < text.length };
}

// ---------------------------------------------------------------- errors

const guidance: Record<string, string> = {
  NETWORK_ERROR: "Retry the same action to recover a lost response. Analysis and draft retries reuse the same operation ID.",
  SESSION_REQUIRED: "Your private session is missing or expired. Reload the page to start a new one. Projects saved under a deleted cookie cannot be recovered.",
  STALE_SOURCE: "The agreement changed after this analysis. The latest saved data was loaded; run a new analysis against the current text.",
  STALE_REVIEW: "Your review changed after this step. The latest saved review was loaded; check it and calculate again.",
  CONFLICT: "Another change updated this record first. The latest saved version was loaded; check it and try again.",
  REVIEW_REQUIRED: "Confirm your scope review before pricing or drafting.",
  INVALID_EVIDENCE: "The analysis could not be matched to the source text. Starting a new analysis is an explicit action and may use another paid AI request.",
  ANALYSIS_IN_PROGRESS: "This analysis has not finished. Refresh its stored status instead of starting a second one.",
  DRAFT_IN_PROGRESS: "This draft has not finished. Refresh saved drafts instead of generating another.",
  IDEMPOTENCY_CONFLICT: "This operation was already used with different content. Prepare a new operation explicitly.",
  AI_UNAVAILABLE: "The AI service is unavailable right now, and nothing was invented in its place. Try again later; Practice Mode still works.",
  RATE_LIMITED: "A usage limit was reached. Wait a little and try again.",
  LIMIT_REACHED: "A usage limit was reached. Wait a little and try again.",
  STORAGE_UNAVAILABLE: "Saved history is temporarily unavailable. Your text is still on this page; try again shortly.",
  NOT_FOUND: "This item no longer exists for this browser session.",
  FORBIDDEN: "This action was blocked for safety. Reload the page and try again.",
};

export function errorGuidance(code: string): string | null {
  return guidance[code] ?? null;
}

/** Codes after which the saved server state should be reloaded before the user tries again. */
export const refreshAfterCodes = new Set(["STALE_SOURCE", "STALE_REVIEW", "CONFLICT"]);

// ---------------------------------------------------------------- steps

export type StepKey = "request" | "review" | "price" | "respond";
export type StepState = "done" | "current" | "locked";
export const stepOrder: StepKey[] = ["request", "review", "price", "respond"];
export const stepLabels: Record<StepKey, string> = { request: "Request", review: "Review", price: "Price", respond: "Respond" };

export function stepStates(input: { request: RealClientRequest | null; draftCount: number; stale: boolean; reviewDirty: boolean }): Record<StepKey, StepState> {
  const { request, draftCount, stale, reviewDirty } = input;
  const analyzed = Boolean(request?.analysis) && !stale;
  const reviewed = analyzed && Boolean(request?.review) && !reviewDirty;
  const priced = reviewed && Boolean(request?.impact);
  const responded = priced && draftCount > 0;
  const done: Record<StepKey, boolean> = { request: analyzed, review: reviewed, price: priced, respond: responded };
  const unlocked: Record<StepKey, boolean> = { request: true, review: analyzed, price: reviewed, respond: priced };
  const states = {} as Record<StepKey, StepState>;
  let currentTaken = false;
  for (const key of stepOrder) {
    if (done[key]) states[key] = "done";
    else if (unlocked[key] && !currentTaken) { states[key] = "current"; currentTaken = true; }
    else states[key] = "locked";
  }
  return states;
}

// ---------------------------------------------------------------- Practice link

export type PracticeSuggestion = { title: string; body: string; focus: string };

/** Which Practice Mode request best rehearses the situation. Nothing about the real project is passed on. */
export function practiceSuggestion(request: Pick<RealClientRequest, "impact" | "review">): PracticeSuggestion {
  if (request.impact && request.impact.input.removedScope.length > 0) {
    return { title: "Practice trading scope", focus: "Request 3 of 3", body: "Practice Mode includes a request to swap part of the agreed work at the same price and date. It rehearses exactly this kind of exchange." };
  }
  if (request.review?.items.some((item) => item.classification === "ambiguous" || item.classification === "not_specified")) {
    return { title: "Practice asking before you commit", focus: "Request 1 of 3", body: "Practice Mode starts with a booking request the contract does not describe. You rehearse asking clarifying questions and pricing extra work before agreeing." };
  }
  return { title: "Practice pricing a change request", focus: "Request 1 of 3", body: "Practice Mode lets you answer a client who asks for more, then shows what your answer did to your hourly rate." };
}

// ---------------------------------------------------------------- impact form

export type ImpactFormValues = {
  selected: string[];
  additionalHours: string;
  removedScope: { description: string; estimatedHours: string }[];
  pricingMode: "fixed" | "hourly";
  amount: string;
  expenses: string;
  days: string;
  assumptions: string;
};

export function impactValuesFromRequest(request: RealClientRequest): ImpactFormValues {
  const previous = request.impact?.input;
  const review = request.review!;
  return {
    selected: previous?.selectedItemIds ?? review.items.filter((item) => item.classification !== "included").map((item) => item.itemId),
    additionalHours: previous ? String(previous.additionalEstimatedHours) : "",
    removedScope: previous?.removedScope.map((item) => ({ description: item.description, estimatedHours: String(item.estimatedHours) })) ?? [],
    pricingMode: previous?.pricing.mode ?? "fixed",
    amount: previous ? String((previous.pricing.mode === "fixed" ? previous.pricing.feeDeltaCents : previous.pricing.hourlyRateCents) / 100) : "",
    expenses: String((previous?.additionalExpensesCents ?? 0) / 100),
    days: String(previous?.deadlineExtensionDays ?? 0),
    assumptions: previous?.assumptions.join("\n") ?? "",
  };
}

export type ParsedImpact =
  | { status: "incomplete"; message: string }
  | { status: "invalid"; message: string }
  | { status: "ok"; input: FinancialImpactInput };

const decimalOf = (value: string) => (value.trim() === "" ? null : Number(value));
const hasMoreThanTwoDecimals = (value: number) => Math.abs(value * 100 - Math.round(value * 100)) >= 0.000001;

export function parseImpactValues(values: ImpactFormValues, reviewRevision: number): ParsedImpact {
  if (values.selected.length === 0) return { status: "incomplete", message: "Select at least one item covered by this proposal." };
  const hours = decimalOf(values.additionalHours);
  if (hours === null) return { status: "incomplete", message: "Enter the additional estimated hours (0 is allowed)." };
  if (!Number.isFinite(hours) || hours < 0) return { status: "invalid", message: "Additional hours must be zero or more." };
  if (hasMoreThanTwoDecimals(hours)) return { status: "invalid", message: "Hours support at most two decimal places." };
  const days = decimalOf(values.days);
  if (days === null) return { status: "incomplete", message: "Enter the deadline extension in calendar days (0 is allowed)." };
  if (!Number.isInteger(days) || days < 0 || days > 365) return { status: "invalid", message: "The deadline extension must be a whole number of days from 0 to 365." };
  const amount = decimalOf(values.amount);
  if (amount === null) return { status: "incomplete", message: values.pricingMode === "fixed" ? "Enter the additional fee or credit in USD." : "Enter your hourly rate in USD." };
  if (!Number.isFinite(amount) || hasMoreThanTwoDecimals(amount)) return { status: "invalid", message: "Use a dollar amount with at most two decimal places." };
  if (values.pricingMode === "hourly" && amount < 0) return { status: "invalid", message: "An hourly rate cannot be negative." };
  const expenses = decimalOf(values.expenses);
  if (expenses === null) return { status: "incomplete", message: "Enter additional expenses in USD (0 is allowed)." };
  if (!Number.isFinite(expenses) || expenses < 0 || hasMoreThanTwoDecimals(expenses)) return { status: "invalid", message: "Expenses must be zero or more, with at most two decimal places." };
  const removedScope: { description: string; estimatedHours: number }[] = [];
  for (const [index, item] of values.removedScope.entries()) {
    const removedHours = decimalOf(item.estimatedHours);
    if (!item.description.trim() || removedHours === null) return { status: "incomplete", message: `Describe removed task ${index + 1} and enter its hours.` };
    if (!Number.isFinite(removedHours) || removedHours < 0 || hasMoreThanTwoDecimals(removedHours)) return { status: "invalid", message: `Removed hours for task ${index + 1} must be zero or more, with at most two decimal places.` };
    removedScope.push({ description: item.description.trim(), estimatedHours: removedHours });
  }
  const cents = Math.round(amount * 100);
  const candidate = {
    reviewRevision,
    selectedItemIds: values.selected,
    additionalEstimatedHours: hours,
    removedScope,
    pricing: values.pricingMode === "fixed" ? { mode: "fixed" as const, feeDeltaCents: cents } : { mode: "hourly" as const, hourlyRateCents: cents },
    additionalExpensesCents: Math.round(expenses * 100),
    deadlineExtensionDays: days,
    assumptions: values.assumptions.split("\n").map((note) => note.trim()).filter(Boolean),
  };
  const parsed = financialImpactInputSchema.safeParse(candidate);
  return parsed.success ? { status: "ok", input: parsed.data } : { status: "invalid", message: parsed.error.issues[0]?.message ?? "Check the values." };
}

export type ImpactPreview =
  | { status: "incomplete" | "invalid"; message: string }
  | { status: "ok"; impact: FinancialImpact; input: FinancialImpactInput };

/** Live arithmetic with the server's own rules. It is a preview; the saved result comes from the server. */
export function previewImpact(request: RealClientRequest, values: ImpactFormValues): ImpactPreview {
  if (!request.review) return { status: "incomplete", message: "Confirm your scope review first." };
  const parsed = parseImpactValues(values, request.review.revision);
  if (parsed.status !== "ok") return parsed;
  try {
    return { status: "ok", impact: calculateFinancialImpact(request.projectSnapshot, parsed.input, request.review), input: parsed.input };
  } catch (cause) {
    if (cause instanceof ZodError) return { status: "invalid", message: cause.issues[0]?.message ?? "These values cannot be calculated." };
    return { status: "invalid", message: "These values cannot be calculated." };
  }
}
