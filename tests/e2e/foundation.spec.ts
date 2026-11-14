import { expect, test } from "@playwright/test";

test("foundation loads and public scenario API is available", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "ScopeShift", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Open development workspace" }).click();
  await expect(page.getByRole("heading", { name: "Simulation workspace" })).toBeVisible();
  const response = await request.get("/api/scenarios");
  expect(response.ok()).toBeTruthy();
  expect((await response.json()).scenarios[0].id).toBe("web-project-01");
});
