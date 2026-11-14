import { describe, expect, it } from "vitest";
import { websiteProjectScenario } from "@/data/scenarios/website-project";
import { SESSION_COOKIE, SimulationSessionStore } from "./session-store";

const scenario = websiteProjectScenario;
const first = { turnId: "first", eventId: "booking-request", userMessage: "I can add booking for $400 and two more days." };
const cookie = (id: string) => `${SESSION_COOKIE}=${id}`;

describe("anonymous simulation history", () => {
  it("allows exact retries and alternate branches with new turn IDs", () => {
    const store = new SimulationSessionStore();
    const session = store.acquire(null);
    store.commit(session, scenario, [first]);
    const same = store.acquire(cookie(session.id));
    expect(same.id).toBe(session.id);
    expect(() => store.validate(same, scenario, [first])).not.toThrow();
    expect(() => store.validate(same, scenario, [{ ...first, turnId: "alternate", userMessage: "I can add it for free." }])).not.toThrow();
  });

  it("rejects changed text or changed prefixes for the same ID", () => {
    const store = new SimulationSessionStore();
    const session = store.acquire(null);
    const second = { turnId: "second", eventId: "earlier-delivery", userMessage: "No, let us keep the contract." };
    store.commit(session, scenario, [first, second]);
    expect(() => store.validate(session, scenario, [{ ...first, userMessage: "Free work" }])).toThrow(/reused/);
    expect(() => store.validate(session, scenario, [{ ...first, turnId: "fork" }, second])).toThrow(/reused/);
  });

  it("isolates identical IDs between clients and rotates unrecognized cookies", () => {
    const store = new SimulationSessionStore();
    const alice = store.acquire(null);
    store.commit(alice, scenario, [first]);
    const bob = store.acquire(null);
    expect(() => store.validate(bob, scenario, [{ ...first, userMessage: "I can do it for free." }])).not.toThrow();
    expect(store.acquire(cookie("attacker-supplied-session")).id).not.toBe("attacker-supplied-session");
    expect(store.cookie(alice, true)).toContain("HttpOnly; SameSite=Strict; Secure");
  });

  it("rechecks conflicts on commit and does not reserve IDs for rejected requests", () => {
    const store = new SimulationSessionStore();
    const session = store.acquire(null);
    store.commit(session, scenario, []);
    const concurrent = store.acquire(cookie(session.id));
    store.validate(session, scenario, [first]);
    store.validate(concurrent, scenario, [{ ...first, userMessage: "different" }]);
    store.commit(session, scenario, [first]);
    expect(() => store.commit(concurrent, scenario, [{ ...first, userMessage: "different" }])).toThrow(/reused/);
    const unused = { ...first, turnId: "uncommitted" };
    store.validate(session, scenario, [unused]);
    expect(() => store.validate(session, scenario, [{ ...unused, userMessage: "changed before commit" }])).not.toThrow();
  });

  it("limits an active session and expires process-local fingerprints", () => {
    let now = 0;
    const store = new SimulationSessionStore(() => now);
    const session = store.acquire(null);
    store.commit(session, scenario, [first]);
    for (let i = 1; i < 30; i += 1) store.acquire(cookie(session.id));
    expect(() => store.acquire(cookie(session.id))).toThrow(/Too many/);
    now = 60_001;
    expect(() => store.acquire(cookie(session.id))).not.toThrow();
    now = 3_600_001;
    expect(store.acquire(cookie(session.id)).id).not.toBe(session.id);
  });
});
