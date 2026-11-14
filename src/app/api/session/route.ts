import { AiConfigurationError, readAiConfig } from "@/lib/ai/config";
import { signedSession, signedSessionCookie } from "@/lib/simulation/signed-session";
import type { ApiError } from "@/types/scope";

export const runtime = "nodejs";

/** Establish anonymous identity before any paid provider call. */
export function GET(request: Request) {
  try {
    const config = readAiConfig();
    const identity = config.mode === "openai" ? signedSession(request.headers.get("cookie"), config.sessionSecret) : null;
    return Response.json({ mode: config.mode, historyStorage: config.mode === "openai" && config.storage.kind === "postgres" ? "postgres" : "browser" }, { headers: {
      "Cache-Control": "no-store",
      "Vary": "Cookie",
      ...(identity ? { "Set-Cookie": signedSessionCookie(identity, new URL(request.url).protocol === "https:") } : {}),
    } });
  } catch (cause) {
    if (cause instanceof AiConfigurationError) return Response.json({ error: { code: "AI_UNAVAILABLE", message: cause.message } } satisfies ApiError, { status: 503, headers: { "Cache-Control": "no-store" } });
    return Response.json({ error: { code: "INTERNAL_ERROR", message: "The session could not be initialized." } } satisfies ApiError, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
