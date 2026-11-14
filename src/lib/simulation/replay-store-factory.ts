import "server-only";
import type { AiConfig } from "@/lib/ai/config";
import { OpenAIProviderError } from "@/lib/ai/openai-interpreter";
import { DailyAiLimitError } from "./ai-budget";
import { EngineHistoryError } from "./engine";
import { getDatabasePool } from "./postgres-client";
import { PostgresReplayStore } from "./postgres-replay-store";
import { FileReplayStore, type ReplayStore } from "./replay-store";

export function canReleaseReplayClaim(cause: unknown) {
  return cause instanceof EngineHistoryError || cause instanceof DailyAiLimitError
    || (cause instanceof OpenAIProviderError && ["configuration", "rate_limit"].includes(cause.kind));
}

export function createReplayStore(config: Extract<AiConfig, { mode: "openai" }>): ReplayStore {
  return config.storage.kind === "file" ? new FileReplayStore(config.storage.directory) : new PostgresReplayStore(getDatabasePool(config.storage.connectionString), {
    canReleaseOnProduceError: canReleaseReplayClaim,
  });
}
