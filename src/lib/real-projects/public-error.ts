import "server-only";
import { z } from "zod";
import { AiConfigurationError } from "@/lib/ai/config";
import { OpenAIProviderError } from "@/lib/ai/openai-responses";
import { DailyAiLimitError } from "@/lib/simulation/ai-budget";
import { ReplayStoreError } from "@/lib/simulation/replay-store";
import { RealProjectError } from "./errors";

/** Never serialize raw database/provider exceptions or submitted text. */
export function publicRealError(cause: unknown): RealProjectError {
  if (cause instanceof RealProjectError) return cause;
  if (cause instanceof z.ZodError || cause instanceof SyntaxError) return new RealProjectError(400, "INVALID_REQUEST", "Check the submitted fields, numeric limits and required text.");
  if (cause instanceof DailyAiLimitError) return new RealProjectError(429, "RATE_LIMITED", "The daily AI limit has been reached. Please try again tomorrow.");
  if (cause instanceof OpenAIProviderError) return new RealProjectError(cause.kind === "rate_limit" ? 429 : 503, cause.kind === "rate_limit" ? "RATE_LIMITED" : "AI_UNAVAILABLE", cause.message);
  if (cause instanceof AiConfigurationError) return new RealProjectError(503, "AI_UNAVAILABLE", "Real Project Mode requires configured server-side OpenAI and Postgres storage.");
  if (cause instanceof ReplayStoreError) return new RealProjectError(503, "STORAGE_UNAVAILABLE", "The shared AI limit or saved data is temporarily unavailable.");
  return new RealProjectError(500, "INTERNAL_ERROR", "This real project operation could not be completed. Please retry later.");
}
