import { createHash, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { describe, expect, it, vi } from "vitest";
import type { NegotiationTurn } from "@/types/scope";
import { PostgresReplayStore } from "./postgres-replay-store";
import type { SqlClient } from "./postgres-types";
import { createReplayReceipt, replayKey, replayRecordIdentity, ReplayConflictError, ReplayStoreError, type ReplayIdentity } from "./replay-store";

const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const identity = (overrides: Partial<ReplayIdentity> = {}): ReplayIdentity => ({
  scope: "opaque-test-session",
  version: "openai-v1:test-model:simulation-v2",
  scenarioId: "web-project-01",
  entry: { turnId: "postgres-turn-1", eventId: "booking-request", userMessage: "Please explain booking." },
  prefixHash: hash("verified-prefix"),
  ...overrides,
});
const turn = (record = identity()): NegotiationTurn => ({
  ...record.entry,
  action: { kind: "clarify", question: record.entry.userMessage },
  clientReply: "Booking includes available slots and a confirmation email. The contract remains unchanged.",
  agreement: null,
});

type Row = { identity: unknown; status: string; owner_token: string; receipt: unknown };

/** Models atomic committed SQL statements, shared across independent store clients.
 * Real Postgres concurrency is exercised by the opt-in integration suite.
 */
class MemorySql implements SqlClient {
  readonly rows = new Map<string, Row>();
  readonly statements: string[] = [];
  failOn: string | null = null;
  loseOwnerOnUpdate = false;

  async query(text: string, values: unknown[] = []) {
    this.statements.push(text);
    if (this.failOn && text.startsWith(this.failOn)) throw new Error("postgres://private:secret@hidden-host/database");
    const key = String(values[0]);
    if (text.startsWith("SELECT")) {
      const row = this.rows.get(key);
      return { rowCount: row ? 1 : 0, rows: row ? [structuredClone(row)] : [] };
    }
    if (text.startsWith("INSERT")) {
      if (this.rows.has(key)) return { rowCount: 0, rows: [] };
      this.rows.set(key, { identity: JSON.parse(String(values[1])), status: "pending", owner_token: String(values[2]), receipt: null });
      return { rowCount: 1, rows: [{ key }] };
    }
    const row = this.rows.get(key);
    if (text.startsWith("UPDATE") && this.loseOwnerOnUpdate && row) row.owner_token = randomUUID();
    if (!row || row.owner_token !== values[1] || row.status !== "pending") return { rowCount: 0, rows: [] };
    if (text.startsWith("UPDATE")) {
      row.status = "complete";
      row.receipt = JSON.parse(String(values[2]));
      return { rowCount: 1, rows: [{ receipt: structuredClone(row.receipt) }] };
    }
    if (text.startsWith("DELETE")) {
      this.rows.delete(key);
      return { rowCount: 1, rows: [{ key }] };
    }
    throw new Error("Unexpected test query");
  }

  client(): SqlClient { return { query: (text, values) => this.query(text, values) }; }

  pending(record = identity()) {
    const row: Row = { identity: replayRecordIdentity(record), status: "pending", owner_token: randomUUID(), receipt: null };
    this.rows.set(replayKey(record), row);
    return row;
  }
}

const quick = { lockTimeoutMs: 30, lockPollMs: 1 };

describe("shared Postgres replay receipts", () => {
  it("reuses a completed receipt through a new client without another provider call", async () => {
    const sql = new MemorySql();
    const produce = vi.fn(async () => turn());
    const first = await new PostgresReplayStore(sql.client()).getOrCreate(identity(), produce);
    const second = await new PostgresReplayStore(sql.client()).getOrCreate(identity(), produce);
    expect(second).toEqual(first);
    expect(produce).toHaveBeenCalledOnce();
    expect(sql.rows.size).toBe(1);
    expect(JSON.stringify([...sql.rows])).not.toContain(identity().scope);
  });

  it("claims once across concurrent independent clients before calling the provider", async () => {
    const sql = new MemorySql();
    const produce = vi.fn(async () => {
      expect([...sql.rows.values()]).toHaveLength(1);
      expect([...sql.rows.values()][0].status).toBe("pending");
      await delay(25);
      return turn();
    });
    const results = await Promise.all(Array.from({ length: 4 }, () => new PostgresReplayStore(sql.client(), { lockTimeoutMs: 200, lockPollMs: 1 }).getOrCreate(identity(), produce)));
    expect(results.every((item) => JSON.stringify(item) === JSON.stringify(results[0]))).toBe(true);
    expect(produce).toHaveBeenCalledOnce();
    expect([...sql.rows.values()][0].status).toBe("complete");
  });

  it.each(["pending", "complete"])("rejects changed identities while %s without reinterpreting", async (status) => {
    const sql = new MemorySql();
    const original = identity();
    const row = sql.pending(original);
    if (status === "complete") { row.status = "complete"; row.receipt = createReplayReceipt(original, turn(original)); }
    for (const changed of [
      identity({ version: "changed-model" }),
      identity({ prefixHash: hash("another-branch") }),
      identity({ entry: { ...original.entry, userMessage: "Do it for free." } }),
      identity({ entry: { ...original.entry, eventId: "scope-swap" } }),
    ]) {
      const produce = vi.fn(async () => turn(changed));
      await expect(new PostgresReplayStore(sql.client(), quick).getOrCreate(changed, produce)).rejects.toBeInstanceOf(ReplayConflictError);
      expect(produce).not.toHaveBeenCalled();
    }
  });

  it("isolates the same turn ID across anonymous sessions", async () => {
    const sql = new MemorySql();
    const other = identity({ scope: "another-opaque-session", entry: { ...identity().entry, userMessage: "Another question." } });
    await new PostgresReplayStore(sql.client()).getOrCreate(identity(), async () => turn());
    await new PostgresReplayStore(sql.client()).getOrCreate(other, async () => turn(other));
    expect(sql.rows.size).toBe(2);
    expect([...sql.rows.keys()].every((key) => /^[a-f0-9]{64}$/.test(key))).toBe(true);
  });

  it("releases only a known producer failure, preserving that original error for retry", async () => {
    const sql = new MemorySql();
    const failure = new Error("Known provider refusal");
    const store = new PostgresReplayStore(sql.client(), { ...quick, canReleaseOnProduceError: (cause) => cause === failure });
    await expect(store.getOrCreate(identity(), async () => { throw failure; })).rejects.toBe(failure);
    expect(sql.rows.size).toBe(0);
    await expect(store.getOrCreate(identity(), async () => turn())).resolves.toEqual(turn());
  });

  it("retains an ambiguous failed claim and never takes it over", async () => {
    const sql = new MemorySql();
    const failure = new Error("Unknown failure after a possible paid call");
    await expect(new PostgresReplayStore(sql.client()).getOrCreate(identity(), async () => { throw failure; })).rejects.toBe(failure);
    const produce = vi.fn(async () => turn());
    await expect(new PostgresReplayStore(sql.client(), quick).getOrCreate(identity(), produce)).rejects.toThrow(/busy/);
    expect(produce).not.toHaveBeenCalled();
    expect([...sql.rows.values()][0].status).toBe("pending");
    expect(sql.statements.some((statement) => statement.startsWith("DELETE"))).toBe(false);
  });

  it.each(["SELECT", "INSERT"])("sanitizes %s failures before any provider call", async (operation) => {
    const sql = new MemorySql();
    sql.failOn = operation;
    const produce = vi.fn(async () => turn());
    const pending = new PostgresReplayStore(sql.client()).getOrCreate(identity(), produce);
    await expect(pending).rejects.toBeInstanceOf(ReplayStoreError);
    await expect(pending).rejects.not.toThrow(/secret|hidden-host/);
    expect(produce).not.toHaveBeenCalled();
  });

  it("does not report success or infer again after an uncertain commit", async () => {
    const sql = new MemorySql();
    sql.failOn = "UPDATE";
    const produce = vi.fn(async () => turn());
    await expect(new PostgresReplayStore(sql.client()).getOrCreate(identity(), produce)).rejects.toBeInstanceOf(ReplayStoreError);
    expect([...sql.rows.values()][0].status).toBe("pending");
    sql.failOn = null;
    await expect(new PostgresReplayStore(sql.client(), quick).getOrCreate(identity(), produce)).rejects.toThrow(/busy/);
    expect(produce).toHaveBeenCalledOnce();
  });

  it("does not complete a claim whose owner changed", async () => {
    const sql = new MemorySql();
    sql.loseOwnerOnUpdate = true;
    await expect(new PostgresReplayStore(sql.client()).getOrCreate(identity(), async () => turn())).rejects.toThrow(/ownership/);
    expect([...sql.rows.values()][0].status).toBe("pending");
  });

  it("does not delete another owner's pending claim during known-error cleanup", async () => {
    const sql = new MemorySql();
    const failure = new Error("Known failure");
    const otherOwner = randomUUID();
    const store = new PostgresReplayStore(sql.client(), { canReleaseOnProduceError: (cause) => cause === failure });
    await expect(store.getOrCreate(identity(), async () => {
      sql.rows.get(replayKey(identity()))!.owner_token = otherOwner;
      throw failure;
    })).rejects.toBeInstanceOf(ReplayStoreError);
    expect(sql.rows.get(replayKey(identity()))!.owner_token).toBe(otherOwner);
  });

  it("keeps invalid produced turns pending instead of persisting or retrying them", async () => {
    const sql = new MemorySql();
    await expect(new PostgresReplayStore(sql.client()).getOrCreate(identity(), async () => ({ ...turn(), turnId: "wrong" }))).rejects.toBeInstanceOf(ReplayStoreError);
    const produce = vi.fn(async () => turn());
    await expect(new PostgresReplayStore(sql.client(), quick).getOrCreate(identity(), produce)).rejects.toThrow(/busy/);
    expect(produce).not.toHaveBeenCalled();
  });

  it("fails closed for malformed, oversized and inconsistent stored receipts", async () => {
    for (const value of [
      null,
      { bad: true },
      { ...createReplayReceipt(identity(), turn()), turn: { ...turn(), userMessage: "Corrupted text" } },
      { ...createReplayReceipt(identity(), turn()), extra: "x".repeat(32_768) },
    ]) {
      const sql = new MemorySql();
      const row = sql.pending();
      row.status = "complete";
      row.receipt = value;
      const produce = vi.fn(async () => turn());
      await expect(new PostgresReplayStore(sql.client()).getOrCreate(identity(), produce)).rejects.toBeInstanceOf(ReplayStoreError);
      expect(produce).not.toHaveBeenCalled();
    }
  });

  it("rejects invalid input before SQL and validates lock timing", async () => {
    const sql = new MemorySql();
    await expect(new PostgresReplayStore(sql.client()).getOrCreate(identity({ scenarioId: "../outside" }), async () => turn())).rejects.toBeInstanceOf(ReplayStoreError);
    expect(sql.statements).toEqual([]);
    expect(() => new PostgresReplayStore(sql.client(), { lockTimeoutMs: 0 })).toThrow(ReplayStoreError);
  });
});
