import "server-only";
import { z } from "zod";
import { readAiConfig } from "@/lib/ai/config";
import { getDatabasePool } from "@/lib/simulation/postgres-client";
import { signedSession } from "@/lib/simulation/signed-session";
import { reserveAiCall } from "@/lib/simulation/ai-budget";
import { createRealProjectAi } from "./ai";
import { PostgresRealProjectRepository } from "./repository";
import { RealProjectService } from "./service";
import { RealProjectError } from "./errors";
import { publicRealError } from "./public-error";

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie", "X-Content-Type-Options": "nosniff" };
const MAX_INPUT_BYTES = 128 * 1024;
export type RealRouteParams = { projectId?: string; requestId?: string; draftId?: string };
type Context = { service: RealProjectService; scope: string; params: RealRouteParams };

export async function readRealJson(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.split(";")[0].trim().toLowerCase().endsWith("/json")) throw new RealProjectError(400, "INVALID_REQUEST", "Send a JSON object. File uploads are not supported in this version; paste reviewed text instead.");
  if (Number(request.headers.get("content-length")) > MAX_INPUT_BYTES) throw new RealProjectError(413, "INVALID_REQUEST", "The submitted text is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new RealProjectError(400, "INVALID_REQUEST", "A JSON body is required.");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0; let body = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_INPUT_BYTES) { await reader.cancel(); throw new RealProjectError(413, "INVALID_REQUEST", "The submitted text is too large."); }
      body += decoder.decode(chunk.value, { stream: true });
    }
    try { return JSON.parse(body + decoder.decode()); }
    catch { throw new RealProjectError(400, "INVALID_REQUEST", "The JSON body could not be read."); }
  } catch (cause) {
    if (cause instanceof RealProjectError) throw cause;
    throw new RealProjectError(400, "INVALID_REQUEST", "The JSON body must contain valid UTF-8 text.");
  } finally { reader.releaseLock(); }
}

export async function realHttp(request: Request, params: RealRouteParams | Promise<RealRouteParams>, action: (context: Context) => Promise<unknown>, status = 200) {
  try {
    if (!["GET", "HEAD"].includes(request.method)) {
      const origin = request.headers.get("origin");
      const expected = new URL(request.url);
      // Next's local server can use its internal listening hostname in request.url.
      // Host is the browser's actual request destination. Do not trust arbitrary forwarded hosts.
      const host = request.headers.get("host");
      if (host) expected.host = host;
      if (origin && origin !== expected.origin) throw new RealProjectError(403, "FORBIDDEN", "Use this application's own page to change real project records.");
    }
    const resolved = await params;
    for (const value of Object.values(resolved)) z.string().uuid().parse(value);
    const config = readAiConfig();
    if (config.mode !== "openai" || config.storage.kind !== "postgres") throw new RealProjectError(503, "AI_UNAVAILABLE", "Real Project Mode requires server-side OpenAI and persistent Postgres storage.");
    const identity = signedSession(request.headers.get("cookie"), config.sessionSecret);
    if (!identity.established) throw new RealProjectError(401, "SESSION_REQUIRED", "Initialize your anonymous session before opening real projects.");
    const sql = getDatabasePool(config.storage.connectionString);
    const ai = createRealProjectAi(config, { beforeCall: () => reserveAiCall(sql, config.dailyAiCallLimit) });
    const service = new RealProjectService(new PostgresRealProjectRepository(sql), ai, config.model);
    return Response.json(await action({ service, scope: identity.id, params: resolved }), { status, headers });
  } catch (cause) {
    const error = publicRealError(cause);
    return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status,
      headers: { ...headers, ...(error.status === 429 ? { "Retry-After": "3600" } : {}) } });
  }
}
