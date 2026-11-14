import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { NegotiationDraft, RealClientRequest, RealProject, ScopeReview } from "@/types/real-project";
import type { SqlClient } from "@/lib/simulation/postgres-types";
import { calculateFinancialImpact } from "./finance";
import { PostgresRealProjectRepository, realProjectScopeHash } from "./repository";
import { buildRealProject, createSourceDocument, groundScopeAnalysis, hashRealInput } from "./source";

const scope = "repository-test-private-session";
const inputHash = "1".repeat(64);
const impactHash = "2".repeat(64);
const draftInputHash = "3".repeat(64);
const ownerToken = randomUUID();
type Row = Record<string, unknown>;

function queued(...responses: Row[][]) {
  const query = vi.fn<SqlClient["query"]>();
  responses.forEach((rows) => query.mockResolvedValueOnce({ rows, rowCount: rows.length }));
  return { query };
}

function fixtures() {
  const project = buildRealProject({ name: "Synthetic website", originalFeeCents: 150_000, originalEstimatedHours: 20,
    originalDeadline: "2026-11-20", agreementText: "Build a website. Booking is excluded." });
  const clientMessage = "Please add consultation booking.";
  const requestDocument = createSourceDocument(clientMessage, "client_request", "Client request");
  const passage = project.documents[0].passages[0];
  const requestPassage = requestDocument.passages[0];
  const analysis = groundScopeAnalysis({ summary: "Booking is outside the stated agreement.", limitations: [], items: [{
    title: "Consultation booking", requestedWork: clientMessage, classification: "excluded",
    contractEvidence: [{ documentId: project.documents[0].id, passageId: passage.id, quote: "Booking is excluded." }],
    requestEvidence: [{ documentId: requestDocument.id, passageId: requestPassage.id, quote: clientMessage }],
    explanation: "The agreement explicitly excludes booking.", unknowns: [], clarificationQuestions: [],
  }] }, project, requestDocument);
  const request: RealClientRequest = { id: randomUUID(), projectId: project.id, clientMessage, sourceRevision: 1,
    projectSnapshot: project, requestDocument, status: "pending", analysis: null, review: null, impact: null,
    impactHash: null, error: null, createdAt: project.createdAt, updatedAt: project.updatedAt };
  const review: ScopeReview = { revision: 1, sourceRevision: 1,
    items: [{ itemId: analysis.items[0].id, classification: "excluded", reason: "Confirmed against the agreement." }],
    confirmedAt: project.createdAt };
  const impact = calculateFinancialImpact(project, { reviewRevision: 1, selectedItemIds: [analysis.items[0].id],
    additionalEstimatedHours: 6, removedScope: [], pricing: { mode: "fixed", feeDeltaCents: 40_000 },
    additionalExpensesCents: 0, deadlineExtensionDays: 2, assumptions: [] }, review);
  const ready: RealClientRequest = { ...request, status: "ready", analysis };
  const confirmed: RealClientRequest = { ...ready, status: "confirmed", review, impact, impactHash };
  const draft: NegotiationDraft = { id: randomUUID(), projectId: project.id, requestId: request.id, sourceRevision: 1,
    reviewRevision: 1, impactHash, style: "professional", generatedBody: "I propose an additional $400 and two days.",
    body: "I propose an additional $400 and two days.", status: "proposed", createdAt: project.createdAt, updatedAt: project.updatedAt };
  return { project, request, ready, confirmed, analysis, review, impact, draft, args: { scope, projectId: project.id, requestId: request.id } };
}

const projectRow = (project: RealProject): Row => ({ id: project.id, revision: project.sourceRevision, data: project });
const requestRow = (request: RealClientRequest, hash = inputHash): Row => ({ id: request.id, project_id: request.projectId,
  source_revision: request.sourceRevision, input_hash: hash, status: request.status, owner_token: ownerToken, data: request });
const draftRow = (draft: NegotiationDraft, status: "pending" | "complete" | "failed" = "complete"): Row => ({ id: draft.id,
  request_id: draft.requestId, source_revision: draft.sourceRevision, review_revision: draft.reviewRevision, impact_hash: draft.impactHash,
  input_hash: draftInputHash, style: draft.style, status, owner_token: ownerToken, data: status === "complete" ? draft : null,
  error: status === "failed" ? { code: "AI_UNAVAILABLE", message: "Draft generation is unavailable." } : null });

