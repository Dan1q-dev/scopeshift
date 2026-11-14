import "server-only";
import { z } from "zod";
import {
  clientRequestCreateSchema, financialImpactInputSchema, negotiationDraftEditSchema,
  negotiationDraftInputSchema, negotiationDraftSchema, realClientRequestSchema,
  realProjectCreateSchema, realProjectUpdateSchema, scopeReviewInputSchema,
  type RealClientRequest, type RealProject,
} from "@/types/real-project";
import { createRealProjectAi, REAL_ANALYSIS_VERSION, REAL_DRAFT_VERSION } from "./ai";
import { calculateFinancialImpact } from "./finance";
import { buildProposedChangeOrder } from "./change-order";
import { buildRealProject, canonicalSource, createSourceDocument, hashRealInput } from "./source";
import type { PostgresRealProjectRepository } from "./repository";
import { RealProjectError } from "./errors";
import { publicRealError } from "./public-error";

type Repository = Pick<PostgresRealProjectRepository, keyof PostgresRealProjectRepository>;
type RequestScope = { scope: string; projectId: string; requestId: string };
type RealAi = ReturnType<typeof createRealProjectAi>;

/** Orchestration never trusts client totals or raw AI classifications as an agreement. */
export class RealProjectService {
  constructor(private readonly repository: Repository, private readonly ai: RealAi, private readonly model: string) {}

  listProjects(scope: string) { return this.repository.listProjects(scope); }
  getProject(scope: string, projectId: string) { return this.repository.getProject(scope, projectId); }
  async createProject(scope: string, value: unknown) {
    return this.repository.createProject(scope, buildRealProject(realProjectCreateSchema.parse(value)));
  }
  async updateProject(scope: string, projectId: string, value: unknown) {
    const { expectedSourceRevision, ...input } = realProjectUpdateSchema.parse(value);
    const previous = await this.repository.getProject(scope, projectId);
    if (previous.sourceRevision !== expectedSourceRevision) throw new RealProjectError(409, "STALE_SOURCE", "The agreement changed. Reload it before editing.");
    return this.repository.updateProject(scope, projectId, expectedSourceRevision, buildRealProject(input, previous));
  }
  deleteProject(scope: string, projectId: string) { return this.repository.deleteProject(scope, projectId); }
  listRequests(scope: string, projectId: string) { return this.repository.listRequests(scope, projectId); }
  getRequest(args: RequestScope) { return this.repository.getRequest(args); }

  async analyze(scope: string, projectId: string, value: unknown): Promise<RealClientRequest> {
    const input = clientRequestCreateSchema.parse(value);
    const project = await this.repository.getProject(scope, projectId);
    const clientMessage = canonicalSource(input.clientMessage);
    const requestDocument = createSourceDocument(clientMessage, "client_request", "Client request", project.sourceRevision, input.requestId);
    const inputHash = hashRealInput({ projectId, sourceRevision: project.sourceRevision,
      sources: project.documents.map(({ contentHash }) => contentHash), clientMessage, model: this.model, version: REAL_ANALYSIS_VERSION });
    const timestamp = new Date().toISOString();
    const record = realClientRequestSchema.parse({ id: input.requestId, projectId, clientMessage,
      sourceRevision: project.sourceRevision, projectSnapshot: project, requestDocument,
      status: "pending", analysis: null, review: null, impact: null, impactHash: null, error: null, createdAt: timestamp, updatedAt: timestamp });
    const args = { scope, projectId, requestId: input.requestId };
    const claim = await this.repository.claimRequest({ ...args, inputHash, record });
    if (!claim.created) {
      if (claim.request.status === "pending") throw new RealProjectError(409, "ANALYSIS_IN_PROGRESS", "This analysis is still pending. Check its history before starting another.");
      // A durable failed claim is not retried silently with another paid call.
      return claim.request;
    }
    try {
      const analysis = await this.ai.analyze(project, requestDocument);
      return await this.repository.completeAnalysis({ ...args, ownerToken: claim.ownerToken!, analysis });
    } catch (cause) {
      const error = publicRealError(cause);
      await this.repository.failAnalysis({ ...args, ownerToken: claim.ownerToken!, error: { code: error.code, message: error.message } });
      throw error;
    }
  }

  private async currentRequest(args: RequestScope): Promise<{ project: RealProject; request: RealClientRequest }> {
    const request = await this.repository.getRequest(args);
    const project = await this.repository.getProject(args.scope, args.projectId);
    if (request.sourceRevision !== project.sourceRevision) throw new RealProjectError(409, "STALE_SOURCE", "The agreement changed. Start a new analysis using the current source.");
    return { project, request };
  }

