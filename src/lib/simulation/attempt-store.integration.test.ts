import { createHash, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { websiteProjectScenario } from "@/data/scenarios/website-project";
import type { HistoryEntry } from "@/types/scope";
import { PostgresAttemptStore } from "./attempt-store";
import { negotiateHistory } from "./negotiate";
import { ReplayConflictError } from "./replay-store";

const databaseUrl = process.env.SCOPESHIFT_TEST_DATABASE_URL;
const pools = new Set<Pool>();
const owned: { scope: string; hash: string; attemptId: string }[] = [];
const scenarioId = websiteProjectScenario.id;

function client() {
  if (!databaseUrl) throw new Error("An explicit integration database URL is required.");
  const url = new URL(databaseUrl);
  url.searchParams.set("sslmode", "verify-full");
  const pool = new Pool({ connectionString: url.toString(), max: 2, connectionTimeoutMillis: 15_000, idleTimeoutMillis: 5_000, allowExitOnIdle: true });
  pools.add(pool);
  return pool;
}

async function close(pool: Pool) {
  pools.delete(pool);
  await pool.end();
}

function identity(attemptId = randomUUID()) {
  const scope = `integration-attempt-${randomUUID()}`;
  const row = { scope, hash: createHash("sha256").update(scope).digest("hex"), attemptId };
  owned.push(row);
  return row;
}

function booking(message = "I can add booking for an extra $400 and two more days."): HistoryEntry[] {
  return [{ turnId: randomUUID(), eventId: "booking-request", userMessage: message }];
}

afterAll(async () => {
  try {
    if (owned.length) {
      const cleanup = client();
      for (const row of owned) {
        if (!/^integration-attempt-[0-9a-f-]{36}$/.test(row.scope)
          || !/^[0-9a-f-]{36}$/.test(row.attemptId)
          || createHash("sha256").update(row.scope).digest("hex") !== row.hash) {
          throw new Error("Unsafe attempt integration cleanup identity");
        }
        await cleanup.query("DELETE FROM scopeshift_attempts WHERE scope_hash = $1 AND scenario_id = $2 AND attempt_id = $3", [row.hash, scenarioId, row.attemptId]);
      }
    }
  } finally {
    await Promise.all([...pools].map(close));
  }
});

/** Explicit opt-in against a migrated development database. All rows use owned
 * random synthetic identities and cleanup is restricted to those exact keys.
 */
describe.skipIf(!databaseUrl)("real Postgres attempt history", () => {
  it("restores a saved attempt through a fresh database pool", async () => {
    const row = identity();
    const history = booking();
    const response = negotiateHistory(websiteProjectScenario, history);
    const first = client();
    await new PostgresAttemptStore(first).save(row.scope, scenarioId, row.attemptId, history, response);
    await close(first);

    const restored = await new PostgresAttemptStore(client()).list(row.scope, scenarioId);
    expect(restored).toHaveLength(1);
    expect(restored[0]).toMatchObject({ id: row.attemptId, history, response });
    expect(restored[0].createdAt).toBeGreaterThan(0);
  }, 40_000);

  it("isolates the same attempt ID under separate anonymous scopes", async () => {
    const left = identity();
    const right = identity(left.attemptId);
    const leftHistory = booking();
    const rightHistory = booking("I can add booking for free at the same deadline.");
    const stores = [new PostgresAttemptStore(client()), new PostgresAttemptStore(client())];
    await Promise.all([
      stores[0].save(left.scope, scenarioId, left.attemptId, leftHistory, negotiateHistory(websiteProjectScenario, leftHistory)),
      stores[1].save(right.scope, scenarioId, right.attemptId, rightHistory, negotiateHistory(websiteProjectScenario, rightHistory)),
    ]);
    const a = await stores[1].list(left.scope, scenarioId);
    const b = await stores[0].list(right.scope, scenarioId);
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    expect(a[0].response.project.totalFeeCents).toBe(190_000);
    expect(b[0].response.project.totalFeeCents).toBe(150_000);
    expect(a[0].history).toEqual(leftHistory);
    expect(b[0].history).toEqual(rightHistory);
  }, 40_000);

  it("keeps an extended history when a shorter save races or retries", async () => {
    const row = identity();
    const short = booking();
    const longer = [...short, { turnId: randomUUID(), eventId: "earlier-delivery", userMessage: "I can deliver two days earlier for an extra $150." }];
    const a = new PostgresAttemptStore(client());
    const b = new PostgresAttemptStore(client());
    await Promise.all([
      a.save(row.scope, scenarioId, row.attemptId, short, negotiateHistory(websiteProjectScenario, short)),
      b.save(row.scope, scenarioId, row.attemptId, longer, negotiateHistory(websiteProjectScenario, longer)),
    ]);
    await a.save(row.scope, scenarioId, row.attemptId, short, negotiateHistory(websiteProjectScenario, short));
    const restored = await new PostgresAttemptStore(client()).list(row.scope, scenarioId);
    expect(restored).toHaveLength(1);
    expect(restored[0].history).toEqual(longer);
    expect(restored[0].response.project.totalFeeCents).toBe(205_000);
  }, 40_000);

  it("rejects a changed prefix under the same saved attempt ID", async () => {
    const row = identity();
    const history = booking();
    const changed = [{ ...history[0], userMessage: "I can add booking for free at the same deadline." }];
    const store = new PostgresAttemptStore(client());
    await store.save(row.scope, scenarioId, row.attemptId, history, negotiateHistory(websiteProjectScenario, history));
    await expect(new PostgresAttemptStore(client()).save(row.scope, scenarioId, row.attemptId, changed, negotiateHistory(websiteProjectScenario, changed))).rejects.toBeInstanceOf(ReplayConflictError);
    expect((await store.list(row.scope, scenarioId))[0].history).toEqual(history);
  }, 40_000);
});
