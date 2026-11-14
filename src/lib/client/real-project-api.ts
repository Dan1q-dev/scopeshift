import { z } from "zod";
import {
  clientRequestCreateSchema, deleteProjectResponseSchema, draftListResponseSchema,
  draftResponseSchema, financialImpactInputSchema, impactResponseSchema,
  negotiationDraftEditSchema, negotiationDraftInputSchema, projectListResponseSchema,
  projectResponseSchema, realApiErrorSchema, realProjectCreateSchema,
  realProjectUpdateSchema, requestListResponseSchema, requestResponseSchema,
  scopeReviewInputSchema,
  type ClientRequestCreateInput, type FinancialImpactInput, type NegotiationDraftInput,
  type RealProjectCreateInput, type RealProjectUpdateInput, type ScopeReviewInput,
} from "@/types/real-project";

export class RealProjectApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) {
    super(message);
    this.name = "RealProjectApiError";
  }
}

async function read<T>(path: string, schema: z.ZodType<T>, method = "GET", body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method, cache: "no-store", credentials: "same-origin",
      ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    });
  } catch {
    throw new RealProjectApiError("NETWORK_ERROR", "The connection was interrupted. Try the same action again.", 0);
  }
  let result: unknown;
  try { result = await response.json(); } catch {
    throw new RealProjectApiError("INVALID_RESPONSE", "The server returned an unreadable response. Please try again.", response.status);
  }
  if (!response.ok) {
    const error = realApiErrorSchema.safeParse(result);
    throw new RealProjectApiError(error.success ? error.data.error.code : "INTERNAL_ERROR", error.success ? error.data.error.message : "The request could not be completed.", response.status);
  }
  const parsed = schema.safeParse(result);
  if (!parsed.success) throw new RealProjectApiError("INVALID_RESPONSE", "The server response did not match the project contract.", response.status);
  return parsed.data;
}

const projectPath = (projectId: string) => `/api/real-projects/${encodeURIComponent(projectId)}`;
const requestPath = (projectId: string, requestId: string) => `${projectPath(projectId)}/requests/${encodeURIComponent(requestId)}`;

export const realProjectApi = {
  list: async () => (await read("/api/real-projects", projectListResponseSchema)).projects,
  get: async (id: string) => (await read(projectPath(id), projectResponseSchema)).project,
  create: async (input: RealProjectCreateInput) => (await read("/api/real-projects", projectResponseSchema, "POST", realProjectCreateSchema.parse(input))).project,
  update: async (id: string, input: RealProjectUpdateInput) => (await read(projectPath(id), projectResponseSchema, "PATCH", realProjectUpdateSchema.parse(input))).project,
  delete: async (id: string) => read(projectPath(id), deleteProjectResponseSchema, "DELETE"),
  requests: async (id: string) => (await read(`${projectPath(id)}/requests`, requestListResponseSchema)).requests,
  request: async (projectId: string, requestId: string) => (await read(requestPath(projectId, requestId), requestResponseSchema)).request,
  analyze: async (id: string, input: ClientRequestCreateInput) => (await read(`${projectPath(id)}/requests`, requestResponseSchema, "POST", clientRequestCreateSchema.parse(input))).request,
  review: async (projectId: string, requestId: string, input: ScopeReviewInput) => (await read(`${requestPath(projectId, requestId)}/review`, requestResponseSchema, "PUT", scopeReviewInputSchema.parse(input))).request,
  impact: async (projectId: string, requestId: string, input: FinancialImpactInput) => read(`${requestPath(projectId, requestId)}/impact`, impactResponseSchema, "POST", financialImpactInputSchema.parse(input)),
  drafts: async (projectId: string, requestId: string) => (await read(`${requestPath(projectId, requestId)}/drafts`, draftListResponseSchema)).drafts,
  draft: async (projectId: string, requestId: string, input: NegotiationDraftInput) => (await read(`${requestPath(projectId, requestId)}/drafts`, draftResponseSchema, "POST", negotiationDraftInputSchema.parse(input))).draft,
  editDraft: async (projectId: string, requestId: string, draftId: string, body: string, expectedUpdatedAt?: string) => (await read(`${requestPath(projectId, requestId)}/drafts/${encodeURIComponent(draftId)}`, draftResponseSchema, "PATCH", negotiationDraftEditSchema.parse({ body, expectedUpdatedAt }))).draft,
};
