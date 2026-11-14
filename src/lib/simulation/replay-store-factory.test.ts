import { describe, expect, it } from "vitest";
import { OpenAIProviderError } from "@/lib/ai/openai-interpreter";
import { DailyAiLimitError } from "./ai-budget";
import { EngineHistoryError } from "./engine";
import { canReleaseReplayClaim } from "./replay-store-factory";

describe("safe claim recovery", () => {
  it("allows retry after known pre-inference rejection", () => {
    for (const cause of [new DailyAiLimitError(), new EngineHistoryError("Missing prefix"), new OpenAIProviderError("configuration", "Missing key"), new OpenAIProviderError("rate_limit", "Rate limited")]) {
      expect(canReleaseReplayClaim(cause)).toBe(true);
    }
  });
  it("retains ambiguous or already-paid claims rather than silently inferring again", () => {
    for (const kind of ["timeout", "unavailable", "invalid_response", "refused"] as const) expect(canReleaseReplayClaim(new OpenAIProviderError(kind, "Provider failure"))).toBe(false);
    expect(canReleaseReplayClaim(new Error("Process failure"))).toBe(false);
  });
});