describe("Postgres real project repository", () => {
  it("lists bounded summaries and does not load agreement text into the list query", async () => {
    const { project } = fixtures();
    const { documents: _documents, ...summary } = project;
    void _documents;
    const sql = queued([{ id: project.id, revision: 1, data: summary }]);
    await expect(new PostgresRealProjectRepository(sql).listProjects(scope)).resolves.toEqual([summary]);
    expect(sql.query.mock.calls[0][0]).toContain("data - 'documents'");
    expect(sql.query.mock.calls[0][1]).toEqual([realProjectScopeHash(scope)]);
    expect(sql.query.mock.calls[0][0]).toContain("LIMIT 10");
  });

  it("returns the same 404 for an absent or differently owned project", async () => {
    const { project } = fixtures();
    const sql = queued([]);
    await expect(new PostgresRealProjectRepository(sql).getProject("other-session", project.id)).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
    expect(sql.query.mock.calls[0][1]).toEqual([project.id, realProjectScopeHash("other-session")]);
    expect(sql.query.mock.calls[0][0]).toContain("scope_hash = $2");
  });

  it("never forwards database exception details or connection secrets", async () => {
    const { project } = fixtures();
    const sql = queued();
    sql.query.mockRejectedValueOnce(new Error("postgres://owner:private-password@db:5432/contracts - secret contract body"));
    await expect(new PostgresRealProjectRepository(sql).getProject(scope, project.id)).rejects.toMatchObject({ code: "STORAGE_UNAVAILABLE", status: 503 });
    sql.query.mockRejectedValueOnce(new Error("private-password"));
    await expect(new PostgresRealProjectRepository(sql).getProject(scope, project.id)).rejects.not.toThrow(/password/);
  });

  it("rejects a stored record whose metadata does not match its validated JSON", async () => {
    const { request } = fixtures();
    const sql = queued([{ ...requestRow(request), source_revision: 2 }]);
    await expect(new PostgresRealProjectRepository(sql).getRequest({ scope, projectId: request.projectId, requestId: request.id })).rejects.toMatchObject({ code: "STORAGE_UNAVAILABLE" });
  });

  it("creates projects with a database enforced owner quota", async () => {
    const { project } = fixtures();
    const sql = queued([projectRow(project)]);
    await expect(new PostgresRealProjectRepository(sql).createProject(scope, project)).resolves.toEqual(project);
    expect(sql.query.mock.calls[0][0]).toContain("generate_series(1, 10)");
    expect(sql.query.mock.calls[0][1]?.[1]).toBe(realProjectScopeHash(scope));
    expect(sql.query.mock.calls[0][1]).not.toContain(scope);
  });

  it("compares source revision when saving an edited agreement", async () => {
    const { project } = fixtures();
    const edited = { ...project, sourceRevision: 2 };
    const sql = queued([], [projectRow(edited)]);
    await expect(new PostgresRealProjectRepository(sql).updateProject(scope, project.id, 1, edited)).rejects.toMatchObject({ code: "STALE_SOURCE" });
    expect(sql.query.mock.calls[0][0]).toContain("revision = $6");
    expect(sql.query.mock.calls[0][1]?.[5]).toBe(1);
  });

  it("deletes only an owned project and relies on cascade for all private children", async () => {
    const { project } = fixtures();
    const sql = queued([{ id: project.id }]);
    await new PostgresRealProjectRepository(sql).deleteProject(scope, project.id);
    expect(sql.query.mock.calls[0][0]).toMatch(/DELETE FROM scopeshift_real_projects WHERE id = \$1 AND scope_hash = \$2/);
    expect(sql.query.mock.calls[0][1]).toEqual([project.id, realProjectScopeHash(scope)]);
  });

  it("claims and commits a pending analysis before returning the provider owner nonce", async () => {
    const { project, request, args } = fixtures();
    const sql = queued([projectRow(project)], [], [requestRow(request)]);
    const claim = await new PostgresRealProjectRepository(sql).claimRequest({ ...args, inputHash, record: request });
    expect(claim.created).toBe(true);
    expect(claim.ownerToken).toMatch(/^[a-f0-9-]{36}$/);
    expect(sql.query.mock.calls[2][0]).toContain("'pending'");
    expect(sql.query.mock.calls[2][0]).toContain("FOR UPDATE");
    expect(sql.query.mock.calls[2][1]?.[5]).toBe(claim.ownerToken);
    expect(JSON.parse(String(sql.query.mock.calls[2][1]?.[6]))).toMatchObject({ analysis: null, impact: null, status: "pending" });
  });

  it("returns an existing pending analysis without creating or taking over an AI call", async () => {
    const { project, request, args } = fixtures();
    const sql = queued([projectRow(project)], [requestRow(request)]);
    await expect(new PostgresRealProjectRepository(sql).claimRequest({ ...args, inputHash, record: request })).resolves.toEqual({ created: false, ownerToken: null, request });
    expect(sql.query).toHaveBeenCalledTimes(2);
  });

  it("rejects changed input under a reused request ID", async () => {
    const { project, request, args } = fixtures();
    const sql = queued([projectRow(project)], [requestRow(request)]);
    await expect(new PostgresRealProjectRepository(sql).claimRequest({ ...args, inputHash: hashRealInput("changed"), record: request })).rejects.toMatchObject({ status: 409, code: "IDEMPOTENCY_CONFLICT" });
    expect(sql.query).toHaveBeenCalledTimes(2);
  });

  it("rejects an analysis claim on an obsolete source before inserting or using AI", async () => {
    const { project, request, args } = fixtures();
    const sql = queued([projectRow({ ...project, sourceRevision: 2 })]);
    await expect(new PostgresRealProjectRepository(sql).claimRequest({ ...args, inputHash, record: request })).rejects.toMatchObject({ code: "STALE_SOURCE" });
    expect(sql.query).toHaveBeenCalledTimes(1);
  });

  it("completes only a still pending analysis held by its operation owner", async () => {
    const { request, ready, analysis, args } = fixtures();
    const sql = queued([requestRow(request)], [requestRow(ready)]);
    await expect(new PostgresRealProjectRepository(sql).completeAnalysis({ ...args, ownerToken, analysis })).resolves.toEqual(ready);
    const [query, values] = sql.query.mock.calls[1];
    expect(query).toContain("r.owner_token = $4");
    expect(query).toContain("r.status = 'pending'");
    expect(query).toContain("p.revision = r.source_revision");
    expect(values?.[3]).toBe(ownerToken);
  });

  it("does not recreate a deleted project when its in-flight analysis finishes", async () => {
    const { request, analysis, args } = fixtures();
    const sql = queued([requestRow(request)], [], []);
    await expect(new PostgresRealProjectRepository(sql).completeAnalysis({ ...args, ownerToken, analysis })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(sql.query.mock.calls.some(([query]) => /INSERT/i.test(query))).toBe(false);
  });

  it("blocks completion if the agreement changed during inference", async () => {
    const { project, request, analysis, args } = fixtures();
    const sql = queued([requestRow(request)], [], [requestRow(request)], [projectRow({ ...project, sourceRevision: 2 })]);
    await expect(new PostgresRealProjectRepository(sql).completeAnalysis({ ...args, ownerToken, analysis })).rejects.toMatchObject({ code: "STALE_SOURCE" });
  });

  it("reconfirming the analysis invalidates the old financial impact atomically", async () => {
    const { project, confirmed, review, args } = fixtures();
    const nextReview = { ...review, revision: 2 };
    const next: RealClientRequest = { ...confirmed, review: nextReview, impact: null, impactHash: null };
    const sql = queued([requestRow(confirmed)], [projectRow(project)], [requestRow(next)]);
    await expect(new PostgresRealProjectRepository(sql).saveReview({ ...args, expectedReviewRevision: 1, review: nextReview })).resolves.toEqual(next);
    expect(JSON.parse(String(sql.query.mock.calls[2][1]?.[4]))).toMatchObject({ impact: null, impactHash: null, review: { revision: 2 } });
    expect(sql.query.mock.calls[2][0]).toContain("COALESCE(r.data->'review'->>'revision', '0') = $4::text");
  });

  it("rejects a stale confirmation rather than overwrite another review", async () => {
    const { project, confirmed, review, args } = fixtures();
    const sql = queued([requestRow(confirmed)], [projectRow(project)]);
    await expect(new PostgresRealProjectRepository(sql).saveReview({ ...args, expectedReviewRevision: 0, review })).rejects.toMatchObject({ code: "STALE_REVIEW" });
    expect(sql.query).toHaveBeenCalledTimes(2);
  });

  it("requires explicit review before any financial impact can be saved", async () => {
    const { project, ready, impact, args } = fixtures();
    const sql = queued([requestRow(ready)], [projectRow(project)]);
    await expect(new PostgresRealProjectRepository(sql).saveImpact({ ...args, expectedReviewRevision: 1, impact, impactHash })).rejects.toMatchObject({ code: "REVIEW_REQUIRED" });
  });

  it("binds the saved impact to the source and confirmed review", async () => {
    const { project, confirmed, impact, args } = fixtures();
    const sql = queued([requestRow(confirmed)], [projectRow(project)], [requestRow(confirmed)]);
    await new PostgresRealProjectRepository(sql).saveImpact({ ...args, expectedReviewRevision: 1, impact, impactHash });
    expect(sql.query.mock.calls[2][0]).toContain("r.data->'review'->>'revision' = $4::text");
    expect(sql.query.mock.calls[2][0]).toContain("FOR UPDATE");
  });

  it("reuses a committed draft without paying for a second generation", async () => {
    const { project, confirmed, draft, args } = fixtures();
    const sql = queued([requestRow(confirmed)], [projectRow(project)], [draftRow(draft)]);
    await expect(new PostgresRealProjectRepository(sql).claimDraft({ ...args, draftId: draft.id, inputHash: draftInputHash,
      sourceRevision: 1, reviewRevision: 1, impactHash, style: "professional" })).resolves.toMatchObject({ created: false, ownerToken: null, status: "complete", draft });
    expect(sql.query).toHaveBeenCalledTimes(3);
  });

  it("keeps pending draft claims bodyless and does not take over a pending generation", async () => {
    const { project, confirmed, draft, args } = fixtures();
    const sql = queued([requestRow(confirmed)], [projectRow(project)], [draftRow(draft, "pending")]);
    await expect(new PostgresRealProjectRepository(sql).claimDraft({ ...args, draftId: draft.id, inputHash: draftInputHash,
      sourceRevision: 1, reviewRevision: 1, impactHash, style: "professional" })).resolves.toMatchObject({ created: false, ownerToken: null, status: "pending", draft: null });
  });

  it("invalidates a draft completion when the confirmed review changes during inference", async () => {
    const { project, confirmed, draft, review, args } = fixtures();
    const changed = { ...confirmed, review: { ...review, revision: 2 }, impact: null, impactHash: null };
    const sql = queued([], [requestRow(changed)], [projectRow(project)]);
    await expect(new PostgresRealProjectRepository(sql).completeDraft({ ...args, draftId: draft.id, ownerToken, draft })).rejects.toMatchObject({ code: "STALE_REVIEW" });
    expect(sql.query.mock.calls[0][0]).toContain("r.data->>'impactHash' = d.impact_hash");
    expect(sql.query.mock.calls[0][0]).toContain("FOR UPDATE OF p, r");
  });

  it("edits only the user draft body while retaining original generated text and terms", async () => {
    const { project, confirmed, draft, args } = fixtures();
    const edited = { ...draft, body: "My carefully edited proposal." };
    const sql = queued([draftRow(draft)], [requestRow(confirmed)], [projectRow(project)], [draftRow(edited)]);
    await expect(new PostgresRealProjectRepository(sql).editDraft({ ...args, draftId: draft.id, body: edited.body,
      expectedUpdatedAt: draft.updatedAt })).resolves.toEqual(edited);
    const stored = JSON.parse(String(sql.query.mock.calls[3][1]?.[4]));
    expect(stored.generatedBody).toBe(draft.generatedBody);
    expect(stored.body).toBe(edited.body);
    expect(stored.impactHash).toBe(impactHash);
    expect(sql.query.mock.calls[3][1]?.[6]).toBe(draft.updatedAt);
  });

  it("scopes child request and draft queries through both project ID and owner hash", async () => {
    const { args, draft } = fixtures();
    const sql = queued([], []);
    const repo = new PostgresRealProjectRepository(sql);
    await expect(repo.getRequest(args)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(repo.getDraft({ ...args, draftId: draft.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    for (const [query, values] of sql.query.mock.calls) {
      expect(query).toContain("p.scope_hash");
      expect(values).toContain(args.projectId);
      expect(values).toContain(realProjectScopeHash(scope));
      expect(values).not.toContain(scope);
    }
  });

  it("advances the draft edit token even if the system clock has not advanced", async () => {
    const { project, confirmed, draft, args } = fixtures();
    const previous = { ...draft, updatedAt: new Date(Date.now() + 60_000).toISOString() };
    const next = { ...previous, body: "My newer edit.", updatedAt: new Date(Date.parse(previous.updatedAt) + 1).toISOString() };
    const sql = queued([draftRow(previous)], [requestRow(confirmed)], [projectRow(project)], [draftRow(next)]);
    await new PostgresRealProjectRepository(sql).editDraft({ ...args, draftId: draft.id, body: next.body });
    const stored = JSON.parse(String(sql.query.mock.calls[3][1]?.[4]));
    expect(Date.parse(stored.updatedAt)).toBeGreaterThan(Date.parse(previous.updatedAt));
    expect(sql.query.mock.calls[3][1]?.[6]).toBe(previous.updatedAt);
  });
});
