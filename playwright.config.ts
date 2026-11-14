import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PW_TEST_PORT || 3210);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("PW_TEST_PORT must be an integer between 1024 and 65535.");
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  workers: process.env.CI ? 1 : undefined,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    env: { SCOPESHIFT_AI_MODE: "rules", OPENAI_API_KEY: "", SCOPESHIFT_DATABASE_URL: "" },
  },
});
