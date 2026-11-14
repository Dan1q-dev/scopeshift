import { z } from "zod";

// Real Project Mode v1. These DTOs do not replace Practice Mode's catalog types.
export const REAL_PROJECT_LIMITS = {
  agreementCharacters: 24_000,
  amendmentsCharacters: 8_000,
  clientMessageCharacters: 6_000,
  analysisItems: 20,
  moneyCents: 100_000_000,
  estimatedHours: 10_000,
} as const;

const uuid = z.string().uuid();
const identifier = z.string().min(1).max(120).regex(/^[a-zA-Z0-9_-]+$/);
const timestamp = z.string().datetime();
const shortText = z.string().trim().min(1).max(500);
const notes = z.array(z.string().trim().min(1).max(1_000)).max(20);
const cents = z.number().int().min(0).max(REAL_PROJECT_LIMITS.moneyCents);
const hours = z.number().finite().min(0).max(REAL_PROJECT_LIMITS.estimatedHours).refine(
  (value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001,
  "Hours support at most two decimal places",
);
const digest = z.string().regex(/^[a-f0-9]{64}$/);

export const realDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Enter a valid calendar date in YYYY-MM-DD format");

export const scopeClassificationSchema = z.enum(["included", "excluded", "not_specified", "ambiguous"]);
export type ScopeClassification = z.infer<typeof scopeClassificationSchema>;
export const scopeClassificationLabels: Record<ScopeClassification, string> = {
  included: "Explicitly included",
  excluded: "Explicitly excluded",
  not_specified: "Not explicitly specified",
  ambiguous: "Ambiguous / needs clarification",
};

export const sourcePassageSchema = z.object({
  id: identifier,
  start: z.number().int().min(0),
  end: z.number().int().positive(),
  text: z.string().min(1).max(2_000),
}).strict().refine((value) => value.end > value.start, "Passage end must follow its start");
export type SourcePassage = z.infer<typeof sourcePassageSchema>;

/** canonicalText and passage offsets use JavaScript UTF-16 code units. */
export const sourceDocumentSchema = z.object({
  id: uuid,
  kind: z.enum(["agreement", "amendment", "client_request"]),
  label: z.string().trim().min(1).max(160),
  revision: z.number().int().positive(),
  canonicalText: z.string().min(1).max(REAL_PROJECT_LIMITS.agreementCharacters + REAL_PROJECT_LIMITS.amendmentsCharacters),
  contentHash: digest,
  passages: z.array(sourcePassageSchema).min(1).max(200),
}).strict();
export type SourceDocument = z.infer<typeof sourceDocumentSchema>;

/** Model citations have no trusted offsets. The server resolves exact quotations. */
export const rawSourceQuoteSchema = z.object({
  documentId: uuid,
  passageId: identifier,
  quote: z.string().min(1).max(1_500),
}).strict();
export type RawSourceQuote = z.infer<typeof rawSourceQuoteSchema>;
export const sourceQuoteSchema = rawSourceQuoteSchema.extend({
  start: z.number().int().min(0),
  end: z.number().int().positive(),
}).strict().refine((value) => value.end > value.start, "Quote end must follow its start");
export type SourceQuote = z.infer<typeof sourceQuoteSchema>;

const rawItem = z.object({
  title: z.string().trim().min(1).max(160),
  requestedWork: z.string().trim().min(1).max(2_000),
  classification: scopeClassificationSchema,
  contractEvidence: z.array(rawSourceQuoteSchema).max(8),
  requestEvidence: z.array(rawSourceQuoteSchema).min(1).max(8),
  explanation: z.string().trim().min(1).max(2_000),
  unknowns: notes,
  clarificationQuestions: notes,
}).strict();
export const rawScopeAnalysisSchema = z.object({
  summary: z.string().trim().min(1).max(2_000),
  items: z.array(rawItem).min(1).max(REAL_PROJECT_LIMITS.analysisItems),
  limitations: notes,
}).strict();
export type RawScopeAnalysis = z.infer<typeof rawScopeAnalysisSchema>;

export const realScopeItemSchema = rawItem.extend({
  id: identifier,
  contractEvidence: z.array(sourceQuoteSchema).max(8),
  requestEvidence: z.array(sourceQuoteSchema).min(1).max(8),
  userReviewRequired: z.literal(true),
}).strict();
export type RealScopeItem = z.infer<typeof realScopeItemSchema>;
export const scopeAnalysisSchema = z.object({
  id: uuid,
  version: z.literal("real-scope-v1"),
  sourceRevision: z.number().int().positive(),
  summary: z.string().trim().min(1).max(2_000),
  items: z.array(realScopeItemSchema).min(1).max(REAL_PROJECT_LIMITS.analysisItems),
  limitations: notes,
  createdAt: timestamp,
}).strict();
export type ScopeAnalysis = z.infer<typeof scopeAnalysisSchema>;

export const realProjectCreateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  originalFeeCents: cents,
  originalEstimatedHours: hours.refine((value) => value > 0, "Original hours must be positive"),
  originalDeadline: realDateSchema,
  agreementText: z.string().min(1).max(REAL_PROJECT_LIMITS.agreementCharacters).refine((value) => Boolean(value.trim()), "Paste the agreement text"),
  amendmentsText: z.string().max(REAL_PROJECT_LIMITS.amendmentsCharacters).optional(),
}).strict();
export type RealProjectCreateInput = z.infer<typeof realProjectCreateSchema>;
export const realProjectUpdateSchema = realProjectCreateSchema.extend({ expectedSourceRevision: z.number().int().positive() }).strict();
export type RealProjectUpdateInput = z.infer<typeof realProjectUpdateSchema>;
export const realProjectSchema = z.object({
  id: uuid,
  name: z.string().trim().min(1).max(160),
  originalFeeCents: cents,
  originalEstimatedHours: hours.refine((value) => value > 0),
  originalDeadline: realDateSchema,
  sourceRevision: z.number().int().positive(),
  documents: z.array(sourceDocumentSchema).min(1).max(2),
  createdAt: timestamp,
  updatedAt: timestamp,
}).strict();
export type RealProject = z.infer<typeof realProjectSchema>;
export const realProjectSummarySchema = realProjectSchema.omit({ documents: true });
export type RealProjectSummary = z.infer<typeof realProjectSummarySchema>;

