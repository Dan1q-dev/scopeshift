import "server-only";
import path from "node:path";

export type AiConfig = { mode: "rules" } | {
  mode: "openai";
  apiKey: string;
  model: string;
  timeoutMs: number;
  sessionSecret: string;
  replayDirectory: string;
  storage: { kind: "file"; directory: string } | { kind: "postgres"; connectionString: string };
  dailyAiCallLimit: number;
};

export class AiConfigurationError extends Error {
  constructor(message: string) { super(message); this.name = "AiConfigurationError"; }
}

export function readAiConfig(env: Readonly<Record<string, string | undefined>> = process.env): AiConfig {
  const mode = env.SCOPESHIFT_AI_MODE?.trim() || "rules";
  if (mode === "rules") return { mode };
  if (mode !== "openai") throw new AiConfigurationError("SCOPESHIFT_AI_MODE must be rules or openai.");
  if (!env.OPENAI_API_KEY?.trim()) throw new AiConfigurationError("The OpenAI API key is not configured on the server.");
  if (!env.SCOPESHIFT_SESSION_SECRET || env.SCOPESHIFT_SESSION_SECRET.length < 32) {
    throw new AiConfigurationError("A persistent session signing secret of at least 32 characters is required.");
  }
  const storageKind = env.SCOPESHIFT_STORAGE?.trim() || "file";
  if (storageKind !== "file" && storageKind !== "postgres") throw new AiConfigurationError("SCOPESHIFT_STORAGE must be file or postgres.");
  const replayDirectory = path.resolve(/* turbopackIgnore: true */ env.SCOPESHIFT_REPLAY_DIR || path.join(process.cwd(), ".scopeshift", "replay"));
  let storage: Extract<AiConfig, { mode: "openai" }>["storage"] = { kind: "file", directory: replayDirectory };
  if (storageKind === "postgres") {
    let url: URL;
    try { url = new URL(env.SCOPESHIFT_DATABASE_URL || ""); } catch { throw new AiConfigurationError("A dedicated SCOPESHIFT_DATABASE_URL is required for Postgres storage."); }
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || url.pathname.length < 2) {
      throw new AiConfigurationError("SCOPESHIFT_DATABASE_URL must be a PostgreSQL connection string.");
    }
    storage = { kind: "postgres", connectionString: env.SCOPESHIFT_DATABASE_URL! };
  }
  if (env.VERCEL === "1" && storage.kind !== "postgres") {
    throw new AiConfigurationError("OpenAI mode requires persistent replay storage. The current filesystem adapter is for a persistent local server.");
  }
  const dailyAiCallLimit = Number(env.SCOPESHIFT_DAILY_AI_CALL_LIMIT || 200);
  if (!Number.isInteger(dailyAiCallLimit) || dailyAiCallLimit < 1 || dailyAiCallLimit > 10_000) throw new AiConfigurationError("SCOPESHIFT_DAILY_AI_CALL_LIMIT must be between 1 and 10000.");
  const timeoutMs = Number(env.OPENAI_TIMEOUT_MS || 20_000);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 60_000) throw new AiConfigurationError("OPENAI_TIMEOUT_MS must be between 1000 and 60000.");
  const model = env.OPENAI_MODEL?.trim() || "gpt-5.4-mini";
  if (!/^[a-zA-Z0-9._:-]{1,120}$/.test(model)) throw new AiConfigurationError("The OpenAI model identifier is invalid.");
  return { mode, apiKey: env.OPENAI_API_KEY.trim(), model, timeoutMs, sessionSecret: env.SCOPESHIFT_SESSION_SECRET, replayDirectory, storage, dailyAiCallLimit };
}