  async confirmReview(args: RequestScope, value: unknown) {
    const input = scopeReviewInputSchema.parse(value);
    const { request } = await this.currentRequest(args);
    if (!request.analysis || !["ready", "confirmed"].includes(request.status)) throw new RealProjectError(409, "REVIEW_REQUIRED", "Complete an analysis before confirming it.");
    if (input.sourceRevision !== request.sourceRevision) throw new RealProjectError(409, "STALE_SOURCE", "Review the current source revision.");
    if (input.expectedReviewRevision !== (request.review?.revision ?? 0)) throw new RealProjectError(409, "STALE_REVIEW", "The interpretation changed. Reload the latest review.");
    const items = new Map(request.analysis.items.map((item) => [item.id, item]));
    if (input.items.length !== items.size || new Set(input.items.map(({ itemId }) => itemId)).size !== items.size
      || input.items.some(({ itemId }) => !items.has(itemId))) throw new RealProjectError(400, "INVALID_REQUEST", "Confirm every analyzed item exactly once.");
    if (input.items.some((item) => item.classification !== items.get(item.itemId)!.classification && !item.reason.trim())) {
      throw new RealProjectError(400, "INVALID_REQUEST", "Explain each correction before confirming the interpretation.");
    }
    return this.repository.saveReview({ ...args, expectedReviewRevision: input.expectedReviewRevision,
      review: { revision: input.expectedReviewRevision + 1, sourceRevision: input.sourceRevision, items: input.items, confirmedAt: new Date().toISOString() } });
  }

  async calculate(args: RequestScope, value: unknown) {
    const input = financialImpactInputSchema.parse(value);
    const { project, request } = await this.currentRequest(args);
    if (!request.review || request.status !== "confirmed") throw new RealProjectError(409, "REVIEW_REQUIRED", "Confirm the scope interpretation before calculating impact.");
    if (request.review.revision !== input.reviewRevision) throw new RealProjectError(409, "STALE_REVIEW", "The confirmed interpretation changed. Reload it before calculating.");
    const impact = calculateFinancialImpact(project, input, request.review);
    const impactHash = hashRealInput(impact);
    const changeOrder = buildProposedChangeOrder(project, request, impact, impactHash);
    const saved = await this.repository.saveImpact({ ...args, expectedReviewRevision: input.reviewRevision, impact, impactHash });
    return { request: saved, impact, changeOrder };
  }

  listDrafts(args: RequestScope) { return this.repository.listDrafts(args); }

  async generateDraft(args: RequestScope, value: unknown) {
    const input = negotiationDraftInputSchema.parse(value);
    const { project, request } = await this.currentRequest(args);
    if (!request.review || request.status !== "confirmed") throw new RealProjectError(409, "REVIEW_REQUIRED", "Confirm the interpretation before generating a draft.");
    if (request.review.revision !== input.reviewRevision || !request.impact || request.impactHash !== input.impactHash) {
      throw new RealProjectError(409, "STALE_REVIEW", "Calculate and review the current proposed terms before drafting.");
    }
    const draftArgs = { ...args, draftId: input.draftId };
    const inputHash = hashRealInput({ projectId: args.projectId, requestId: args.requestId, sourceRevision: request.sourceRevision,
      reviewRevision: input.reviewRevision, impactHash: input.impactHash, style: input.style, model: this.model, version: REAL_DRAFT_VERSION });
    const claim = await this.repository.claimDraft({ ...draftArgs, inputHash, sourceRevision: request.sourceRevision,
      reviewRevision: input.reviewRevision, impactHash: input.impactHash, style: input.style });
    if (!claim.created) {
      if (claim.status === "complete" && claim.draft) return claim.draft;
      if (claim.status === "pending") throw new RealProjectError(409, "DRAFT_IN_PROGRESS", "This draft is still pending. Check its history before generating another.");
      throw new RealProjectError(503, "AI_UNAVAILABLE", claim.error?.message ?? "This draft failed. Start a new draft explicitly to retry.");
    }
    try {
      const body = await this.ai.draft(project, request, request.impact, input.style);
      const timestamp = new Date().toISOString();
      const draft = negotiationDraftSchema.parse({ id: input.draftId, projectId: args.projectId, requestId: args.requestId,
        sourceRevision: request.sourceRevision, reviewRevision: input.reviewRevision, impactHash: input.impactHash,
        style: input.style, generatedBody: body, body, status: "proposed", createdAt: timestamp, updatedAt: timestamp });
      return await this.repository.completeDraft({ ...draftArgs, ownerToken: claim.ownerToken!, draft });
    } catch (cause) {
      const error = cause instanceof z.ZodError ? new RealProjectError(502, "AI_UNAVAILABLE", "The generated draft exceeded supported limits. Select fewer items or shorten the notes.") : publicRealError(cause);
      await this.repository.failDraft({ ...draftArgs, ownerToken: claim.ownerToken!, error: { code: error.code, message: error.message } });
      throw error;
    }
  }

  editDraft(args: RequestScope & { draftId: string }, value: unknown) {
    return this.repository.editDraft({ ...args, ...negotiationDraftEditSchema.parse(value) });
  }
}