export const clientRequestCreateSchema = z.object({
  requestId: uuid,
  clientMessage: z.string().min(1).max(REAL_PROJECT_LIMITS.clientMessageCharacters).refine((value) => Boolean(value.trim()), "Paste a client request"),
  aiConsent: z.literal(true),
}).strict();
export type ClientRequestCreateInput = z.infer<typeof clientRequestCreateSchema>;

const reviewedItem = z.object({
  itemId: identifier,
  classification: scopeClassificationSchema,
  reason: z.string().trim().max(2_000),
}).strict();
export const scopeReviewInputSchema = z.object({
  sourceRevision: z.number().int().positive(),
  expectedReviewRevision: z.number().int().min(0),
  items: z.array(reviewedItem).min(1).max(REAL_PROJECT_LIMITS.analysisItems),
}).strict();
export type ScopeReviewInput = z.infer<typeof scopeReviewInputSchema>;
export const scopeReviewSchema = z.object({
  revision: z.number().int().positive(),
  sourceRevision: z.number().int().positive(),
  items: z.array(reviewedItem).min(1).max(REAL_PROJECT_LIMITS.analysisItems),
  confirmedAt: timestamp,
}).strict();
export const confirmedScopeReviewSchema = scopeReviewSchema;
export type ScopeReview = z.infer<typeof scopeReviewSchema>;
export type ConfirmedScopeReview = ScopeReview;

export const removedRealScopeSchema = z.object({ description: shortText, estimatedHours: hours }).strict();
export const financialImpactInputSchema = z.object({
  reviewRevision: z.number().int().positive(),
  selectedItemIds: z.array(identifier).min(1).max(REAL_PROJECT_LIMITS.analysisItems).refine((ids) => new Set(ids).size === ids.length, "Selected items must be unique"),
  additionalEstimatedHours: hours,
  removedScope: z.array(removedRealScopeSchema).max(20),
  pricing: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("fixed"), feeDeltaCents: z.number().int().min(-REAL_PROJECT_LIMITS.moneyCents).max(REAL_PROJECT_LIMITS.moneyCents) }).strict(),
    z.object({ mode: z.literal("hourly"), hourlyRateCents: cents }).strict(),
  ]),
  additionalExpensesCents: cents,
  deadlineExtensionDays: z.number().int().min(0).max(365),
  assumptions: notes,
}).strict();
export type FinancialImpactInput = z.infer<typeof financialImpactInputSchema>;
export const financialImpactSchema = z.object({
  sourceRevision: z.number().int().positive(),
  reviewRevision: z.number().int().positive(),
  input: financialImpactInputSchema,
  originalFeeCents: cents,
  proposedFeeCents: cents,
  additionalCompensationCents: z.number().int().min(-REAL_PROJECT_LIMITS.moneyCents).max(REAL_PROJECT_LIMITS.moneyCents),
  originalEstimatedHours: hours.refine((value) => value > 0),
  updatedEstimatedHours: z.number().finite().positive().max(2 * REAL_PROJECT_LIMITS.estimatedHours),
  removedEstimatedHours: hours,
  netAdditionalHours: z.number().finite().min(-REAL_PROJECT_LIMITS.estimatedHours).max(REAL_PROJECT_LIMITS.estimatedHours),
  originalEffectiveHourlyRateCents: z.number().int().min(0),
  updatedEffectiveHourlyRateCents: z.number().int().min(0),
  additionalExpensesCents: cents,
  additionalCompensationAfterExpensesCents: z.number().int().min(-2 * REAL_PROJECT_LIMITS.moneyCents).max(REAL_PROJECT_LIMITS.moneyCents),
  originalDeadline: realDateSchema,
  proposedDeadline: realDateSchema,
}).strict();
export type FinancialImpact = z.infer<typeof financialImpactSchema>;

