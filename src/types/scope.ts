import { z } from "zod";

// Contract v1. USD amounts are integer cents; elapsed dates are scenario days.
export const idSchema = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
const textSchema = z.string().trim().min(1).max(4_000);
export const moneyCentsSchema = z.number().int().min(0).max(100_000_000);
const feeDeltaCentsSchema = z.number().int().min(-100_000_000).max(100_000_000);
const hoursSchema = z.number().finite().positive().max(10_000);
const daysSchema = z.number().int().positive().max(365);
const uniqueIdsSchema = z.array(idSchema).max(100).refine(
  (ids) => new Set(ids).size === ids.length,
  "IDs must be unique",
);

export const scopeItemSchema = z.object({
  id: idSchema,
  title: z.string().trim().min(1).max(200),
  description: textSchema,
  estimatedHours: hoursSchema,
}).strict().readonly();
export type ScopeItem = z.infer<typeof scopeItemSchema>;

export const initialContractSchema = z.object({
  feeCents: moneyCentsSchema,
  estimatedHours: hoursSchema,
  deadlineDays: daysSchema,
  scopeItems: z.array(scopeItemSchema).min(1).max(100).readonly(),
}).strict().superRefine((contract, ctx) => {
  const sum = contract.scopeItems.reduce((hours, item) => hours + item.estimatedHours, 0);
  if (Math.abs(sum - contract.estimatedHours) > 0.000001) {
    ctx.addIssue({ code: "custom", path: ["estimatedHours"], message: "Hours must equal the sum of baseline scope items" });
  }
  if (new Set(contract.scopeItems.map((item) => item.id)).size !== contract.scopeItems.length) {
    ctx.addIssue({ code: "custom", path: ["scopeItems"], message: "Scope item IDs must be unique" });
  }
}).readonly();
export type InitialContract = z.infer<typeof initialContractSchema>;

export const evaluationCategorySchema = z.enum([
  "clarification", "scope_management", "economic_decision", "explicit_agreement", "feasibility",
]);
export type EvaluationCategory = z.infer<typeof evaluationCategorySchema>;

export const publicScenarioEventSchema = z.object({
  id: idSchema,
  title: z.string().trim().min(1).max(200),
  clientMessage: textSchema,
  availableScopeItems: z.array(scopeItemSchema).max(100).readonly(),
  learningObjectives: z.array(textSchema).min(1).max(10).readonly(),
}).strict().readonly();

const strategySchema = z.enum(["clarify", "paid_change", "free_change", "scope_swap", "decline", "keep_contract"]);
const evaluationRuleSchema = z.object({
  id: idSchema,
  category: evaluationCategorySchema,
  observableCriterion: textSchema,
}).strict().readonly();

// These constraints are server-only. Public endpoints must use an allowlist mapper.
export const clientRulesSchema = z.object({
  maxAdditionalFeeCents: moneyCentsSchema,
  earliestDeadlineDays: daysSchema,
  latestDeadlineDays: daysSchema,
  minimumHoursPerDay: z.number().positive().max(24),
  maximumHoursPerDay: z.number().positive().max(24),
  validStrategies: z.array(strategySchema).min(1).max(6).readonly(),
  facts: z.array(textSchema).min(1).max(20).readonly(),
  evaluationRules: z.array(evaluationRuleSchema).min(1).max(20).readonly(),
}).strict().superRefine((rules, ctx) => {
  if (rules.earliestDeadlineDays > rules.latestDeadlineDays) {
    ctx.addIssue({ code: "custom", path: ["latestDeadlineDays"], message: "Latest deadline must not precede earliest deadline" });
  }
  if (rules.minimumHoursPerDay > rules.maximumHoursPerDay) {
    ctx.addIssue({ code: "custom", path: ["maximumHoursPerDay"], message: "Maximum capacity must not be less than minimum capacity" });
  }
}).readonly();

export const scenarioEventSchema = z.object({
  ...publicScenarioEventSchema.unwrap().shape,
  clientRules: clientRulesSchema,
}).strict().readonly();

const scenarioBaseShape = {
  id: idSchema,
  title: z.string().trim().min(1).max(200),
  description: textSchema,
  clientName: z.string().trim().min(1).max(100),
  currency: z.literal("USD"),
  initialContract: initialContractSchema,
};

export const scenarioSchema = z.object({
  ...scenarioBaseShape,
  events: z.array(scenarioEventSchema).min(1).max(20).readonly(),
}).strict().superRefine((scenario, ctx) => {
  if (new Set(scenario.events.map((event) => event.id)).size !== scenario.events.length) {
    ctx.addIssue({ code: "custom", path: ["events"], message: "Event IDs must be unique" });
  }
}).readonly();
export type Scenario = z.infer<typeof scenarioSchema>;

export const publicScenarioSchema = z.object({
  ...scenarioBaseShape,
  events: z.array(publicScenarioEventSchema).min(1).max(20).readonly(),
}).strict().readonly();
export type PublicScenario = z.infer<typeof publicScenarioSchema>;

export const scenarioSummarySchema = z.object({
  id: idSchema,
  title: z.string().trim().min(1).max(200),
  description: textSchema,
  clientName: z.string().trim().min(1).max(100),
  currency: z.literal("USD"),
  initialFeeCents: moneyCentsSchema,
  estimatedHours: hoursSchema,
  deadlineDays: daysSchema,
}).strict().readonly();
export type ScenarioSummary = z.infer<typeof scenarioSummarySchema>;

