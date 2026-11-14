import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import {
  draftStyleSchema, financialImpactSchema, negotiationDraftSchema, realApiErrorSchema,
  realClientRequestSchema, realProjectSchema, realProjectSummarySchema, scopeAnalysisSchema, scopeReviewSchema,
  type DraftStyle, type FinancialImpact, type NegotiationDraft, type RealClientRequest,
  type RealProject, type RealProjectSummary, type ScopeAnalysis, type ScopeReview,
} from "@/types/real-project";
import type { SqlClient } from "@/lib/simulation/postgres-types";
import { RealProjectError } from "./errors";

const uuid = z.string().uuid();
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const projectRow = z.object({ id: uuid, revision: z.number().int().positive(), data: z.unknown() });
const requestRow = z.object({ id: uuid, project_id: uuid, source_revision: z.number().int().positive(), input_hash: digest, status: z.enum(["pending", "ready", "confirmed", "failed"]), owner_token: uuid, data: z.unknown() });
const draftRow = z.object({ id: uuid, request_id: uuid, source_revision: z.number().int().positive(), review_revision: z.number().int().positive(), impact_hash: digest, input_hash: digest, style: draftStyleSchema, status: z.enum(["pending", "complete", "failed"]), owner_token: uuid, data: z.unknown().nullable(), error: z.unknown().nullable() });
const MAX_HISTORY_BYTES = 3 * 1024 * 1024;

type Scope = { scope: string; projectId: string };
type RequestScope = Scope & { requestId: string };
type RequestClaim = { created: boolean; ownerToken: string | null; request: RealClientRequest };
export interface DraftClaim { created: boolean; ownerToken: string | null; status: "pending" | "complete" | "failed"; draft: NegotiationDraft | null; error: { code: string; message: string } | null }

export function realProjectScopeHash(scope: string) {
  if (!scope.trim() || scope.length > 512) throw new RealProjectError(401, "SESSION_REQUIRED", "Initialize the anonymous session before accessing real projects.");
  return createHash("sha256").update(scope).digest("hex");
}

function missing(): never { throw new RealProjectError(404, "NOT_FOUND", "The real project record was not found."); }
function conflict(code: "CONFLICT" | "STALE_SOURCE" | "STALE_REVIEW" | "IDEMPOTENCY_CONFLICT", message: string): never { throw new RealProjectError(409, code, message); }
function invalidRecord(): never { throw new RealProjectError(503, "STORAGE_UNAVAILABLE", "Saved real project data is unavailable."); }
function validate<T>(schema: z.ZodType<T>, value: unknown): T { const parsed = schema.safeParse(value); if (!parsed.success) return invalidRecord(); return parsed.data; }
const now = () => new Date().toISOString();

function readProject(raw: unknown): RealProject {
  const row = validate(projectRow, raw);
  const project = validate(realProjectSchema, row.data);
  if (project.id !== row.id || project.sourceRevision !== row.revision) return invalidRecord();
  return project;
}

function checkRequest(request: RealClientRequest): RealClientRequest {
  if (request.projectSnapshot.id !== request.projectId || request.projectSnapshot.sourceRevision !== request.sourceRevision
    || request.requestDocument.kind !== "client_request" || request.requestDocument.canonicalText !== request.clientMessage.replace(/\r\n?/g, "\n")
    || (request.analysis && request.analysis.sourceRevision !== request.sourceRevision)
    || (request.review && (request.review.sourceRevision !== request.sourceRevision || !request.analysis))
    || (Boolean(request.impact) !== Boolean(request.impactHash))
    || (request.impact && (!request.review || request.impact.sourceRevision !== request.sourceRevision || request.impact.reviewRevision !== request.review.revision))) return invalidRecord();
  if (request.status === "pending" && (request.analysis || request.review || request.impact || request.error)) return invalidRecord();
  if (request.status === "ready" && (!request.analysis || request.review || request.error)) return invalidRecord();
  if (request.status === "confirmed" && (!request.analysis || !request.review || request.error)) return invalidRecord();
  if (request.status === "failed" && !request.error) return invalidRecord();
  return request;
}

function readRequest(raw: unknown): RealClientRequest {
  const row = validate(requestRow, raw);
  const request = checkRequest(validate(realClientRequestSchema, row.data));
  if (request.id !== row.id || request.projectId !== row.project_id || request.sourceRevision !== row.source_revision || request.status !== row.status) return invalidRecord();
  return request;
}

