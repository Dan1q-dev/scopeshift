import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { INTERPRETER_VERSION } from "@/lib/ai/rules-interpreter";
import type { ApiError, HistoryEntry, Scenario } from "@/types/scope";

export const SESSION_COOKIE = "scopeshift_session";
const SESSION_TTL_MS = 60 * 60 * 1_000;
const MAX_SESSIONS = 500;
const MAX_FINGERPRINTS = 256;
const REQUESTS_PER_MINUTE = 30;

export class SimulationRequestError extends Error {
  constructor(public readonly status: number, public readonly code: ApiError["error"]["code"], message: string) {
    super(message);
    this.name = "SimulationRequestError";
  }
}

interface Session {
  id: string;
  lastSeen: number;
  windowStart: number;
  requests: number;
  fingerprints: Map<string, string>;
}

interface HistoryFingerprint { key: string; digest: string }

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function scenarioRevision(scenario: Scenario) {
  return hash(`${INTERPRETER_VERSION}\n${JSON.stringify(scenario)}`);
}

function fingerprintHistory(scenario: Scenario, history: readonly HistoryEntry[]): HistoryFingerprint[] {
  let prefix = scenarioRevision(scenario);
  return history.map((entry) => {
    prefix = hash(`${prefix}\n${JSON.stringify([entry.turnId, entry.eventId, entry.userMessage])}`);
    return { key: `${scenario.id}:${entry.turnId}`, digest: prefix };
  });
}

/** Best-effort conflict detection and rate limiting for one Node process.
 * Money/state correctness comes from pure replay, never from this cache.
 * Only fingerprints are retained. No messages or financial states are stored.
 */
export class SimulationSessionStore {
  private readonly sessions = new Map<string, Session>();

  constructor(private readonly now: () => number = Date.now) {}

  acquire(cookieHeader: string | null): Session {
    const now = this.now();
    for (const [id, session] of this.sessions) {
      if (now - session.lastSeen >= SESSION_TTL_MS) this.sessions.delete(id);
    }
    const candidate = cookieHeader?.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
    const known = candidate ? this.sessions.get(candidate) : undefined;
    const session = known ?? { id: randomUUID(), lastSeen: now, windowStart: now, requests: 0, fingerprints: new Map<string, string>() };
    if (now - session.windowStart >= 60_000) {
      session.windowStart = now;
      session.requests = 0;
    }
    session.requests += 1;
    if (session.requests > REQUESTS_PER_MINUTE) {
      throw new SimulationRequestError(429, "RATE_LIMITED", "Too many turns. Please wait a minute and try again.");
    }
    return session;
  }

  validate(session: Session, scenario: Scenario, history: readonly HistoryEntry[]) {
    for (const fingerprint of fingerprintHistory(scenario, history)) {
      const previous = session.fingerprints.get(fingerprint.key);
      if (previous && previous !== fingerprint.digest) {
        throw new SimulationRequestError(409, "INVALID_HISTORY", "A turn ID was reused with different text or history. Use new turn IDs when replaying a decision.");
      }
    }
  }

  commit(session: Session, scenario: Scenario, history: readonly HistoryEntry[]) {
    // Recheck after replay as concurrent requests may have committed the same ID.
    this.validate(session, scenario, history);
    for (const { key, digest } of fingerprintHistory(scenario, history)) {
      session.fingerprints.delete(key);
      session.fingerprints.set(key, digest);
    }
    while (session.fingerprints.size > MAX_FINGERPRINTS) {
      session.fingerprints.delete(session.fingerprints.keys().next().value!);
    }
    session.lastSeen = this.now();
    this.sessions.delete(session.id);
    this.sessions.set(session.id, session);
    while (this.sessions.size > MAX_SESSIONS) this.sessions.delete(this.sessions.keys().next().value!);
  }

  cookie(session: Session, secure: boolean) {
    return `${SESSION_COOKIE}=${session.id}; Path=/api; Max-Age=3600; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}`;
  }
}

export const simulationSessions = new SimulationSessionStore();
