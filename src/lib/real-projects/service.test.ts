import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { FinancialImpactInput, RealClientRequest, ScopeReviewInput } from "@/types/real-project";
import { RealProjectService } from "./service";
import { PostgresRealProjectRepository } from "./repository";
import { buildRealProject, createSourceDocument, groundScopeAnalysis, hashRealInput } from "./source";
import { calculateFinancialImpact } from "./finance";
import { OpenAIProviderError } from "@/lib/ai/openai-responses";

function fixture() {
  const project = buildRealProject({ name: "Synthetic website", originalFeeCents: 150000, originalEstimatedHours: 20,
    originalDeadline: "2026-12-01", agreementText: "Build five pages. Booking is not specified." });
  const id = randomUUID();
  const requestDocument = createSourceDocument("Please add booking.", "client_request", "Client request", 1, id);
  const analysis = groundScopeAnalysis({ summary: "Booking needs review.", limitations: [], items: [{ title: "Booking", requestedWork: "Add booking.", classification: "not_specified",
    contractEvidence: [], requestEvidence: [{ documentId: id, passageId: requestDocument.passages[0].id, quote: "Please add booking." }],
    explanation: "The agreement does not specify the implementation.", unknowns: [], clarificationQuestions: [] }] }, project, requestDocument);
  const request: RealClientRequest = { id, projectId: project.id, clientMessage: requestDocument.canonicalText, requestDocument,
    projectSnapshot: project, sourceRevision: 1, status: "ready", analysis, review: null, impact: null, impactHash: null, error: null,
    createdAt: project.createdAt, updatedAt: project.updatedAt };
  const repo = new PostgresRealProjectRepository({ query: vi.fn().mockRejectedValue(new Error("Unexpected SQL")) });
  vi.spyOn(repo, "getProject").mockResolvedValue(project);
  vi.spyOn(repo, "getRequest").mockImplementation(async () => structuredClone(request));
  const ai = { analyze: vi.fn().mockResolvedValue(analysis), draft: vi.fn().mockResolvedValue("Proposed only. Please confirm the terms.") };
  const service = new RealProjectService(repo, ai, "test-model");
  const args = { scope: "synthetic-session", projectId: project.id, requestId: id };
  const reviewInput: ScopeReviewInput = { sourceRevision: 1, expectedReviewRevision: 0, items: [{ itemId: "item_1", classification: "not_specified", reason: "" }] };
  const impactInput: FinancialImpactInput = { reviewRevision: 1, selectedItemIds: ["item_1"], additionalEstimatedHours: 6,
    removedScope: [], pricing: { mode: "fixed", feeDeltaCents: 40000 }, additionalExpensesCents: 2000, deadlineExtensionDays: 2, assumptions: [] };
  const confirm = () => { request.status = "confirmed"; request.review = { sourceRevision: 1, items: reviewInput.items, revision: 1, confirmedAt: project.createdAt }; };
  const calculate = () => { confirm(); request.impact = calculateFinancialImpact(project, impactInput, request.review!); request.impactHash = hashRealInput(request.impact); };
  return { project, request, analysis, repo, ai, service, args, reviewInput, impactInput, confirm, calculate };
}

