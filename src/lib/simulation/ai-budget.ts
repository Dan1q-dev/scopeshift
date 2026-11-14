import "server-only";
import { ReplayStoreError } from "./replay-store";
import type { SqlClient } from "./postgres-types";

export class DailyAiLimitError extends Error {
  constructor() { super("The demo's daily AI limit has been reached. Please try again tomorrow."); this.name = "DailyAiLimitError"; }
}

/** Atomic global quota across instances. Cached turns consume no new quota. */
export async function reserveAiCall(client: SqlClient, limit: number, now = new Date()) {
  try {
    const result = await client.query(`
      INSERT INTO scopeshift_ai_daily_usage (day, calls) VALUES ($1::date, 1)
      ON CONFLICT (day) DO UPDATE SET calls = scopeshift_ai_daily_usage.calls + 1
      WHERE scopeshift_ai_daily_usage.calls < $2
      RETURNING calls
    `, [now.toISOString().slice(0, 10), limit]);
    if (!result.rows.length) throw new DailyAiLimitError();
  } catch (cause) {
    if (cause instanceof DailyAiLimitError) throw cause;
    throw new ReplayStoreError("The shared AI quota could not be checked.");
  }
}
