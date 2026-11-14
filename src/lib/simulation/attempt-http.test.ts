import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/attempts/route";
import { POST } from "@/app/api/negotiate/route";
import { createOpenAIInterpreter } from "@/lib/ai/openai-interpreter";
import { createOpenAIClientReplyGenerator } from "@/lib/ai/openai-client-reply";
import { getDatabasePool } from "./postgres-client";
import { createReplayStore } from "./replay-store-factory";
import { reserveAiCall } from "./ai-budget";
import { signedSession, signedSessionCookie } from "./signed-session";
import type { SqlClient } from "./postgres-types";
import type { NegotiationTurn } from "@/types/scope";

vi.mock("@/lib/simulation/postgres-client", () => ({ getDatabasePool: vi.fn() }));
vi.mock("@/lib/simulation/replay-store-factory", () => ({ createReplayStore: vi.fn() }));
vi.mock("@/lib/ai/openai-interpreter", async (original) => ({
  ...await original<typeof import("@/lib/ai/openai-interpreter")>(),
  createOpenAIInterpreter: vi.fn(),
}));
vi.mock("@/lib/ai/openai-client-reply", async (original) => ({
  ...await original<typeof import("@/lib/ai/openai-client-reply")>(),
  createOpenAIClientReplyGenerator: vi.fn(),
}));
vi.mock("@/lib/simulation/ai-budget", async (original) => ({
  ...await original<typeof import("@/lib/simulation/ai-budget")>(),
  reserveAiCall: vi.fn(),
}));
const secret = "server-history-test-signing-secret-".repeat(2);
const url = "https://demo.test/api/attempts?scenarioId=web-project-01";
const query = vi.fn<SqlClient["query"]>();

beforeEach(() => {
  vi.stubEnv("SCOPESHIFT_AI_MODE", "openai");
  vi.stubEnv("OPENAI_API_KEY", "test-not-a-real-key");
  vi.stubEnv("SCOPESHIFT_SESSION_SECRET", secret);
  vi.stubEnv("SCOPESHIFT_STORAGE", "postgres");
  vi.stubEnv("SCOPESHIFT_DATABASE_URL", "postgres://test-user:test-password@database.test/scopeshift");
  query.mockReset().mockResolvedValue({ rows: [], rowCount: 0 });
  vi.mocked(getDatabasePool).mockReturnValue({ query } as unknown as ReturnType<typeof getDatabasePool>);
  vi.mocked(reserveAiCall).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

function cookie() {
  return signedSessionCookie(signedSession(null, secret), true).split(";")[0];
}

describe("private attempt history HTTP endpoint", () => {
  it("rejects missing identity without minting or exposing another history", async () => {
    const response = await GET(new Request(url));
    expect(response.status).toBe(409);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(getDatabasePool).not.toHaveBeenCalled();
  });

  it("reads established identities through isolated SQL parameters", async () => {
    const first = await GET(new Request(url, { headers: { cookie: cookie() } }));
    const second = await GET(new Request(url, { headers: { cookie: cookie() } }));
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ attempts: [] });
    expect(second.status).toBe(200);
    expect(query.mock.calls[0][1]![0]).not.toBe(query.mock.calls[1][1]![0]);
    expect(query.mock.calls[0][1]![1]).toBe("web-project-01");
    expect(first.headers.get("Vary")).toBe("Cookie");
    expect(first.headers.get("set-cookie")).toBeNull();
  });

  it("rejects an invalid signature before accessing persistence", async () => {
    const valid = cookie();
    const modified = `${valid.slice(0, -1)}${valid.endsWith("0") ? "1" : "0"}`;
    const response = await GET(new Request(url, { headers: { cookie: modified } }));
    expect(response.status).toBe(409);
    expect(query).not.toHaveBeenCalled();
  });

  it("requires a known scenario", async () => {
    expect((await GET(new Request("https://demo.test/api/attempts"))).status).toBe(400);
    expect((await GET(new Request("https://demo.test/api/attempts?scenarioId=missing"))).status).toBe(404);
    expect(query).not.toHaveBeenCalled();
  });

  it("keeps the local rules mode independent of the database", async () => {
    vi.stubEnv("SCOPESHIFT_AI_MODE", "rules");
    const response = await GET(new Request(url));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ attempts: [] });
    expect(query).not.toHaveBeenCalled();
  });

  it("sanitizes database failures and never substitutes an empty success", async () => {
    query.mockRejectedValueOnce(new Error("password and private connection string"));
    const response = await GET(new Request(url, { headers: { cookie: cookie() } }));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error.code).toBe("AI_UNAVAILABLE");
    expect(JSON.stringify(body)).not.toContain("password");
    expect(body.attempts).toBeUndefined();
  });

  it("returns a persistence failure and retries its durable turn without another paid inference", async () => {
    const cache = new Map<string, NegotiationTurn>();
    vi.mocked(createReplayStore).mockReturnValue({
      getOrCreate: async (identity, produce) => {
        const key = JSON.stringify(identity);
        const existing = cache.get(key);
        if (existing) return existing;
        const created = await produce();
        cache.set(key, created);
        return created;
      },
    });
    const interpret = vi.fn().mockResolvedValue({ kind: "propose", change: { feeDeltaCents: 40000, deadlineDeltaDays: 2, addScopeItemIds: ["consultation-booking"], removeScopeItemIds: [] } });
    const generateReply = vi.fn().mockResolvedValue("Agreed. Consultation booking is added, bringing the project to $1,900, 26 hours, and delivery on day 9.");
    vi.mocked(createOpenAIInterpreter).mockReturnValue(interpret);
    vi.mocked(createOpenAIClientReplyGenerator).mockReturnValue(generateReply);
    query.mockRejectedValueOnce(new Error("database temporarily unavailable"))
      .mockResolvedValueOnce({ rows: [{ attempt_id: "retry-attempt" }], rowCount: 1 });
    const identity = cookie();
    const body = { scenarioId: "web-project-01", attemptId: "retry-attempt", history: [{ turnId: "retry-saved-turn", eventId: "booking-request", userMessage: "I can add booking for an extra $400 and two more days." }] };
    const request = () => new Request("https://demo.test/api/negotiate", { method: "POST", headers: { cookie: identity }, body: JSON.stringify(body) });
    const failed = await POST(request());
    expect(failed.status).toBe(503);
    expect((await failed.json()).error.code).toBe("AI_UNAVAILABLE");
    const retry = await POST(request());
    expect(retry.status).toBe(200);
    expect(retry.headers.get("X-ScopeShift-OpenAI-Calls")).toBe("0");
    expect((await retry.json()).project.totalFeeCents).toBe(190000);
    expect(interpret).toHaveBeenCalledTimes(1);
    expect(generateReply).toHaveBeenCalledTimes(1);
    expect(reserveAiCall).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenCalledTimes(2);
  });
});