describe("Real project workflow invariants", () => {
  it("requires explicit external-AI consent before claiming or calling", async () => {
    const f = fixture(); const claim = vi.spyOn(f.repo, "claimRequest");
    await expect(f.service.analyze(f.args.scope, f.project.id, { requestId: f.request.id, clientMessage: "Please add booking.", aiConsent: false })).rejects.toThrow();
    expect(claim).not.toHaveBeenCalled(); expect(f.ai.analyze).not.toHaveBeenCalled();
  });
  it("claims before AI, saves verified analysis and keeps financial fields empty", async () => {
    const f = fixture(); let claimed = false;
    vi.spyOn(f.repo, "claimRequest").mockImplementation(async ({ record }) => { claimed = true; return { created: true, ownerToken: randomUUID(), request: record }; });
    f.ai.analyze.mockImplementation(async () => { expect(claimed).toBe(true); return f.analysis; });
    vi.spyOn(f.repo, "completeAnalysis").mockResolvedValue(f.request);
    await expect(f.service.analyze(f.args.scope, f.project.id, { requestId: f.request.id, clientMessage: "Please add booking.", aiConsent: true })).resolves.toMatchObject({ status: "ready", review: null, impact: null });
    expect(f.ai.analyze).toHaveBeenCalledTimes(1);
  });
  it("returns durable completed or failed analysis retries without calling AI", async () => {
    const f = fixture();
    const claim = vi.spyOn(f.repo, "claimRequest").mockResolvedValue({ created: false, ownerToken: null, request: f.request });
    const input = { requestId: f.request.id, clientMessage: f.request.clientMessage, aiConsent: true };
    await f.service.analyze(f.args.scope, f.project.id, input);
    f.request.status = "failed"; f.request.error = { code: "AI_UNAVAILABLE", message: "A new analysis is required." };
    claim.mockResolvedValue({ created: false, ownerToken: null, request: f.request });
    await expect(f.service.analyze(f.args.scope, f.project.id, input)).resolves.toMatchObject({ status: "failed" });
    expect(f.ai.analyze).not.toHaveBeenCalled();
  });
  it("keeps a stable input hash across retries despite generated timestamps", async () => {
    const f = fixture();
    const claim = vi.spyOn(f.repo, "claimRequest").mockResolvedValue({ created: false, ownerToken: null, request: f.request });
    const input = { requestId: f.request.id, clientMessage: f.request.clientMessage, aiConsent: true };
    await f.service.analyze(f.args.scope, f.project.id, input); await f.service.analyze(f.args.scope, f.project.id, input);
    expect(claim.mock.calls[0][0].inputHash).toBe(claim.mock.calls[1][0].inputHash);
  });
  it("never takes over a pending paid operation", async () => {
    const f = fixture(); vi.spyOn(f.repo, "claimRequest").mockResolvedValue({ created: false, ownerToken: null, request: { ...f.request, status: "pending" } });
    await expect(f.service.analyze(f.args.scope, f.project.id, { requestId: f.request.id, clientMessage: f.request.clientMessage, aiConsent: true })).rejects.toMatchObject({ code: "ANALYSIS_IN_PROGRESS" });
    expect(f.ai.analyze).not.toHaveBeenCalled();
  });
  it("stores only safe provider failure information", async () => {
    const f = fixture(); const ownerToken = randomUUID();
    vi.spyOn(f.repo, "claimRequest").mockResolvedValue({ created: true, ownerToken, request: { ...f.request, status: "pending" } });
    const fail = vi.spyOn(f.repo, "failAnalysis").mockResolvedValue();
    f.ai.analyze.mockRejectedValue(new Error("secret contract and api token must not escape"));
    await expect(f.service.analyze(f.args.scope, f.project.id, { requestId: f.request.id, clientMessage: f.request.clientMessage, aiConsent: true })).rejects.toMatchObject({ code: "INTERNAL_ERROR" });
    expect(JSON.stringify(fail.mock.calls)).not.toContain("secret contract");
  });
  it("requires all items exactly once and a reason for a changed classification", async () => {
    const f = fixture(); const save = vi.spyOn(f.repo, "saveReview").mockResolvedValue(f.request);
    await expect(f.service.confirmReview(f.args, { ...f.reviewInput, items: [...f.reviewInput.items, ...f.reviewInput.items] })).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(f.service.confirmReview(f.args, { ...f.reviewInput, items: [{ ...f.reviewInput.items[0], classification: "excluded" }] })).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(save).not.toHaveBeenCalled();
    await f.service.confirmReview(f.args, { ...f.reviewInput, items: [{ ...f.reviewInput.items[0], classification: "ambiguous", reason: "The amendment conflicts with this clause." }] });
    expect(save.mock.calls[0][0].review).toMatchObject({ revision: 1, items: [{ classification: "ambiguous" }] });
    expect(f.request.analysis!.items[0].classification).toBe("not_specified");
  });
  it("blocks calculations before review and after a source or review edit", async () => {
    const f = fixture();
    await expect(f.service.calculate(f.args, f.impactInput)).rejects.toMatchObject({ code: "REVIEW_REQUIRED" });
    f.confirm();
    await expect(f.service.calculate(f.args, { ...f.impactInput, reviewRevision: 2 })).rejects.toMatchObject({ code: "STALE_REVIEW" });
    vi.mocked(f.repo.getProject).mockResolvedValue({ ...f.project, sourceRevision: 2 });
    await expect(f.service.calculate(f.args, f.impactInput)).rejects.toMatchObject({ code: "STALE_SOURCE" });
    expect(f.ai.analyze).not.toHaveBeenCalled();
  });
  it("rejects forged totals and computes a proposed change order from manual inputs", async () => {
    const f = fixture(); f.confirm();
    const save = vi.spyOn(f.repo, "saveImpact").mockImplementation(async ({ impact, impactHash }) => ({ ...f.request, impact, impactHash }));
    await expect(f.service.calculate(f.args, { ...f.impactInput, proposedFeeCents: 1 })).rejects.toThrow();
    const result = await f.service.calculate(f.args, f.impactInput);
    expect(result.impact).toMatchObject({ proposedFeeCents: 190000, updatedEstimatedHours: 26, updatedEffectiveHourlyRateCents: 7308, proposedDeadline: "2026-12-03", additionalCompensationAfterExpensesCents: 38000 });
    expect(result.changeOrder.status).toBe("proposed");
    expect(save).toHaveBeenCalledTimes(1); expect(f.project.originalFeeCents).toBe(150000);
  });
  it("binds drafts to confirmed terms and caches completed generation", async () => {
    const f = fixture(); f.calculate(); const draftId = randomUUID();
    const input = { draftId, style: "professional", reviewRevision: 1, impactHash: f.request.impactHash, aiConsent: true };
    await expect(f.service.generateDraft(f.args, { ...input, impactHash: "b".repeat(64) })).rejects.toMatchObject({ code: "STALE_REVIEW" });
    const claim = vi.spyOn(f.repo, "claimDraft").mockResolvedValue({ created: true, ownerToken: randomUUID(), status: "pending", draft: null, error: null });
    vi.spyOn(f.repo, "completeDraft").mockImplementation(async ({ draft }) => draft);
    const draft = await f.service.generateDraft(f.args, input);
    expect(draft.status).toBe("proposed");
    claim.mockResolvedValue({ created: false, ownerToken: null, status: "complete", draft, error: null });
    expect(await f.service.generateDraft(f.args, input)).toEqual(draft); expect(f.ai.draft).toHaveBeenCalledTimes(1);
  });
  it("records draft provider failures without inventing text", async () => {
    const f = fixture(); f.calculate();
    vi.spyOn(f.repo, "claimDraft").mockResolvedValue({ created: true, ownerToken: randomUUID(), status: "pending", draft: null, error: null });
    const fail = vi.spyOn(f.repo, "failDraft").mockResolvedValue();
    f.ai.draft.mockRejectedValue(new OpenAIProviderError("refused", "A response draft could not be generated."));
    await expect(f.service.generateDraft(f.args, { draftId: randomUUID(), style: "firm", reviewRevision: 1, impactHash: f.request.impactHash, aiConsent: true })).rejects.toMatchObject({ code: "AI_UNAVAILABLE" });
    expect(fail).toHaveBeenCalledTimes(1);
  });
});