export const realApiErrorCodeSchema = z.enum([
  "INVALID_REQUEST", "SESSION_REQUIRED", "NOT_FOUND", "CONFLICT", "STALE_SOURCE", "STALE_REVIEW",
  "REVIEW_REQUIRED", "INVALID_EVIDENCE", "ANALYSIS_IN_PROGRESS", "DRAFT_IN_PROGRESS",
  "IDEMPOTENCY_CONFLICT", "AI_UNAVAILABLE", "RATE_LIMITED", "LIMIT_REACHED", "FORBIDDEN",
  "STORAGE_UNAVAILABLE", "UNSUPPORTED_FILE", "INTERNAL_ERROR",
]);
export type RealApiErrorCode = z.infer<typeof realApiErrorCodeSchema>;
export const realApiErrorSchema = z.object({ error: z.object({ code: realApiErrorCodeSchema, message: z.string().min(1).max(1_000) }).strict() }).strict();

export const analysisStatusSchema = z.enum(["pending", "ready", "confirmed", "failed"]);
export type AnalysisStatus = z.infer<typeof analysisStatusSchema>;
export const realClientRequestSchema = z.object({
  id: uuid,
  projectId: uuid,
  clientMessage: z.string().min(1).max(REAL_PROJECT_LIMITS.clientMessageCharacters),
  sourceRevision: z.number().int().positive(),
  projectSnapshot: realProjectSchema,
  requestDocument: sourceDocumentSchema,
  status: analysisStatusSchema,
  analysis: scopeAnalysisSchema.nullable(),
  review: scopeReviewSchema.nullable(),
  impact: financialImpactSchema.nullable(),
  impactHash: digest.nullable(),
  error: realApiErrorSchema.shape.error.nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
}).strict();
export type RealClientRequest = z.infer<typeof realClientRequestSchema>;

export const draftStyleSchema = z.enum(["friendly", "professional", "firm"]);
export type DraftStyle = z.infer<typeof draftStyleSchema>;
export const negotiationDraftInputSchema = z.object({
  draftId: uuid,
  style: draftStyleSchema,
  reviewRevision: z.number().int().positive(),
  impactHash: digest,
  aiConsent: z.literal(true),
}).strict();
export type NegotiationDraftInput = z.infer<typeof negotiationDraftInputSchema>;
export const negotiationDraftEditSchema = z.object({ body: z.string().min(1).max(12_000), expectedUpdatedAt: timestamp.optional() }).strict();
export const negotiationDraftSchema = z.object({
  id: uuid,
  projectId: uuid,
  requestId: uuid,
  sourceRevision: z.number().int().positive(),
  reviewRevision: z.number().int().positive(),
  impactHash: digest,
  style: draftStyleSchema,
  generatedBody: z.string().min(1).max(12_000),
  body: z.string().min(1).max(12_000),
  status: z.literal("proposed"),
  createdAt: timestamp,
  updatedAt: timestamp,
}).strict();
export type NegotiationDraft = z.infer<typeof negotiationDraftSchema>;
export const changeOrderSchema = z.object({
  projectId: uuid,
  requestId: uuid,
  sourceRevision: z.number().int().positive(),
  reviewRevision: z.number().int().positive(),
  impactHash: digest,
  status: z.literal("proposed"),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(40_000),
}).strict();
export type ChangeOrder = z.infer<typeof changeOrderSchema>;

export const projectResponseSchema = z.object({ project: realProjectSchema }).strict();
export const projectListResponseSchema = z.object({ projects: z.array(realProjectSummarySchema).max(10) }).strict();
export const requestResponseSchema = z.object({ request: realClientRequestSchema }).strict();
export const requestListResponseSchema = z.object({ requests: z.array(realClientRequestSchema).max(20) }).strict();
export const draftResponseSchema = z.object({ draft: negotiationDraftSchema }).strict();
export const draftListResponseSchema = z.object({ drafts: z.array(negotiationDraftSchema).max(20) }).strict();
export const impactResponseSchema = z.object({ request: realClientRequestSchema, impact: financialImpactSchema, changeOrder: changeOrderSchema }).strict();
export const deleteProjectResponseSchema = z.object({ deleted: z.literal(true) }).strict();
