import { readFile } from "node:fs/promises";
import { Pool } from "pg";

const connectionString = process.env.SCOPESHIFT_DATABASE_URL;
if (!connectionString) throw new Error("SCOPESHIFT_DATABASE_URL is required.");
const url = new URL(connectionString);
if (url.hostname.includes("-pooler")) throw new Error("Use a direct database connection for migrations.");
url.searchParams.set("sslmode", "verify-full");
const pool = new Pool({ connectionString: url.toString(), max: 1, connectionTimeoutMillis: 10_000 });
try {
  const includeRealProjects = process.argv.includes("--real-project-mode");
  if (process.argv.slice(2).some((argument) => argument !== "--real-project-mode")) throw new Error("Unsupported migration argument.");
  const migrations = ["001_durable_history.sql", ...(includeRealProjects ? ["002_real_project_mode.sql"] : [])];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const file of migrations) await client.query(await readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8"));
    await client.query("COMMIT");
    console.log(`ScopeShift migrations applied: ${migrations.join(", ")}`);
  } catch (cause) {
    await client.query("ROLLBACK");
    throw cause;
  } finally { client.release(); }
} catch (cause) {
  console.error("ScopeShift migration failed:", cause instanceof Error ? cause.name : "UnknownError");
  process.exitCode = 1;
} finally {
  await pool.end();
}
