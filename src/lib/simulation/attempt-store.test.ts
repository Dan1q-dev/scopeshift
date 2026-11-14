import { describe, expect, it, vi } from "vitest";
import { websiteProjectScenario } from "@/data/scenarios/website-project";
import { negotiateHistory } from "./negotiate";
import { PostgresAttemptStore } from "./attempt-store";
import { ReplayConflictError, ReplayStoreError } from "./replay-store";
import type { SqlClient } from "./postgres-types";

const scenarioId = websiteProjectScenario.id;
const history = [{ turnId: "history-turn-1", eventId: "booking-request", userMessage: "I can add booking for an extra $400 and two more days." }];
const response = negotiateHistory(websiteProjectScenario, history);

describe("server attempt history", () => {
  it("binds saved snapshots to the verified response before writing", async () => {
    const query = vi.fn<SqlClient["query"]>().mockResolvedValue({ rows: [{ attempt_id: "attempt-a" }], rowCount: 1 });
    const store = new PostgresAttemptStore({ query });
    await expect(store.save("signed-user-a", scenarioId, "attempt-a", [{ ...history[0], userMessage: "changed" }], response)).rejects.toBeInstanceOf(ReplayStoreError);
    expect(query).not.toHaveBeenCalled();
    await store.save("signed-user-a", scenarioId, "attempt-a", history, response);
    const values = query.mock.calls[0][1]!;
    expect(values[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(values.slice(1, 3)).toEqual([scenarioId, "attempt-a"]);
    expect(JSON.parse(values[3] as string)).toEqual(history);
    expect(JSON.parse(values[4] as string)).toEqual(response);
  });

  it("queries only the requesting identity and scenario, with a bounded list", async () => {
    const query = vi.fn<SqlClient["query"]>().mockResolvedValue({ rows: [], rowCount: 0 });
    const store = new PostgresAttemptStore({ query });
    await store.list("identity-a", scenarioId);
    await store.list("identity-b", scenarioId);
    expect(query.mock.calls[0][0]).toContain("LIMIT 20");
    const first = query.mock.calls[0][1]!;
    const second = query.mock.calls[1][1]!;
    expect(first[0]).not.toBe(second[0]);
    expect(first[1]).toBe(scenarioId);
    expect(query.mock.calls.flatMap((call) => call[1] ?? [])).not.toContain("identity-a");
  });

  it("restores validated responses and presents selected recent rows in chronological order", async () => {
    const query = vi.fn<SqlClient["query"]>().mockResolvedValue({ rows: [
      { attempt_id: "newer", history, response, created_at: new Date(2000) },
      { attempt_id: "older", history, response, created_at: new Date(1000) },
    ], rowCount: 2 });
    const restored = await new PostgresAttemptStore({ query }).list("identity-a", scenarioId);
    expect(restored.map((attempt) => attempt.id)).toEqual(["older", "newer"]);
    expect(restored[1]).toEqual({ id: "newer", createdAt: 2000, history, response });
  });

  it("does not replace a longer saved history with an old successful retry", async () => {
    const longer = [...history, { turnId: "history-turn-2", eventId: "rush-request", userMessage: "I decline this request." }];
    const query = vi.fn<SqlClient["query"]>()
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ history: longer }], rowCount: 1 });
    await expect(new PostgresAttemptStore({ query }).save("identity-a", scenarioId, "attempt-a", history, response)).resolves.toBeUndefined();
  });

  it("keeps newest snapshots within the public HTTP payload budget", async () => {
    const longHistory = Array.from({ length: 50 }, (_, index) => ({ turnId: `long-${index}`, eventId: history[0].eventId, userMessage: "q".repeat(2_000) }));
    const longResponse = { ...response, turns: longHistory.map((entry) => ({ ...entry, action: { kind: "clarify" as const, question: "q".repeat(4_000) }, clientReply: "a".repeat(4_000), agreement: null })) };
    const rows = Array.from({ length: 8 }, (_, index) => ({ attempt_id: `attempt-${8 - index}`, history: longHistory, response: longResponse, created_at: new Date(8 - index) }));
    const query = vi.fn<SqlClient["query"]>().mockResolvedValue({ rows, rowCount: rows.length });
    const restored = await new PostgresAttemptStore({ query }).list("identity-a", scenarioId);
    expect(restored.length).toBeGreaterThan(0);
    expect(restored.length).toBeLessThan(rows.length);
    expect(restored.at(-1)!.id).toBe("attempt-8");
    expect(Buffer.byteLength(JSON.stringify({ attempts: restored }), "utf8")).toBeLessThanOrEqual(3 * 1024 * 1024);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("rejects a different history under an existing attempt ID", async () => {
    const query = vi.fn<SqlClient["query"]>()
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ history: [{ ...history[0], userMessage: "I can do it for free." }] }], rowCount: 1 });
    await expect(new PostgresAttemptStore({ query }).save("identity-a", scenarioId, "attempt-a", history, response)).rejects.toBeInstanceOf(ReplayConflictError);
  });

  it("fails closed on corrupt rows and sanitizes database errors", async () => {
    const query = vi.fn<SqlClient["query"]>()
      .mockResolvedValueOnce({ rows: [{ attempt_id: "bad", history, response: { ...response, scenarioId: "other-scenario" }, created_at: new Date() }], rowCount: 1 })
      .mockRejectedValueOnce(new Error("postgres://owner:secret@private-host/db"));
    const store = new PostgresAttemptStore({ query });
    await expect(store.list("identity-a", scenarioId)).rejects.toThrow("Saved attempt history is unavailable");
    await expect(store.save("identity-a", scenarioId, "attempt-a", history, response)).rejects.toThrow("Saved attempt history is unavailable");
  });
});
