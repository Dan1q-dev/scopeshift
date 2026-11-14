import { afterEach, describe, expect, it, vi } from "vitest";
import { websiteProjectScenario } from "@/data/scenarios/website-project";
import { negotiateHistory } from "@/lib/simulation/negotiate";
import { hideAttempt, loadSession, mergeSavedAttempts, newAttempt, removeAttempt, type Session } from "./session";

const history = [{ turnId: "restore-turn", eventId: "booking-request", userMessage: "I can add booking for an extra $400 and two more days." }];
const response = negotiateHistory(websiteProjectScenario, history);
const saved = { id: "server-attempt", createdAt: 1, history, response };

afterEach(() => vi.unstubAllGlobals());

describe("browser and server history merge", () => {
  it("restores attempts after browser storage is cleared", () => {
    vi.stubGlobal("window", { localStorage: { getItem: () => null } });
    expect(loadSession(websiteProjectScenario.id, [saved])).toEqual({ attempts: [saved], activeId: saved.id });
  });

  it("preserves a browser-only draft and its selection beside restored attempts", () => {
    const local: Session = { attempts: [{ id: "unsent-draft", createdAt: 2, history: [], response: null }], activeId: "unsent-draft" };
    expect(mergeSavedAttempts(local, [saved])).toEqual({ attempts: [saved, ...local.attempts], activeId: "unsent-draft" });
  });

  it("prefers a server-confirmed history without duplicating the same attempt", () => {
    const local: Session = { attempts: [{ ...saved, response: null }], activeId: saved.id };
    expect(mergeSavedAttempts(local, [saved])).toEqual({ attempts: [saved], activeId: saved.id });
  });

  it("keeps a longer local history when an older server snapshot arrives", () => {
    const localAttempt = { ...saved, history: [...history, { turnId: "unsynced-prefix", eventId: "rush-request", userMessage: "I decline." }] };
    const merged = mergeSavedAttempts({ attempts: [localAttempt], activeId: saved.id }, [saved]);
    expect(merged.attempts).toEqual([localAttempt]);
  });
});

describe("deleting attempts in the browser", () => {
  afterEach(() => vi.unstubAllGlobals());

  const first = { ...newAttempt(), id: "attempt-one", createdAt: 1 };
  const second = { ...newAttempt(), id: "attempt-two", createdAt: 2 };

  it("removes an inactive attempt and keeps the active one", () => {
    expect(removeAttempt({ attempts: [first, second], activeId: second.id }, first.id)).toEqual({ attempts: [second], activeId: second.id });
  });

  it("activates the latest remaining attempt when the active one is removed", () => {
    expect(removeAttempt({ attempts: [first, second], activeId: second.id }, second.id)).toEqual({ attempts: [first], activeId: first.id });
  });

  it("replaces the last attempt with an empty one", () => {
    const next = removeAttempt({ attempts: [first], activeId: first.id }, first.id);
    expect(next.attempts).toHaveLength(1);
    expect(next.attempts[0].id).not.toBe(first.id);
    expect(next.attempts[0].history).toEqual([]);
    expect(next.activeId).toBe(next.attempts[0].id);
  });

  it("leaves the session unchanged for an unknown attempt", () => {
    const session: Session = { attempts: [first], activeId: first.id };
    expect(removeAttempt(session, "missing")).toBe(session);
  });

  it("does not restore a deleted attempt from the server history", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", { localStorage: { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => { store.set(key, value); } } });
    const saved = [{ ...first, response: null }, { ...second, response: null }];
    hideAttempt("web-project-01", first.id);
    const restored = loadSession("web-project-01", saved as never);
    expect(restored.attempts.map((attempt) => attempt.id)).toEqual([second.id]);
  });
});