function readDraft(raw: unknown): NegotiationDraft {
  const row = validate(draftRow, raw);
  if (row.status !== "complete") conflict("CONFLICT", "This draft is not complete. Start a new draft after checking its status.");
  const draft = validate(negotiationDraftSchema, row.data);
  if (draft.id !== row.id || draft.requestId !== row.request_id || draft.sourceRevision !== row.source_revision
    || draft.reviewRevision !== row.review_revision || draft.impactHash !== row.impact_hash || draft.style !== row.style) return invalidRecord();
  return draft;
}

/** All child queries join the owner project. Pending AI claims are committed before the provider is called. */
export class PostgresRealProjectRepository {
  constructor(private readonly sql: SqlClient) {}

  private async query(text: string, values: unknown[]) {
    try { return await this.sql.query(text, values); }
    catch { throw new RealProjectError(503, "STORAGE_UNAVAILABLE", "Saved real project data is unavailable. Please retry later."); }
  }

  async listProjects(scope: string): Promise<RealProjectSummary[]> {
    const rows = await this.query("SELECT id, revision, data - 'documents' AS data FROM scopeshift_real_projects WHERE scope_hash = $1 ORDER BY updated_at DESC, id DESC LIMIT 10", [realProjectScopeHash(scope)]);
    return rows.rows.map((raw) => {
      const row = validate(projectRow, raw);
      const summary = validate(realProjectSummarySchema, row.data);
      if (summary.id !== row.id || summary.sourceRevision !== row.revision) return invalidRecord();
      return summary;
    });
  }

  async getProject(scope: string, projectId: string): Promise<RealProject> {
    const result = await this.query("SELECT id, revision, data FROM scopeshift_real_projects WHERE id = $1 AND scope_hash = $2", [uuid.parse(projectId), realProjectScopeHash(scope)]);
    return result.rows.length ? readProject(result.rows[0]) : missing();
  }

