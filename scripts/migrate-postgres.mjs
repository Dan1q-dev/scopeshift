import { readFile } from "node:fs/promises";
import { Pool } from "pg";

const connectionString = process.env.SCOPESHIFT_DATABASE_URL;
if (!connectionString) throw new Error("SCOPESHIFT_DATABASE_URL is required.");
const url = new URL(connectionString);
if (url.hostname.includes("-pooler")) throw new Error("Use a direct database connection for migrations.");
url.searchParams.set("sslmode", "verify-full");
const pool = new Pool({ connectionString: url.toString(), max: 1, connectionTimeoutMillis: 10_000 });
try {
  const sql = await readFile(new URL("../migrations/001_durable_history.sql", import.meta.url), "utf8");
  await pool.query(sql);
  console.log("ScopeShift durable-history migration applied.");
} catch (cause) {
  console.error("ScopeShift migration failed:", cause instanceof Error ? cause.name : "UnknownError");
  process.exitCode = 1;
} finally {
  await pool.end();
}
