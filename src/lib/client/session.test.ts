import { afterEach, describe, expect, it, vi } from "vitest";
import { websiteProjectScenario } from "@/data/scenarios/website-project";
import { negotiateHistory } from "@/lib/simulation/negotiate";
import { loadSession, mergeSavedAttempts, type Session } from "./session";

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