export function toPublicScenario(scenario: Scenario): PublicScenario {
  return publicScenarioSchema.parse({
    id: scenario.id,
    title: scenario.title,
    description: scenario.description,
    clientName: scenario.clientName,
    currency: scenario.currency,
    initialContract: scenario.initialContract,
    events: scenario.events.map((event) => ({
      id: event.id,
      title: event.title,
      clientMessage: event.clientMessage,
      availableScopeItems: event.availableScopeItems,
      learningObjectives: event.learningObjectives,
    })),
  });
}

export function toScenarioSummary(scenario: Scenario): ScenarioSummary {
  return scenarioSummarySchema.parse({
    id: scenario.id,
    title: scenario.title,
    description: scenario.description,
    clientName: scenario.clientName,
    currency: scenario.currency,
    initialFeeCents: scenario.initialContract.feeCents,
    estimatedHours: scenario.initialContract.estimatedHours,
    deadlineDays: scenario.initialContract.deadlineDays,
  });
}

export const scopeChangeSchema = z.object({
  feeDeltaCents: feeDeltaCentsSchema,
  deadlineDeltaDays: z.number().int().min(-365).max(365),
  addScopeItemIds: uniqueIdsSchema,
  removeScopeItemIds: uniqueIdsSchema,
}).strict().superRefine((change, ctx) => {
  if (change.addScopeItemIds.some((id) => change.removeScopeItemIds.includes(id))) {
    ctx.addIssue({ code: "custom", message: "The same item cannot be added and removed" });
  }
});
export type ScopeChange = z.infer<typeof scopeChangeSchema>;

// Internal interpreter output, never accepted as trusted browser input.
export const negotiationActionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("clarify"), question: textSchema }).strict(),
  z.object({ kind: z.literal("propose"), change: scopeChangeSchema }).strict(),
  z.object({ kind: z.literal("accept"), proposalId: idSchema }).strict(),
  z.object({ kind: z.literal("decline"), reason: textSchema }).strict(),
  z.object({ kind: z.literal("unresolved"), reason: textSchema }).strict(),
]);
export type NegotiationAction = z.infer<typeof negotiationActionSchema>;

export const agreementSchema = z.object({
  id: idSchema,
  eventId: idSchema,
  sourceTurnId: idSchema,
  status: z.enum(["proposed", "accepted", "rejected", "counteroffered"]),
  change: scopeChangeSchema,
  explanation: textSchema,
}).strict();
export type Agreement = z.infer<typeof agreementSchema>;

export const projectStateSchema = z.object({
  scenarioId: idSchema,
  totalFeeCents: moneyCentsSchema,
  estimatedHours: hoursSchema,
  deadlineDays: daysSchema,
  effectiveHourlyRateCents: moneyCentsSchema,
  activeScopeItems: z.array(scopeItemSchema).min(1).max(100),
  acceptedAgreementIds: uniqueIdsSchema,
}).strict();
export type ProjectState = z.infer<typeof projectStateSchema>;

export const historyEntrySchema = z.object({
  turnId: idSchema,
  eventId: idSchema,
  userMessage: z.string().trim().min(1).max(2_000),
}).strict();
export type HistoryEntry = z.infer<typeof historyEntrySchema>;

export const negotiateRequestSchema = z.object({
  scenarioId: idSchema,
  history: z.array(historyEntrySchema).min(1).max(50),
}).strict().superRefine((request, ctx) => {
  const seen = new Set<string>();
  request.history.forEach((entry, index) => {
    if (seen.has(entry.turnId)) {
      ctx.addIssue({ code: "custom", path: ["history", index, "turnId"], message: "Duplicate turnId" });
    }
    seen.add(entry.turnId);
  });
});
export type NegotiateRequest = z.infer<typeof negotiateRequestSchema>;

export const negotiationTurnSchema = z.object({
  turnId: idSchema,
  eventId: idSchema,
  userMessage: z.string().trim().min(1).max(2_000),
  action: negotiationActionSchema,
  clientReply: textSchema,
  agreement: agreementSchema.nullable(),
}).strict();
export type NegotiationTurn = z.infer<typeof negotiationTurnSchema>;

export const evaluationEvidenceSchema = z.object({
  turnId: idSchema,
  ruleId: idSchema,
  observation: textSchema,
}).strict();

export const evaluationResultSchema = z.object({
  criteria: z.array(z.object({
    category: evaluationCategorySchema,
    earnedPoints: z.number().int().min(0),
    maxPoints: z.number().int().positive(),
    evidence: z.array(evaluationEvidenceSchema).min(1).max(50),
    advice: textSchema,
  }).strict().refine((criterion) => criterion.earnedPoints <= criterion.maxPoints, "Points must not exceed the maximum")).max(20),
  strengths: z.array(textSchema).max(20),
  improvements: z.array(textSchema).max(20),
}).strict();
export type EvaluationResult = z.infer<typeof evaluationResultSchema>;

// Stable success contract shared by the rules-based backend and the frontend adapter.
export const negotiateResponseSchema = z.object({
  scenarioId: idSchema,
  turns: z.array(negotiationTurnSchema).min(1).max(50),
  project: projectStateSchema,
  evaluation: evaluationResultSchema,
  currentEventId: idSchema.nullable(),
  completed: z.boolean(),
}).strict();
export type NegotiateResponse = z.infer<typeof negotiateResponseSchema>;

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.enum(["INVALID_REQUEST", "SCENARIO_NOT_FOUND", "INVALID_HISTORY", "NOT_IMPLEMENTED", "AI_UNAVAILABLE", "RATE_LIMITED", "INTERNAL_ERROR"]),
    message: z.string().min(1).max(500),
  }).strict(),
}).strict();
export type ApiError = z.infer<typeof apiErrorSchema>;
