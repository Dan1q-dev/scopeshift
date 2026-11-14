import { expect, test } from "@playwright/test";

test("marketing page opens Arsen's real simulation panels", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "ScopeShift", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Start free simulation", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Simulation workspace" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Your reply to the client" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Project impact" })).toContainText("$75.00/h");
  const response = await request.get("/api/scenarios");
  expect(response.ok()).toBeTruthy();
  expect((await response.json()).scenarios[0].id).toBe("web-project-01");
});
