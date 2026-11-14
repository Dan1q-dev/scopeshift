import "server-only";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import type { NegotiationTurn } from "@/types/scope";
import type { SqlClient } from "./postgres-types";
import {
  assertReplayRecordIdentity,
  createReplayReceipt,
  parseReplayIdentity,
  readReplayReceipt,
  replayKey,
  replayRecordIdentity,
  ReplayStoreError,
  type ReplayIdentity,
  type ReplayStore,
} from "./replay-store";

const rowSchema = z.object({
  identity: z.unknown(),
  status: z.enum(["pending", "complete"]),
  owner_token: z.string().uuid(),
  receipt: z.unknown().nullable(),
}).strict();

export interface PostgresReplayStoreOptions {
  lockTimeoutMs?: number;
  lockPollMs?: number;
  /** True only for a known producer failure whose claim may safely be released. */
  canReleaseOnProduceError?: (cause: unknown) => boolean;
}

/** Each query must use autocommit. A pending claim is durable before inference.
 * Unknown failures and process deaths retain that claim, preventing silent
 * re-inference after an ambiguous paid call. Pending claims never expire here.
 */
export class PostgresReplayStore implements ReplayStore {
  private readonly lockTimeoutMs: number;
  private readonly lockPollMs: number;
  private readonly canReleaseOnProduceError: (cause: unknown) => boolean;

  constructor(private readonly sql: SqlClient, options: PostgresReplayStoreOptions = {}) {
    this.lockTimeoutMs = options.lockTimeoutMs ?? 5_000;
    this.lockPollMs = options.lockPollMs ?? 50;
    this.canReleaseOnProduceError = options.canReleaseOnProduceError ?? (() => false);
    if (!Number.isInteger(this.lockTimeoutMs) || this.lockTimeoutMs < 1 || this.lockTimeoutMs > 60_000
      || !Number.isInteger(this.lockPollMs) || this.lockPollMs < 1 || this.lockPollMs > 1_000) {
      throw new ReplayStoreError("Replay lock timing configuration is invalid.");
    }
  }

  async getOrCreate(input: ReplayIdentity, produce: () => Promise<NegotiationTurn>): Promise<NegotiationTurn> {
    const identity = parseReplayIdentity(input);
    const key = replayKey(identity);
    const deadline = performance.now() + this.lockTimeoutMs;

    while (true) {
      const existing = await this.query(
        "SELECT identity, status, owner_token, receipt FROM scopeshift_replay_receipts WHERE key = $1",
        [key],
      );
      if (existing.rows.length > 1) throw new ReplayStoreError();
      if (existing.rows.length === 1) {
        const parsed = rowSchema.safeParse(existing.rows[0]);
        if (!parsed.success) throw new ReplayStoreError("The stored replay record is invalid.");
        const row = parsed.data;
        assertReplayRecordIdentity(row.identity, identity);
        if (row.status === "complete") return readReplayReceipt(row.receipt, identity);
        if (row.receipt !== null) throw new ReplayStoreError("The pending replay record is invalid.");
      } else {
        const owner = randomUUID();
        const claim = await this.query(
          "INSERT INTO scopeshift_replay_receipts (key, identity, status, owner_token) VALUES ($1, $2::jsonb, 'pending', $3::uuid) ON CONFLICT (key) DO NOTHING RETURNING key",
          [key, JSON.stringify(replayRecordIdentity(identity)), owner],
        );
        if (claim.rowCount === 1 && claim.rows.length === 1) return this.produceClaimed(key, owner, identity, produce);
        if (claim.rowCount !== 0 || claim.rows.length !== 0) throw new ReplayStoreError();
      }
      const remaining = deadline - performance.now();
      if (remaining <= 0) throw new ReplayStoreError("Replay persistence is busy. Please retry the request.");
      await delay(Math.min(remaining, this.lockPollMs));
    }
  }

  private async produceClaimed(key: string, owner: string, identity: ReplayIdentity, produce: () => Promise<NegotiationTurn>) {
    let produced: NegotiationTurn;
    try {
      produced = await produce();
    } catch (cause) {
      if (this.canReleaseOnProduceError(cause)) {
        const released = await this.query(
          "DELETE FROM scopeshift_replay_receipts WHERE key = $1 AND owner_token = $2::uuid AND status = 'pending' RETURNING key",
          [key, owner],
        );
        if (released.rowCount !== 1) throw new ReplayStoreError();
      }
      throw cause;
    }
    // Validation or commit failures deliberately leave the durable pending claim.
    const receipt = createReplayReceipt(identity, produced);
    const committed = await this.query(
      "UPDATE scopeshift_replay_receipts SET status = 'complete', receipt = $3::jsonb, completed_at = now() WHERE key = $1 AND owner_token = $2::uuid AND status = 'pending' RETURNING receipt",
      [key, owner, JSON.stringify(receipt)],
    );
    if (committed.rowCount !== 1 || committed.rows.length !== 1) throw new ReplayStoreError("Replay claim ownership changed unexpectedly.");
    const saved = readReplayReceipt(committed.rows[0].receipt, identity);
    if (JSON.stringify(saved) !== JSON.stringify(receipt.turn)) throw new ReplayStoreError("The committed replay turn is inconsistent.");
    return saved;
  }

  private async query(text: string, values: unknown[]) {
    try { return await this.sql.query(text, values); } catch { throw new ReplayStoreError(); }
  }
}
