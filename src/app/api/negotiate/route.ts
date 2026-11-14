import { findScenario } from "@/lib/simulation/scenarios";
import { INTERPRETER_VERSION } from "@/lib/ai/rules-interpreter";
import { AiConfigurationError, readAiConfig } from "@/lib/ai/config";
import { createOpenAIInterpreter, OPENAI_INTERPRETER_VERSION, OpenAIProviderError } from "@/lib/ai/openai-interpreter";
import { ENGINE_VERSION, EngineHistoryError } from "@/lib/simulation/engine";
import { negotiateHistory } from "@/lib/simulation/negotiate";
import { negotiateWithLlm } from "@/lib/simulation/llm-negotiate";
import { FileReplayStore, ReplayConflictError, ReplayStoreError } from "@/lib/simulation/replay-store";
import { signedSession, signedSessionCookie } from "@/lib/simulation/signed-session";
import { scenarioRevision, simulationSessions, SimulationRequestError } from "@/lib/simulation/session-store";
import { negotiateRequestSchema, type ApiError } from "@/types/scope";
import { evaluateSimulation, EVALUATOR_VERSION } from "@/lib/evaluation/simulation-evaluator";

export const runtime = "nodejs";
const MAX_BODY_BYTES = 131_072;

function error(status: number, code: ApiError["error"]["code"], message: string, cookie?: string) {
  return Response.json({ error: { code, message } } satisfies ApiError, { status, headers: { "Cache-Control": "no-store", ...(cookie ? { "Set-Cookie": cookie } : {}), ...(status === 429 ? { "Retry-After": "60" } : {}) } });
}

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) {
    return error(413, "INVALID_REQUEST", "Request body is too large.");
  }

  let body: unknown;
  try {
    const reader = request.body?.getReader();
    if (!reader) return error(400, "INVALID_REQUEST", "A JSON body is required.");
    const decoder = new TextDecoder();
    let bytes = 0;
    let text = "";
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel();
        return error(413, "INVALID_REQUEST", "Request body is too large.");
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    body = JSON.parse(text + decoder.decode());
  } catch {
    return error(400, "INVALID_REQUEST", "Request body must be valid JSON.");
  }

  const parsed = negotiateRequestSchema.safeParse(body);
  if (!parsed.success) return error(400, "INVALID_REQUEST", "Invalid negotiation request.");
  const scenario = findScenario(parsed.data.scenarioId);
  if (!scenario) return error(404, "SCENARIO_NOT_FOUND", "Scenario not found.");
  if (parsed.data.history.some((entry) => !scenario.events.some((event) => event.id === entry.eventId))) {
    return error(400, "INVALID_HISTORY", "History contains an unknown event.");
  }

  let cookie: string | undefined;
  try {
    const config = readAiConfig();
    const identity = config.mode === "openai" ? signedSession(request.headers.get("cookie"), config.sessionSecret) : null;
    const session = simulationSessions.acquire(request.headers.get("cookie"), identity?.id);
    const interpreterVersion = config.mode === "openai" ? `${OPENAI_INTERPRETER_VERSION}:${config.model}:${ENGINE_VERSION}` : INTERPRETER_VERSION;
    cookie = identity ? signedSessionCookie(identity, new URL(request.url).protocol === "https:") : simulationSessions.cookie(session, new URL(request.url).protocol === "https:");
    if (identity && !identity.established) return error(409, "INVALID_HISTORY", "Initialize the anonymous session with GET /api/session before sending a negotiation turn.", cookie);
    simulationSessions.validate(session, scenario, parsed.data.history, interpreterVersion);
    let modelCalls = 0;
    const interpret = config.mode === "openai" ? createOpenAIInterpreter(config) : null;
    const result = config.mode === "rules" ? negotiateHistory(scenario, parsed.data.history, evaluateSimulation) : await negotiateWithLlm(scenario, parsed.data.history, {
      scope: identity!.id,
      version: interpreterVersion,
      store: new FileReplayStore(config.replayDirectory),
      interpret: async (context) => { modelCalls += 1; return interpret!(context); },
      evaluate: evaluateSimulation,
    });
    simulationSessions.commit(session, scenario, parsed.data.history, interpreterVersion);
    return Response.json(result, {
      headers: {
        "Cache-Control": "no-store",
        "Vary": "Cookie",
        "X-ScopeShift-Interpreter": config.mode === "openai" ? OPENAI_INTERPRETER_VERSION : INTERPRETER_VERSION,
        ...(config.mode === "openai" ? { "X-ScopeShift-LLM-Model": config.model, "X-ScopeShift-OpenAI-Calls": String(modelCalls) } : {}),
        "X-ScopeShift-Evaluation": EVALUATOR_VERSION,
        "X-ScopeShift-Scenario-Revision": scenarioRevision(scenario, interpreterVersion).slice(0, 16),
        "Set-Cookie": cookie,
      },
    });
  } catch (cause) {
    if (cause instanceof SimulationRequestError) return error(cause.status, cause.code, cause.message, cookie);
    if (cause instanceof EngineHistoryError) return error(400, "INVALID_HISTORY", cause.message, cookie);
    if (cause instanceof ReplayConflictError) return error(409, "INVALID_HISTORY", cause.message, cookie);
    if (cause instanceof AiConfigurationError) return error(503, "AI_UNAVAILABLE", cause.message, cookie);
    if (cause instanceof OpenAIProviderError) return error(cause.kind === "rate_limit" ? 429 : 503, cause.kind === "rate_limit" ? "RATE_LIMITED" : "AI_UNAVAILABLE", cause.message, cookie);
    if (cause instanceof ReplayStoreError) return error(503, "AI_UNAVAILABLE", "Replay storage is unavailable. Please retry the request.", cookie);
    console.error("ScopeShift negotiation failed", cause instanceof Error ? cause.name : "UnknownError");
    return error(500, "INTERNAL_ERROR", "The simulation could not process this turn. Please try again.", cookie);
  }
}
