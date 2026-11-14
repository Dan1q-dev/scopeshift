import { beforeEach, describe, expect, it, vi } from "vitest";
import { readAiConfig } from "@/lib/ai/config";
import { getDatabasePool } from "@/lib/simulation/postgres-client";
import { signedSession, signedSessionCookie } from "@/lib/simulation/signed-session";
import { realHttp, readRealJson } from "./http";

vi.mock("@/lib/ai/config", async (original) => ({ ...await original<typeof import("@/lib/ai/config")>(), readAiConfig: vi.fn() }));
vi.mock("@/lib/simulation/postgres-client", () => ({ getDatabasePool: vi.fn() }));
const secret = "synthetic-signing-secret-with-more-than-thirty-two-characters";
const cookie = signedSessionCookie(signedSession(null, secret), false).split(";")[0];
const config = { mode: "openai" as const, apiKey: "synthetic-test-key", model: "test-model", timeoutMs: 1000, sessionSecret: secret,
  replayDirectory: ".ignored", storage: { kind: "postgres" as const, connectionString: "postgresql://invalid/synthetic" }, dailyAiCallLimit: 200 };
const request = (init: RequestInit = {}) => new Request("https://example.test/api/real-projects", { ...init, headers: { Cookie: cookie, ...init.headers } });

beforeEach(() => { vi.clearAllMocks(); vi.mocked(readAiConfig).mockReturnValue(config); vi.mocked(getDatabasePool).mockReturnValue({ query: vi.fn() } as unknown as ReturnType<typeof getDatabasePool>); });

describe("Real project HTTP boundary", () => {
  it("requires an established signed identity before reaching storage", async () => {
    for (const token of ["", "scopeshift_session=forged"]) {
      const result = await realHttp(request({ headers: { Cookie: token } }), {}, async () => ({ projects: [] }));
      expect(result.status).toBe(401); expect((await result.json()).error.code).toBe("SESSION_REQUIRED");
      expect(result.headers.get("set-cookie")).toBeNull();
    }
    expect(getDatabasePool).not.toHaveBeenCalled();
  });
  it("rejects cross-origin mutations, invalid UUIDs and rules-mode storage", async () => {
    expect((await realHttp(request({ method: "POST", headers: { Origin: "https://other.test" } }), {}, async () => ({}))).status).toBe(403);
    expect((await realHttp(request(), { projectId: "invalid" }, async () => ({}))).status).toBe(400);
    vi.mocked(readAiConfig).mockReturnValue({ mode: "rules" });
    expect((await realHttp(request(), {}, async () => ({}))).status).toBe(503);
    expect(getDatabasePool).not.toHaveBeenCalled();
  });
  it("passes only verified identity and sets private non-cacheable responses", async () => {
    const expected = signedSession(cookie, secret).id;
    const result = await realHttp(request({ method: "POST", headers: { Origin: "https://example.test" } }), {}, async ({ scope }) => ({ verified: scope === expected }), 201);
    expect(result.status).toBe(201); expect(await result.json()).toEqual({ verified: true });
    expect(result.headers.get("cache-control")).toBe("private, no-store"); expect(result.headers.get("vary")).toBe("Cookie");
  });
  it("checks browser origin against the actual Host when Next uses an internal hostname", async () => {
    const valid = request({ method: "POST", headers: { Host: "public.test", Origin: "https://public.test" } });
    expect((await realHttp(valid, {}, async () => ({}))).status).toBe(200);
    const forged = request({ method: "POST", headers: { Host: "public.test", Origin: "https://other.test", "X-Forwarded-Host": "other.test" } });
    expect((await realHttp(forged, {}, async () => ({}))).status).toBe(403);
  });
  it("never serializes raw database errors or private content", async () => {
    const result = await realHttp(request(), {}, async () => { throw new Error("postgresql://SECRET/private-contract"); });
    expect(result.status).toBe(500); expect(await result.text()).not.toMatch(/SECRET|private-contract/);
  });
  it("accepts bounded JSON and rejects file uploads, malformed and oversized bodies", async () => {
    const body = (text: string, type = "application/json") => request({ method: "POST", headers: { "Content-Type": type }, body: text });
    expect(await readRealJson(body('{"aiConsent":true}'))).toEqual({ aiConsent: true });
    await expect(readRealJson(body("fake PDF", "application/pdf"))).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(readRealJson(body("{"))).rejects.toMatchObject({ status: 400 });
    const invalidUtf8 = request({ method: "POST", headers: { "Content-Type": "application/json" }, body: new Uint8Array([123, 255, 125]) });
    await expect(readRealJson(invalidUtf8)).rejects.toMatchObject({ status: 400, code: "INVALID_REQUEST" });
    await expect(readRealJson(body(JSON.stringify({ text: "a".repeat(128 * 1024) })))).rejects.toMatchObject({ status: 413 });
  });
});
