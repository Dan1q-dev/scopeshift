import { z } from "zod";
import {
  apiErrorSchema,
  attemptsResponseSchema,
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

// Share concurrent initialization so first requests receive the same cookie
// before any paid interpretation. A failed/lost bootstrap has no provider cost.
const sessionInfoSchema = z.object({ mode: z.enum(["rules", "openai"]), historyStorage: z.enum(["postgres", "browser"]).default("browser") });
export type SessionInfo = z.infer<typeof sessionInfoSchema>;
export type InterpreterMode = z.infer<typeof sessionInfoSchema>["mode"];
let sessionBootstrap: Promise<SessionInfo> | undefined;

export async function getSessionInfo(signal?: AbortSignal): Promise<SessionInfo> {
  signal?.throwIfAborted();
  if (!sessionBootstrap) {
    sessionBootstrap = (async () => {
      const result = await readResponse(await fetch("/api/session", { cache: "no-store" }), sessionInfoSchema);
      return result;
    })().finally(() => { sessionBootstrap = undefined; });
  }
  if (!signal) return sessionBootstrap;
  // Cancel only this consumer. Other callers still need the shared cookie.
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    sessionBootstrap!.then((mode) => {
      signal.removeEventListener("abort", onAbort);
      resolve(mode);
    }, (error) => {
      signal.removeEventListener("abort", onAbort);
      reject(error);
    });
  });
}

export async function getSessionMode(signal?: AbortSignal): Promise<InterpreterMode> {
  return (await getSessionInfo(signal)).mode;
}

/** The caller must initialize the session first so this GET uses the same identity. */
export async function getSavedAttempts(scenarioId: string, signal?: AbortSignal) {
  const result = await readResponse(await fetch(`/api/attempts?scenarioId=${encodeURIComponent(scenarioId)}`, { cache: "no-store", signal }), attemptsResponseSchema);
  return result.attempts;
}

export async function negotiate(request: NegotiateRequest, signal?: AbortSignal) {
  const validated = negotiateRequestSchema.parse(request);
  await getSessionMode(signal);
  signal?.throwIfAborted();
  return readResponse(await fetch("/api/negotiate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(validated),
    signal,
  }), negotiateResponseSchema);
}
