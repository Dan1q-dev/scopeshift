import { z } from "zod";
import {
  apiErrorSchema,
  negotiateRequestSchema,
  negotiateResponseSchema,
  publicScenarioSchema,
  scenarioSummarySchema,
  type NegotiateRequest,
} from "@/types/scope";

export class ScopeShiftApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) {
    super(message);
    this.name = "ScopeShiftApiError";
  }
}

async function readResponse<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  const body: unknown = await response.json();
  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(body);
    throw new ScopeShiftApiError(parsed.success ? parsed.data.error.code : "INTERNAL_ERROR", parsed.success ? parsed.data.error.message : "Request failed. Please try again.", response.status);
  }
  return schema.parse(body);
}

export async function getScenarios(signal?: AbortSignal) {
  const result = await readResponse(await fetch("/api/scenarios", { signal }), z.object({ scenarios: z.array(scenarioSummarySchema) }));
  return result.scenarios;
}

export async function getScenario(scenarioId: string, signal?: AbortSignal) {
  const result = await readResponse(await fetch(`/api/scenarios/${encodeURIComponent(scenarioId)}`, { signal }), z.object({ scenario: publicScenarioSchema }));
  return result.scenario;
}

export async function negotiate(request: NegotiateRequest, signal?: AbortSignal) {
  return readResponse(await fetch("/api/negotiate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(negotiateRequestSchema.parse(request)),
    signal,
  }), negotiateResponseSchema);
}
