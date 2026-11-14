import { createHash, randomInt, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Pool } from "pg";
import { afterAll, describe, expect, it, vi } from "vitest";
import type { NegotiationTurn } from "@/types/scope";
import { PostgresReplayStore } from "./postgres-replay-store";
import { replayKey, ReplayConflictError, ReplayStoreError, type ReplayIdentity } from "./replay-store";
import { DailyAiLimitError, reserveAiCall } from "./ai-budget";

const databaseUrl = process.env.SCOPESHIFT_TEST_DATABASE_URL;
const keys: string[] = [];
const pools: Pool[] = [];

function client() {
  const pool = new Pool({ connectionString: databaseUrl, max: 2, connectionTimeoutMillis: 15_000 });
  pools.push(pool);
  return pool;
}

function identity(): ReplayIdentity {
  const record = {
    scope: `integration-${randomUUID()}`,
    scenarioId: "web-project-01",
    version: "integration-openai-v1:model:simulation-v2",
    entry: { turnId: randomUUID(), eventId: "booking-request", userMessage: "Please clarify booking." },
    prefixHash: createHash("sha256").update("integration-prefix").digest("hex"),
  };
  keys.push(replayKey(record));
  return record;
}

function turn(record: ReplayIdentity): NegotiationTurn {
  return { ...record.entry, action: { kind: "clarify", question: record.entry.userMessage }, clientReply: "The contract is unchanged while we clarify.", agreement: null };
}

afterAll(async () => {
  if (pools.length && keys.length) {
    if (!keys.every((key) => /^[a-f0-9]{64}$/.test(key))) throw new Error("Invalid integration cleanup key");
    await pools[0].query("DELETE FROM scopeshift_replay_receipts WHERE key = ANY($1::text[])", [keys]);
  }
  await Promise.all(pools.map((pool) => pool.end()));
});

/** Explicit opt-in against an already migrated database, using only synthetic rows.
 * Set SCOPESHIFT_TEST_DATABASE_URL and run this file with Vitest.
 */
describe.skipIf(!databaseUrl)("real Postgres durable receipts", () => {
  it("serializes competing connections and reuses the committed receipt from a new pool", async () => {
    const record = identity();
    const produce = vi.fn(async () => { await delay(40); return turn(record); });
    const stores = Array.from({ length: 3 }, () => new PostgresReplayStore(client(), { lockTimeoutMs: 15_000, lockPollMs: 20 }));
    const results = await Promise.all(stores.map((store) => store.getOrCreate(record, produce)));
    expect(produce).toHaveBeenCalledOnce();
    expect(results.every((result) => JSON.stringify(result) === JSON.stringify(results[0]))).toBe(true);
    await expect(new PostgresReplayStore(client()).getOrCreate(record, produce)).resolves.toEqual(results[0]);
    expect(produce).toHaveBeenCalledOnce();
    const changed = { ...record, entry: { ...record.entry, userMessage: "A conflicting question." } };
    await expect(new PostgresReplayStore(client()).getOrCreate(changed, produce)).rejects.toBeInstanceOf(ReplayConflictError);
    expect(produce).toHaveBeenCalledOnce();
  }, 40_000);

  it("preserves an ambiguous pending call across pools without taking it over", async () => {
    const record = identity();
    const failure = new Error("Simulated process failure after possible inference");
    await expect(new PostgresReplayStore(client()).getOrCreate(record, async () => { throw failure; })).rejects.toBe(failure);
    const produce = vi.fn(async () => turn(record));
    await expect(new PostgresReplayStore(client(), { lockTimeoutMs: 100, lockPollMs: 10 }).getOrCreate(record, produce)).rejects.toBeInstanceOf(ReplayStoreError);
    expect(produce).not.toHaveBeenCalled();
  }, 40_000);

  it("enforces one shared AI quota under competing database connections", async () => {
    const clients = Array.from({ length: 3 }, () => client());
    let ownedDay: string | null = null;
    try {
      // Claim a unique, distant synthetic day without touching an existing row.
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const day = new Date(Date.UTC(randomInt(6000, 9000), randomInt(0, 12), randomInt(1, 29))).toISOString().slice(0, 10);
        const claim = await clients[0].query("INSERT INTO scopeshift_ai_daily_usage (day, calls) VALUES ($1::date, 0) ON CONFLICT (day) DO NOTHING RETURNING day", [day]);
        if (claim.rowCount === 1) { ownedDay = day; break; }
      }
      if (!ownedDay) throw new Error("Could not claim a synthetic quota test day");
      const outcomes = await Promise.allSettled(Array.from({ length: 15 }, (_, index) => reserveAiCall(clients[index % clients.length], 5, new Date(`${ownedDay}T12:00:00.000Z`))));
      expect(outcomes.filter((result) => result.status === "fulfilled")).toHaveLength(5);
      const failures = outcomes.filter((result) => result.status === "rejected");
      expect(failures).toHaveLength(10);
      expect(failures.every((result) => result.status === "rejected" && result.reason instanceof DailyAiLimitError)).toBe(true);
      const stored = await clients[0].query("SELECT calls FROM scopeshift_ai_daily_usage WHERE day = $1::date", [ownedDay]);
      expect(stored.rows).toEqual([{ calls: 5 }]);
    } finally {
      if (ownedDay) {
        if (!/^[6-8]\d{3}-\d{2}-\d{2}$/.test(ownedDay) || ownedDay === new Date().toISOString().slice(0, 10)) throw new Error("Unsafe quota cleanup date");
        await clients[0].query("DELETE FROM scopeshift_ai_daily_usage WHERE day = $1::date", [ownedDay]);
      }
    }
  }, 40_000);
});
