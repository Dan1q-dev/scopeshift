import "server-only";
import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";

const pools = new Map<string, Pool>();

/** Reuse a small pool within an instance; receipts themselves live in Postgres. */
export function getDatabasePool(connectionString: string): Pool {
  let pool = pools.get(connectionString);
  if (!pool) {
    const url = new URL(connectionString);
    // Verify the managed database certificate, including its hostname.
    url.searchParams.set("sslmode", "verify-full");
    pool = new Pool({ connectionString: url.toString(), max: 2, idleTimeoutMillis: 5_000, connectionTimeoutMillis: 10_000, allowExitOnIdle: true });
    pool.on("error", () => console.error("ScopeShift idle database connection failed."));
    attachDatabasePool(pool);
    pools.set(connectionString, pool);
  }
  return pool;
}
