import { expect, test } from "@playwright/test";

test("landing opens the workspace with the public scenario", async ({ page, request }) => {
  const response = await request.get("/api/scenarios");
  expect(response.ok()).toBeTruthy();
  expect((await response.json()).scenarios[0]).toMatchObject({
    id: "web-project-01",
    title: "Sarah Mitchell - Website Project",
    initialFeeCents: 150000,
    estimatedHours: 20,
    deadlineDays: 7,
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Stop working for free. Learn to negotiate.", exact: true })).toBeVisible();
  // The hero and closing section both have this CTA; enter through the hero.
  await page.getByRole("main").getByRole("link", { name: "Start free simulation", exact: true }).first().click();
  await expect(page).toHaveURL(/\/simulation$/);
  await expect(page.getByRole("heading", { level: 1, name: "Simulation workspace", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Sarah Mitchell - Website Project", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Original contract", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Client conversation", exact: true })).toBeVisible();
});
