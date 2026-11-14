import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/negotiate/route";
import type { NegotiationTurn } from "@/types/scope";
import { DailyAiLimitError, reserveAiCall } from "./ai-budget";
import type { SqlClient } from "./postgres-types";
import { ReplayStoreError, type ReplayIdentity } from "./replay-store";
import { signedSession, signedSessionCookie } from "./signed-session";

const mocked = vi.hoisted(() => ({
  query: vi.fn<SqlClient["query"]>(),
  interpret: vi.fn(),
  receipts: new Map<string, NegotiationTurn>(),
}));

vi.mock("./postgres-client", () => ({ getDatabasePool: () => ({ query: mocked.query }) }));
vi.mock("./replay-store-factory", () => ({
  createReplayStore: () => ({
    async getOrCreate(identity: ReplayIdentity, produce: () => Promise<NegotiationTurn>) {
      const key = JSON.stringify(identity);
      const cached = mocked.receipts.get(key);
      if (cached) return cached;
      const receipt = await produce();
      mocked.receipts.set(key, receipt);
      return receipt;
    },
  }),
}));
vi.mock("@/lib/ai/openai-interpreter", async (original) => ({
  ...await original<typeof import("@/lib/ai/openai-interpreter")>(),
  createOpenAIInterpreter: () => mocked.interpret,
}));

const sql: SqlClient = { query: mocked.query };
const secret = "synthetic-ai-budget-signing-secret-".repeat(2);

beforeEach(() => {
  mocked.query.mockReset().mockResolvedValue({ rows: [{ calls: 1 }], rowCount: 1 });
  mocked.interpret.mockReset().mockResolvedValue({ kind: "clarify", question: "Which booking fields are required?" });
  mocked.receipts.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function configureHttp() {
  vi.stubEnv("SCOPESHIFT_AI_MODE", "openai");
  vi.stubEnv("OPENAI_API_KEY", "test-not-a-real-openai-key");
  vi.stubEnv("SCOPESHIFT_SESSION_SECRET", secret);
  vi.stubEnv("SCOPESHIFT_STORAGE", "postgres");
  vi.stubEnv("SCOPESHIFT_DATABASE_URL", "postgresql://synthetic:unused@database.test/scopeshift");
  vi.stubEnv("SCOPESHIFT_DAILY_AI_CALL_LIMIT", "17");
  vi.stubEnv("VERCEL", "1");
  const cookie = signedSessionCookie(signedSession(null, secret), true).split(";")[0];
  const history = [{ turnId: randomUUID(), eventId: "booking-request", userMessage: "Which booking fields are required?" }];
  return () => new Request("https://demo.test/api/negotiate", {
    method: "POST",
    headers: { cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ scenarioId: "web-project-01", history }),
  });
}

describe("shared daily AI quota", () => {
  it("reserves through one conditional upsert with the day and limit bound as parameters", async () => {
    await expect(reserveAiCall(sql, 17, new Date("2026-11-14T12:00:00Z"))).resolves.toBeUndefined();
    expect(mocked.query).toHaveBeenCalledOnce();
    const [statement, parameters] = mocked.query.mock.calls[0];
    expect(parameters).toEqual(["2026-11-14", 17]);
    expect(statement).toMatch(/INSERT INTO scopeshift_ai_daily_usage/i);
    expect(statement).toMatch(/ON CONFLICT\s*\(day\)\s*DO UPDATE/i);
    expect(statement).toMatch(/WHERE\s+scopeshift_ai_daily_usage\.calls\s*<\s*\$2/i);
    expect(statement).toMatch(/RETURNING calls/i);
  });

  it.each([
    ["2026-11-14T23:45:00-05:00", "2026-11-15"],
    ["2026-11-14T00:15:00+05:00", "2026-11-13"],
  ])("uses the UTC calendar day for %s", async (timestamp, day) => {
    await reserveAiCall(sql, 3, new Date(timestamp));
    expect(mocked.query.mock.calls[0][1]).toEqual([day, 3]);
  });

  it("treats an empty RETURNING result as exhausted quota", async () => {
    mocked.query.mockResolvedValue({ rows: [], rowCount: 0 });
    await expect(reserveAiCall(sql, 1)).rejects.toBeInstanceOf(DailyAiLimitError);
    expect(mocked.query).toHaveBeenCalledOnce();
  });

  it("sanitizes database failures without retaining the raw connection error", async () => {
    mocked.query.mockRejectedValue(new Error("Connection failed for postgresql://private-user:private-password@private-host/database"));
    const error: unknown = await reserveAiCall(sql, 2).catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(ReplayStoreError);
    expect(error).toMatchObject({ message: "The shared AI quota could not be checked." });
    expect(error).not.toHaveProperty("cause");
    expect(String(error)).not.toMatch(/private-user|private-password|private-host/);
  });

  it("fails closed before SQL when the date is invalid", async () => {
    await expect(reserveAiCall(sql, 2, new Date("invalid"))).rejects.toBeInstanceOf(ReplayStoreError);
    expect(mocked.query).not.toHaveBeenCalled();
  });
});

describe("HTTP AI quota boundary", () => {
  it("returns 429 until UTC midnight without starting paid inference", async () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-11-14T23:59:45Z"));
    const request = configureHttp();
    mocked.query.mockResolvedValue({ rows: [], rowCount: 0 });
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("15");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Set-Cookie")).toContain("HttpOnly");
    expect(await response.json()).toMatchObject({ error: { code: "RATE_LIMITED", message: expect.stringContaining("daily AI limit") } });
    expect(mocked.interpret).not.toHaveBeenCalled();
    expect(mocked.query.mock.calls[0][1]).toEqual(["2026-11-14", 17]);
  });

  it("returns a sanitized 503 and never calls OpenAI if the budget store fails", async () => {
    const request = configureHttp();
    mocked.query.mockRejectedValue(new Error("postgresql://private-user:private-password@private-host/database"));
    const response = await POST(request());
    expect(response.status).toBe(503);
    const body: unknown = await response.json();
    expect(body).toEqual({ error: { code: "AI_UNAVAILABLE", message: "Replay storage is unavailable. Please retry the request." } });
    expect(JSON.stringify(body)).not.toMatch(/private-user|private-password|private-host/);
    expect(mocked.interpret).not.toHaveBeenCalled();
  });

  it("charges quota only inside new inference, so cached retries consume no reservation", async () => {
    const request = configureHttp();
    const first = await POST(request());
    expect(first.status).toBe(200);
    const expected: unknown = await first.json();
    const retry = await POST(request());
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual(expected);
    expect(first.headers.get("X-ScopeShift-OpenAI-Calls")).toBe("1");
    expect(retry.headers.get("X-ScopeShift-OpenAI-Calls")).toBe("0");
    expect(mocked.query).toHaveBeenCalledOnce();
    expect(mocked.interpret).toHaveBeenCalledOnce();
  });
});
