import { describe, expect, it } from "vitest";
import { readAiConfig } from "./config";

const configured = { SCOPESHIFT_AI_MODE: "openai", OPENAI_API_KEY: "test-key", SCOPESHIFT_SESSION_SECRET: "a".repeat(64) };

describe("AI configuration", () => {
  it("keeps rules mode explicit and requires no key", () => {
    expect(readAiConfig({})).toEqual({ mode: "rules" });
    expect(readAiConfig({ OPENAI_API_KEY: "available-but-not-enabled" })).toEqual({ mode: "rules" });
  });
  it("requires a key, persistent secret and supported storage environment for OpenAI", () => {
    expect(() => readAiConfig({ SCOPESHIFT_AI_MODE: "openai" })).toThrow(/key/);
    expect(() => readAiConfig({ ...configured, SCOPESHIFT_SESSION_SECRET: "short" })).toThrow(/secret/);
    expect(() => readAiConfig({ ...configured, VERCEL: "1" })).toThrow(/persistent/);
    expect(() => readAiConfig({ ...configured, OPENAI_TIMEOUT_MS: "999" })).toThrow(/1000/);
    expect(() => readAiConfig({ ...configured, OPENAI_MODEL: "bad/model" })).toThrow(/identifier/);
  });
  it("uses a configurable model and bounded timeout", () => {
    expect(readAiConfig(configured)).toMatchObject({ mode: "openai", model: "gpt-5.4-mini", timeoutMs: 20_000 });
    expect(readAiConfig({ ...configured, OPENAI_MODEL: "gpt-4.1-mini", OPENAI_TIMEOUT_MS: "30000" })).toMatchObject({ model: "gpt-4.1-mini", timeoutMs: 30_000 });
  });
});
