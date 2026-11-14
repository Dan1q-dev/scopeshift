import { AiConfigurationError, readAiConfig } from "@/lib/ai/config";
import { PostgresAttemptStore } from "@/lib/simulation/attempt-store";
import { getDatabasePool } from "@/lib/simulation/postgres-client";
import { ReplayStoreError } from "@/lib/simulation/replay-store";
import { findScenario } from "@/lib/simulation/scenarios";
import { signedSession } from "@/lib/simulation/signed-session";
import { attemptsResponseSchema, idSchema, type ApiError } from "@/types/scope";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", "Vary": "Cookie" };

function error(status: number, code: ApiError["error"]["code"], message: string) {
  return Response.json({ error: { code, message } } satisfies ApiError, { status, headers });
}

/** Read history only for an already established identity. This never creates a cookie. */
export async function GET(request: Request) {
  const parsed = idSchema.safeParse(new URL(request.url).searchParams.get("scenarioId"));
  if (!parsed.success) return error(400, "INVALID_REQUEST", "A valid scenarioId is required.");
  if (!findScenario(parsed.data)) return error(404, "SCENARIO_NOT_FOUND", "The scenario was not found.");
  try {
    const config = readAiConfig();
    if (config.mode !== "openai" || config.storage.kind !== "postgres") return Response.json({ attempts: [] }, { headers });
    const identity = signedSession(request.headers.get("cookie"), config.sessionSecret);
    if (!identity.established) return error(409, "INVALID_HISTORY", "Initialize the anonymous session before loading saved attempts.");
    const attempts = await new PostgresAttemptStore(getDatabasePool(config.storage.connectionString)).list(identity.id, parsed.data);
    return Response.json(attemptsResponseSchema.parse({ attempts }), { headers });
  } catch (cause) {
    if (cause instanceof AiConfigurationError || cause instanceof ReplayStoreError) return error(503, "AI_UNAVAILABLE", "Saved attempt history is unavailable. Please reload to retry.");
    return error(500, "INTERNAL_ERROR", "Saved attempt history could not be loaded.");
  }
}
