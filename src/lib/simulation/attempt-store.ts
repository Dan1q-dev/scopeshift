import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { historyEntrySchema, idSchema, serverAttemptSchema, type HistoryEntry, type NegotiateResponse, type ServerAttempt } from "@/types/scope";
import { ReplayConflictError, ReplayStoreError } from "./replay-store";
import type { SqlClient } from "./postgres-types";

const scopeHash = (scope: string) => createHash("sha256").update(scope).digest("hex");
const MAX_HISTORY_LIST_BYTES = 3 * 1024 * 1024;
const historySchema = z.array(historyEntrySchema).min(1).max(50);
const rowSchema = z.object({ attempt_id: idSchema, history: historySchema, response: z.unknown(), created_at: z.union([z.date(), z.string()]) });

function isPrefix(prefix: readonly HistoryEntry[], history: readonly HistoryEntry[]) {
  return prefix.length <= history.length && prefix.every((entry, index) => JSON.stringify(entry) === JSON.stringify(history[index]));
}

/** Stores only responses produced by the server, scoped to a signed anonymous identity. */
export class PostgresAttemptStore {
  constructor(private readonly sql: SqlClient) {}

  async save(scope: string, scenarioId: string, attemptId: string, history: readonly HistoryEntry[], response: NegotiateResponse): Promise<void> {
    try {
      idSchema.parse(scenarioId);
      idSchema.parse(attemptId);
      if (!scope.trim()) throw new ReplayStoreError();
      const validated = serverAttemptSchema.parse({ id: attemptId, createdAt: 0, history, response });
      if (validated.response.scenarioId !== scenarioId) throw new ReplayStoreError();
      const hash = scopeHash(scope);
      const updated = await this.sql.query(`
        INSERT INTO scopeshift_attempts (scope_hash, scenario_id, attempt_id, history, response)
        VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
        ON CONFLICT (scope_hash, scenario_id, attempt_id) DO UPDATE
        SET history = EXCLUDED.history, response = EXCLUDED.response, updated_at = now()
        WHERE jsonb_array_length(scopeshift_attempts.history) <= jsonb_array_length(EXCLUDED.history)
          AND NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(scopeshift_attempts.history) WITH ORDINALITY AS prior(entry, position)
            WHERE prior.entry IS DISTINCT FROM EXCLUDED.history -> (prior.position::integer - 1)
          )
        RETURNING attempt_id
      `, [hash, scenarioId, attemptId, JSON.stringify(validated.history), JSON.stringify(validated.response)]);
      if (updated.rows.length) return;
      // An older retry must not overwrite a newer accepted result. A changed branch
      // needs a new attempt ID rather than replacing another saved history.
      const current = await this.sql.query("SELECT history FROM scopeshift_attempts WHERE scope_hash = $1 AND scenario_id = $2 AND attempt_id = $3", [hash, scenarioId, attemptId]);
      const stored = historySchema.safeParse(current.rows[0]?.history);
      if (stored.success && isPrefix(validated.history, stored.data)) return;
      throw new ReplayConflictError();
    } catch (cause) {
      if (cause instanceof ReplayConflictError || cause instanceof ReplayStoreError) throw cause;
      throw new ReplayStoreError("Saved attempt history is unavailable. Please retry the request.");
    }
  }

  async list(scope: string, scenarioId: string): Promise<ServerAttempt[]> {
    try {
      if (!scope.trim()) throw new ReplayStoreError();
      idSchema.parse(scenarioId);
      const result = await this.sql.query(`
        SELECT attempt_id, history, response, created_at
        FROM scopeshift_attempts
        WHERE scope_hash = $1 AND scenario_id = $2
        ORDER BY updated_at DESC, attempt_id DESC LIMIT 20
      `, [scopeHash(scope), scenarioId]);
      const attempts: ServerAttempt[] = [];
      let bytes = Buffer.byteLength('{"attempts":[]}');
      for (const raw of result.rows) {
        const row = rowSchema.parse(raw);
        const attempt = serverAttemptSchema.parse({ id: row.attempt_id, history: row.history, response: row.response, createdAt: new Date(row.created_at).getTime() });
        if (attempt.response.scenarioId !== scenarioId) throw new ReplayStoreError();
        const additional = Buffer.byteLength(JSON.stringify(attempt), "utf8") + (attempts.length ? 1 : 0);
        if (bytes + additional > MAX_HISTORY_LIST_BYTES) continue;
        bytes += additional;
        attempts.push(attempt);
      }
      // Prefer the newest snapshots under the HTTP payload limit. Skipped rows
      // remain in Postgres; no stored history is removed by a read.
      return attempts.reverse();
    } catch {
      throw new ReplayStoreError("Saved attempt history is unavailable. Please reload to retry.");
    }
  }
}
