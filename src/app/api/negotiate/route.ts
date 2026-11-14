import { findScenario } from "@/lib/simulation/scenarios";
import { negotiateRequestSchema, type ApiError } from "@/types/scope";

const MAX_BODY_BYTES = 131_072;

function error(status: number, code: ApiError["error"]["code"], message: string) {
  return Response.json({ error: { code, message } } satisfies ApiError, { status });
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

  // Foundation only. Danila implements interpretation, deterministic replay and evaluation.
  return error(501, "NOT_IMPLEMENTED", "Negotiation engine is not implemented yet.");
}
