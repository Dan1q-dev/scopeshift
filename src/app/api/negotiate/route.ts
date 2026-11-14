import { findScenario } from "@/lib/simulation/scenarios";
import { INTERPRETER_VERSION } from "@/lib/ai/rules-interpreter";
import { EngineHistoryError } from "@/lib/simulation/engine";
import { negotiateHistory } from "@/lib/simulation/negotiate";
import { scenarioRevision, simulationSessions, SimulationRequestError } from "@/lib/simulation/session-store";
import { negotiateRequestSchema, type ApiError } from "@/types/scope";

export const runtime = "nodejs";
const MAX_BODY_BYTES = 131_072;

function error(status: number, code: ApiError["error"]["code"], message: string) {
  return Response.json({ error: { code, message } } satisfies ApiError, { status, headers: { "Cache-Control": "no-store", ...(status === 429 ? { "Retry-After": "60" } : {}) } });
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

  try {
    const session = simulationSessions.acquire(request.headers.get("cookie"));
    simulationSessions.validate(session, scenario, parsed.data.history);
    const result = negotiateHistory(scenario, parsed.data.history);
    simulationSessions.commit(session, scenario, parsed.data.history);
    return Response.json(result, {
      headers: {
        "Cache-Control": "no-store",
        "Vary": "Cookie",
        "X-ScopeShift-Interpreter": INTERPRETER_VERSION,
        "X-ScopeShift-Evaluation": "pending",
        "X-ScopeShift-Scenario-Revision": scenarioRevision(scenario).slice(0, 16),
        "Set-Cookie": simulationSessions.cookie(session, new URL(request.url).protocol === "https:"),
      },
    });
  } catch (cause) {
    if (cause instanceof SimulationRequestError) return error(cause.status, cause.code, cause.message);
    if (cause instanceof EngineHistoryError) return error(400, "INVALID_HISTORY", cause.message);
    console.error("ScopeShift negotiation failed", cause instanceof Error ? cause.name : "UnknownError");
    return error(500, "INTERNAL_ERROR", "The simulation could not process this turn. Please try again.");
  }
}
