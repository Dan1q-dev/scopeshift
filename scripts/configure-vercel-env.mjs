import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { parseEnv } from "node:util";

const scope = process.argv[2];
if (!scope) throw new Error("Pass the intended Vercel scope.");
const project = JSON.parse(await readFile(new URL("../.vercel/project.json", import.meta.url), "utf8"));
if (project.projectName !== "scopeshift") throw new Error("This working copy must be linked to the ScopeShift Vercel project.");
const local = parseEnv(await readFile(new URL("../.env.local", import.meta.url), "utf8"));
const production = parseEnv(await readFile(new URL("../.env.deployment.production", import.meta.url), "utf8"));
const values = {
  SCOPESHIFT_AI_MODE: "openai",
  SCOPESHIFT_STORAGE: "postgres",
  SCOPESHIFT_DATABASE_URL: production.SCOPESHIFT_DATABASE_URL,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || local.OPENAI_API_KEY,
  OPENAI_MODEL: local.OPENAI_MODEL || "gpt-5.4-mini",
  OPENAI_TIMEOUT_MS: "30000",
  SCOPESHIFT_SESSION_SECRET: local.SCOPESHIFT_SESSION_SECRET,
  SCOPESHIFT_DAILY_AI_CALL_LIMIT: "200",
};
const cli = process.env.VERCEL_CLI_PATH || join(process.env.APPDATA || "", "npm", "node_modules", "vercel", "dist", "vc.js");
for (const [name, value] of Object.entries(values)) {
  if (!value?.trim()) throw new Error(`Required value is missing: ${name}`);
  const args = [cli, "env", "add", name, "production", "--sensitive", "--yes", "--scope", scope];
  if (process.argv.includes("--force")) args.push("--force");
  const result = spawnSync(process.execPath, args, { input: value.trim(), encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  // Never print values, provider output or auth tokens.
  if (result.status !== 0) throw new Error(`Vercel environment update failed for ${name} (exit ${result.status}).`);
  console.log(`Configured ${name}.`);
}