  async createProject(scope: string, input: RealProject): Promise<RealProject> {
    const project = validate(realProjectSchema, input);
    if (project.sourceRevision !== 1) conflict("CONFLICT", "A new project must begin at source revision one.");
    const hash = realProjectScopeHash(scope);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const result = await this.query(`
        WITH vacant AS (
          SELECT s AS slot FROM generate_series(1, 10) s
          WHERE NOT EXISTS (SELECT 1 FROM scopeshift_real_projects p WHERE p.scope_hash = $2 AND p.slot = s)
          ORDER BY s LIMIT 1
        )
        INSERT INTO scopeshift_real_projects (id, scope_hash, slot, revision, data, created_at, updated_at)
        SELECT $1, $2, vacant.slot, 1, $3::jsonb, $4::timestamptz, $4::timestamptz FROM vacant
        ON CONFLICT DO NOTHING RETURNING id, revision, data
      `, [project.id, hash, JSON.stringify(project), project.createdAt]);
      if (result.rows.length) return readProject(result.rows[0]);
    }
    throw new RealProjectError(409, "LIMIT_REACHED", "This anonymous session can save up to ten real projects.");
  }

  async updateProject(scope: string, projectId: string, expectedSourceRevision: number, input: RealProject): Promise<RealProject> {
    const project = validate(realProjectSchema, input);
    if (project.id !== projectId || project.sourceRevision !== expectedSourceRevision + 1) conflict("CONFLICT", "The new source revision is inconsistent.");
    const result = await this.query(`UPDATE scopeshift_real_projects SET revision = $3, data = $4::jsonb, updated_at = $5::timestamptz
      WHERE id = $1 AND scope_hash = $2 AND revision = $6 RETURNING id, revision, data`,
    [uuid.parse(projectId), realProjectScopeHash(scope), project.sourceRevision, JSON.stringify(project), project.updatedAt, expectedSourceRevision]);
    if (result.rows.length) return readProject(result.rows[0]);
    await this.getProject(scope, projectId);
    return conflict("STALE_SOURCE", "The project changed. Reload the current agreement before editing it.");
  }

  async deleteProject(scope: string, projectId: string): Promise<void> {
    const result = await this.query("DELETE FROM scopeshift_real_projects WHERE id = $1 AND scope_hash = $2 RETURNING id", [uuid.parse(projectId), realProjectScopeHash(scope)]);
    if (!result.rows.length) missing();
  }

  private async requestRows(args: RequestScope) {
    return this.query(`SELECT r.id, r.project_id, r.source_revision, r.input_hash, r.status, r.owner_token, r.data
      FROM scopeshift_real_requests r JOIN scopeshift_real_projects p ON p.id = r.project_id
      WHERE r.id = $1 AND p.id = $2 AND p.scope_hash = $3`, [uuid.parse(args.requestId), uuid.parse(args.projectId), realProjectScopeHash(args.scope)]);
  }

  async getRequest(args: RequestScope): Promise<RealClientRequest> {
    const rows = await this.requestRows(args);
    return rows.rows.length ? readRequest(rows.rows[0]) : missing();
  }

  async listRequests(scope: string, projectId: string): Promise<RealClientRequest[]> {
    await this.getProject(scope, projectId);
    const result = await this.query(`SELECT r.id, r.project_id, r.source_revision, r.input_hash, r.status, r.owner_token, r.data
      FROM scopeshift_real_requests r JOIN scopeshift_real_projects p ON p.id = r.project_id
      WHERE p.id = $1 AND p.scope_hash = $2 ORDER BY r.created_at DESC, r.id DESC LIMIT 20`, [uuid.parse(projectId), realProjectScopeHash(scope)]);
    const records: RealClientRequest[] = [];
    let bytes = 32;
    for (const row of result.rows) {
      const record = readRequest(row);
      const size = Buffer.byteLength(JSON.stringify(record), "utf8");
      if (bytes + size > MAX_HISTORY_BYTES) continue;
      records.push(record); bytes += size;
    }
    return records;
  }

  async claimRequest(args: RequestScope & { inputHash: string; record: RealClientRequest }): Promise<RequestClaim> {
    const request = checkRequest(validate(realClientRequestSchema, args.record));
    if (request.id !== args.requestId || request.projectId !== args.projectId || request.status !== "pending") return invalidRecord();
    digest.parse(args.inputHash);
    const project = await this.getProject(args.scope, args.projectId);
    if (project.sourceRevision !== request.sourceRevision) conflict("STALE_SOURCE", "The agreement changed before analysis began. Reload and start a new request.");
    const owner = randomUUID();
    const hash = realProjectScopeHash(args.scope);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const existing = await this.requestRows(args);
      if (existing.rows.length) {
        const row = validate(requestRow, existing.rows[0]);
        if (row.input_hash !== args.inputHash || row.source_revision !== request.sourceRevision) conflict("IDEMPOTENCY_CONFLICT", "This request ID belongs to different text or a different source revision. Use a new request ID.");
        return { created: false, ownerToken: null, request: readRequest(row) };
      }
      const result = await this.query(`
        WITH owned AS (SELECT id FROM scopeshift_real_projects WHERE id = $2 AND scope_hash = $3 AND revision = $4 FOR UPDATE),
        vacant AS (SELECT s AS slot FROM generate_series(1, 20) s WHERE NOT EXISTS
          (SELECT 1 FROM scopeshift_real_requests r WHERE r.project_id = $2 AND r.slot = s) ORDER BY s LIMIT 1)
        INSERT INTO scopeshift_real_requests (id, project_id, slot, source_revision, input_hash, status, owner_token, data, created_at, updated_at)
        SELECT $1, owned.id, vacant.slot, $4, $5, 'pending', $6, $7::jsonb, $8::timestamptz, $8::timestamptz FROM owned CROSS JOIN vacant
        ON CONFLICT DO NOTHING RETURNING id, project_id, source_revision, input_hash, status, owner_token, data
      `, [request.id, request.projectId, hash, request.sourceRevision, args.inputHash, owner, JSON.stringify(request), request.createdAt]);
      if (result.rows.length) return { created: true, ownerToken: owner, request: readRequest(result.rows[0]) };
      const current = await this.getProject(args.scope, args.projectId);
      if (current.sourceRevision !== request.sourceRevision) conflict("STALE_SOURCE", "The agreement changed before analysis began. Reload and start a new request.");
      const usage = await this.query(`SELECT count(*)::int AS count FROM scopeshift_real_requests r JOIN scopeshift_real_projects p ON p.id = r.project_id
        WHERE p.id = $1 AND p.scope_hash = $2`, [args.projectId, hash]);
      if (Number(usage.rows[0]?.count) >= 20) throw new RealProjectError(409, "LIMIT_REACHED", "This project can save up to twenty client requests.");
    }
    return missing();
  }

  async completeAnalysis(args: RequestScope & { ownerToken: string; analysis: ScopeAnalysis }): Promise<RealClientRequest> {
    const current = await this.getRequest(args);
    const analysis = validate(scopeAnalysisSchema, args.analysis);
    if (analysis.sourceRevision !== current.sourceRevision) conflict("STALE_SOURCE", "The analysis belongs to another agreement revision.");
    const request = checkRequest(validate(realClientRequestSchema, { ...current, status: "ready", analysis, error: null, updatedAt: now() }));
    const result = await this.query(`WITH owned AS (SELECT id, revision FROM scopeshift_real_projects WHERE id = $2 AND scope_hash = $3 FOR UPDATE)
      UPDATE scopeshift_real_requests r SET status = 'ready', data = $5::jsonb, updated_at = $6::timestamptz
      FROM owned p WHERE r.id = $1 AND r.project_id = p.id
      AND r.owner_token = $4 AND r.status = 'pending' AND p.revision = r.source_revision
      RETURNING r.id, r.project_id, r.source_revision, r.input_hash, r.status, r.owner_token, r.data`,
    [args.requestId, args.projectId, realProjectScopeHash(args.scope), uuid.parse(args.ownerToken), JSON.stringify(request), request.updatedAt]);
    if (result.rows.length) return readRequest(result.rows[0]);
    await this.assertCurrentSource(args);
    return conflict("CONFLICT", "This analysis is no longer owned by the current operation.");
  }

  async failAnalysis(args: RequestScope & { ownerToken: string; error: { code: string; message: string } }): Promise<void> {
    const current = await this.getRequest(args);
    const error = validate(realApiErrorSchema.shape.error, args.error);
    const request = checkRequest(validate(realClientRequestSchema, { ...current, status: "failed", error, updatedAt: now() }));
    const result = await this.query(`UPDATE scopeshift_real_requests r SET status = 'failed', data = $5::jsonb, updated_at = $6::timestamptz
      FROM scopeshift_real_projects p WHERE r.id = $1 AND r.project_id = p.id AND p.id = $2 AND p.scope_hash = $3
      AND r.owner_token = $4 AND r.status = 'pending' RETURNING r.id`,
    [args.requestId, args.projectId, realProjectScopeHash(args.scope), uuid.parse(args.ownerToken), JSON.stringify(request), request.updatedAt]);
    if (!result.rows.length) { await this.getRequest(args); conflict("CONFLICT", "This analysis operation is no longer pending."); }
  }

  private async assertCurrentSource(args: RequestScope): Promise<RealClientRequest> {
    const request = await this.getRequest(args);
    const project = await this.getProject(args.scope, args.projectId);
    if (project.sourceRevision !== request.sourceRevision) conflict("STALE_SOURCE", "The agreement changed. Start a new analysis before confirming or calculating this request.");
    return request;
  }

  private async assertReview(args: RequestScope, expectedRevision: number, impactHash?: string): Promise<RealClientRequest> {
    const request = await this.assertCurrentSource(args);
    if (!request.review || request.status !== "confirmed") throw new RealProjectError(409, "REVIEW_REQUIRED", "Confirm the scope analysis before calculating or drafting.");
    if (request.review.revision !== expectedRevision) conflict("STALE_REVIEW", "The confirmed interpretation changed. Reload before continuing.");
    if (impactHash !== undefined && (!request.impact || request.impactHash !== impactHash)) conflict("STALE_REVIEW", "The proposed financial impact changed. Calculate again before drafting.");
    return request;
  }

  async saveReview(args: RequestScope & { expectedReviewRevision: number; review: ScopeReview }): Promise<RealClientRequest> {
    const current = await this.assertCurrentSource(args);
    if (!current.analysis) throw new RealProjectError(409, "REVIEW_REQUIRED", "Complete an analysis before confirming it.");
    const review = validate(scopeReviewSchema, args.review);
    if (review.sourceRevision !== current.sourceRevision) conflict("STALE_SOURCE", "The review belongs to another agreement revision.");
    if ((current.review?.revision ?? 0) !== args.expectedReviewRevision || review.revision !== args.expectedReviewRevision + 1) conflict("STALE_REVIEW", "The review changed. Reload the latest interpretation.");
    const request = checkRequest(validate(realClientRequestSchema, { ...current, status: "confirmed", review, impact: null, impactHash: null, error: null, updatedAt: now() }));
    const result = await this.query(`WITH owned AS (SELECT id, revision FROM scopeshift_real_projects WHERE id = $2 AND scope_hash = $3 FOR UPDATE)
      UPDATE scopeshift_real_requests r SET status = 'confirmed', data = $5::jsonb, updated_at = $6::timestamptz
      FROM owned p WHERE r.id = $1 AND r.project_id = p.id
      AND p.revision = r.source_revision AND r.status IN ('ready', 'confirmed')
      AND COALESCE(r.data->'review'->>'revision', '0') = $4::text
      RETURNING r.id, r.project_id, r.source_revision, r.input_hash, r.status, r.owner_token, r.data`,
    [args.requestId, args.projectId, realProjectScopeHash(args.scope), args.expectedReviewRevision, JSON.stringify(request), request.updatedAt]);
    if (result.rows.length) return readRequest(result.rows[0]);
    await this.assertCurrentSource(args);
    return conflict("STALE_REVIEW", "The review changed while this confirmation was being saved.");
  }

  async saveImpact(args: RequestScope & { expectedReviewRevision: number; impact: FinancialImpact; impactHash: string }): Promise<RealClientRequest> {
    const current = await this.assertReview(args, args.expectedReviewRevision);
    const impact = validate(financialImpactSchema, args.impact);
    digest.parse(args.impactHash);
    if (impact.sourceRevision !== current.sourceRevision || impact.reviewRevision !== args.expectedReviewRevision) conflict("STALE_REVIEW", "The calculation belongs to another confirmed interpretation.");
    const request = checkRequest(validate(realClientRequestSchema, { ...current, impact, impactHash: args.impactHash, updatedAt: now() }));
    const result = await this.query(`WITH owned AS (SELECT id, revision FROM scopeshift_real_projects WHERE id = $2 AND scope_hash = $3 FOR UPDATE)
      UPDATE scopeshift_real_requests r SET data = $5::jsonb, updated_at = $6::timestamptz
      FROM owned p WHERE r.id = $1 AND r.project_id = p.id
      AND p.revision = r.source_revision AND r.status = 'confirmed' AND r.data->'review'->>'revision' = $4::text
      RETURNING r.id, r.project_id, r.source_revision, r.input_hash, r.status, r.owner_token, r.data`,
    [args.requestId, args.projectId, realProjectScopeHash(args.scope), args.expectedReviewRevision, JSON.stringify(request), request.updatedAt]);
    if (result.rows.length) return readRequest(result.rows[0]);
    await this.assertCurrentSource(args);
    return conflict("STALE_REVIEW", "The confirmed interpretation changed while the impact was saved.");
  }

  private async draftRows(args: RequestScope & { draftId?: string }, completeOnly = false) {
    return this.query(`SELECT d.id, d.request_id, d.source_revision, d.review_revision, d.impact_hash, d.input_hash, d.style, d.status, d.owner_token, d.data, d.error
      FROM scopeshift_real_drafts d JOIN scopeshift_real_requests r ON r.id = d.request_id JOIN scopeshift_real_projects p ON p.id = r.project_id
      WHERE p.id = $1 AND p.scope_hash = $2 AND r.id = $3 ${args.draftId ? "AND d.id = $4" : ""} ${completeOnly ? "AND d.status = 'complete'" : ""}
      ORDER BY d.created_at DESC, d.id DESC LIMIT 20`, [uuid.parse(args.projectId), realProjectScopeHash(args.scope), uuid.parse(args.requestId), ...(args.draftId ? [uuid.parse(args.draftId)] : [])]);
  }

  async getDraft(args: RequestScope & { draftId: string }): Promise<NegotiationDraft> {
    const result = await this.draftRows(args);
    if (!result.rows.length) return missing();
    const draft = readDraft(result.rows[0]);
    if (draft.projectId !== args.projectId) return invalidRecord();
    return draft;
  }

  async listDrafts(args: RequestScope): Promise<NegotiationDraft[]> {
    await this.getRequest(args);
    const result = await this.draftRows(args, true);
    return result.rows.map((raw) => { const draft = readDraft(raw); if (draft.projectId !== args.projectId) return invalidRecord(); return draft; });
  }

  async claimDraft(args: RequestScope & { draftId: string; inputHash: string; sourceRevision: number; reviewRevision: number; impactHash: string; style: DraftStyle }): Promise<DraftClaim> {
    const current = await this.assertReview(args, args.reviewRevision, args.impactHash);
    if (current.sourceRevision !== args.sourceRevision) conflict("STALE_SOURCE", "The draft belongs to another agreement revision.");
    digest.parse(args.inputHash); digest.parse(args.impactHash); draftStyleSchema.parse(args.style);
    const owner = randomUUID();
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const existing = await this.draftRows(args);
      if (existing.rows.length) {
        const row = validate(draftRow, existing.rows[0]);
        if (row.input_hash !== args.inputHash || row.review_revision !== args.reviewRevision || row.impact_hash !== args.impactHash || row.style !== args.style) conflict("IDEMPOTENCY_CONFLICT", "This draft ID belongs to different terms or a different style. Use a new draft ID.");
        return { created: false, ownerToken: null, status: row.status, draft: row.status === "complete" ? readDraft(row) : null, error: row.error ? validate(realApiErrorSchema.shape.error, row.error) : null };
      }
      const result = await this.query(`WITH owned AS (
          SELECT r.id FROM scopeshift_real_requests r JOIN scopeshift_real_projects p ON p.id = r.project_id
          WHERE p.id = $2 AND p.scope_hash = $3 AND r.id = $4 AND p.revision = $5 AND r.source_revision = $5
          AND r.status = 'confirmed' AND r.data->'review'->>'revision' = $6::text AND r.data->>'impactHash' = $7 FOR UPDATE OF p, r
        ), vacant AS (SELECT s AS slot FROM generate_series(1, 20) s WHERE NOT EXISTS
          (SELECT 1 FROM scopeshift_real_drafts d WHERE d.request_id = $4 AND d.slot = s) ORDER BY s LIMIT 1)
        INSERT INTO scopeshift_real_drafts (id, request_id, slot, source_revision, review_revision, impact_hash, input_hash, style, status, owner_token)
        SELECT $1, owned.id, vacant.slot, $5, $6::int, $7, $8, $9, 'pending', $10 FROM owned CROSS JOIN vacant
        ON CONFLICT DO NOTHING RETURNING id
      `, [uuid.parse(args.draftId), args.projectId, realProjectScopeHash(args.scope), args.requestId, args.sourceRevision, args.reviewRevision, args.impactHash, args.inputHash, args.style, owner]);
      if (result.rows.length) return { created: true, ownerToken: owner, status: "pending", draft: null, error: null };
      await this.assertReview(args, args.reviewRevision, args.impactHash);
      const usage = await this.query(`SELECT count(*)::int AS count FROM scopeshift_real_drafts d JOIN scopeshift_real_requests r ON r.id = d.request_id
        JOIN scopeshift_real_projects p ON p.id = r.project_id WHERE p.id = $1 AND p.scope_hash = $2 AND r.id = $3`,
      [args.projectId, realProjectScopeHash(args.scope), args.requestId]);
      if (Number(usage.rows[0]?.count) >= 20) throw new RealProjectError(409, "LIMIT_REACHED", "This request can save up to twenty draft generations.");
    }
    return missing();
  }

  async completeDraft(args: RequestScope & { draftId: string; ownerToken: string; draft: NegotiationDraft }): Promise<NegotiationDraft> {
    const draft = validate(negotiationDraftSchema, args.draft);
    if (draft.id !== args.draftId || draft.projectId !== args.projectId || draft.requestId !== args.requestId) return invalidRecord();
    const result = await this.query(`WITH owned AS (
        SELECT r.id, r.source_revision, r.status, r.data, p.revision AS project_revision
        FROM scopeshift_real_requests r JOIN scopeshift_real_projects p ON p.id = r.project_id
        WHERE r.id = $2 AND p.id = $3 AND p.scope_hash = $4 FOR UPDATE OF p, r
      ) UPDATE scopeshift_real_drafts d SET status = 'complete', data = $6::jsonb, updated_at = $7::timestamptz
      FROM owned r WHERE d.id = $1 AND d.request_id = r.id
      AND d.owner_token = $5 AND d.status = 'pending' AND r.project_revision = d.source_revision AND r.source_revision = d.source_revision
      AND d.source_revision = $8 AND d.review_revision = $9 AND d.impact_hash = $10 AND d.style = $11
      AND r.status = 'confirmed' AND r.data->'review'->>'revision' = d.review_revision::text AND r.data->>'impactHash' = d.impact_hash
      RETURNING d.id, d.request_id, d.source_revision, d.review_revision, d.impact_hash, d.input_hash, d.style, d.status, d.owner_token, d.data, d.error`,
    [args.draftId, args.requestId, args.projectId, realProjectScopeHash(args.scope), uuid.parse(args.ownerToken), JSON.stringify(draft), draft.updatedAt, draft.sourceRevision, draft.reviewRevision, draft.impactHash, draft.style]);
    if (result.rows.length) return readDraft(result.rows[0]);
    await this.assertReview(args, draft.reviewRevision, draft.impactHash);
    return conflict("CONFLICT", "This draft is no longer owned by the current operation.");
  }

  async failDraft(args: RequestScope & { draftId: string; ownerToken: string; error: { code: string; message: string } }): Promise<void> {
    const error = validate(realApiErrorSchema.shape.error, args.error);
    const result = await this.query(`UPDATE scopeshift_real_drafts d SET status = 'failed', error = $6::jsonb, updated_at = now()
      FROM scopeshift_real_requests r JOIN scopeshift_real_projects p ON p.id = r.project_id
      WHERE d.id = $1 AND d.request_id = r.id AND r.id = $2 AND p.id = $3 AND p.scope_hash = $4
      AND d.owner_token = $5 AND d.status = 'pending' RETURNING d.id`,
    [args.draftId, args.requestId, args.projectId, realProjectScopeHash(args.scope), uuid.parse(args.ownerToken), JSON.stringify(error)]);
    if (!result.rows.length) { await this.getRequest(args); conflict("CONFLICT", "This draft operation is no longer pending."); }
  }

  async editDraft(args: RequestScope & { draftId: string; body: string; expectedUpdatedAt?: string }): Promise<NegotiationDraft> {
    const current = await this.getDraft(args);
    await this.assertReview(args, current.reviewRevision, current.impactHash);
    // The timestamp is also the edit token. Advance it even for two edits within one millisecond.
    const updatedAt = new Date(Math.max(Date.now(), Date.parse(current.updatedAt) + 1)).toISOString();
    const draft = validate(negotiationDraftSchema, { ...current, body: args.body, updatedAt });
    const result = await this.query(`WITH owned AS (
        SELECT r.id, r.source_revision, r.status, r.data, p.revision AS project_revision
        FROM scopeshift_real_requests r JOIN scopeshift_real_projects p ON p.id = r.project_id
        WHERE r.id = $2 AND p.id = $3 AND p.scope_hash = $4 FOR UPDATE OF p, r
      ) UPDATE scopeshift_real_drafts d SET data = $5::jsonb, updated_at = $6::timestamptz
      FROM owned r WHERE d.id = $1 AND d.request_id = r.id AND d.status = 'complete'
      AND r.project_revision = d.source_revision AND r.source_revision = d.source_revision AND r.status = 'confirmed'
      AND r.data->'review'->>'revision' = d.review_revision::text AND r.data->>'impactHash' = d.impact_hash
      AND d.data->>'updatedAt' = $7
      RETURNING d.id, d.request_id, d.source_revision, d.review_revision, d.impact_hash, d.input_hash, d.style, d.status, d.owner_token, d.data, d.error`,
    [args.draftId, args.requestId, args.projectId, realProjectScopeHash(args.scope), JSON.stringify(draft), draft.updatedAt, args.expectedUpdatedAt ?? current.updatedAt]);
    if (result.rows.length) return readDraft(result.rows[0]);
    await this.assertReview(args, current.reviewRevision, current.impactHash);
    return conflict("CONFLICT", "The draft changed. Reload it before saving your edits.");
  }
}
