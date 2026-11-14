import { describe, expect, it } from "vitest";
import { SESSION_LIFETIME_MS, signedSession, signedSessionCookie } from "./signed-session";
import { SESSION_COOKIE, SimulationSessionStore } from "./session-store";

const secret = "a".repeat(64);
const now = 1_794_000_000_000;
const cookie = (token: string) => `${SESSION_COOKIE}=${token}`;

describe("persistent anonymous session identity", () => {
  it("verifies the same session after a new process-local store is created", () => {
    const first = signedSession(null, secret, now);
    const restarted = signedSession(cookie(first.token), secret, now + 1000);
    expect(restarted).toMatchObject({ id: first.id, token: first.token, established: true });
    expect(first.established).toBe(false);
    const freshStore = new SimulationSessionStore();
    expect(freshStore.acquire(null, restarted.id).id).toBe(first.id);
    expect(freshStore.acquire(cookie(first.id)).id).not.toBe(first.id);
  });
  it("rejects tampering, expired cookies, raw UUIDs and a changed signing secret", () => {
    const first = signedSession(null, secret, now);
    const tampered = first.token.replace(/.$/, first.token.endsWith("0") ? "1" : "0");
    expect(signedSession(cookie(tampered), secret, now).id).not.toBe(first.id);
    expect(signedSession(cookie(first.token), secret, now + SESSION_LIFETIME_MS + 1).id).not.toBe(first.id);
    expect(signedSession(cookie(first.id), secret, now).id).not.toBe(first.id);
    expect(signedSession(cookie(first.token), "b".repeat(64), now).id).not.toBe(first.id);
  });
  it("sets browser cookie protections without exposing the signing secret", () => {
    const first = signedSession(null, secret, now);
    const value = signedSessionCookie(first, true);
    expect(value).toContain("HttpOnly; SameSite=Strict; Secure");
    expect(value).toContain("Path=/api; Max-Age=2592000");
    expect(value).not.toContain(secret);
  });
  it("keeps a saved attempt's identity beyond one hour and across a restart", () => {
    const first = signedSession(null, secret, now);
    expect(signedSession(cookie(first.token), secret, now + 24 * 3_600_000)).toMatchObject({ id: first.id, established: true });
  });
});
