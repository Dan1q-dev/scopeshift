import { expect, test, type Page } from "@playwright/test";
import { negotiateResponseSchema } from "../../src/types/scope";

const paid = "I can add booking for an extra $400 and two more days.";
const free = "I can add it for free with no change to the deadline.";
const rush = "I can deliver two days earlier for an extra $150.";
const swap = "Replace the portfolio gallery with testimonials at the same price and deadline.";
async function send(page: Page, message: string) {
  await page.getByRole("textbox", { name: "Your reply to the client" }).fill(message);
  const response = page.waitForResponse(r => r.url().endsWith("/api/negotiate") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const result = await response;
  expect(result.status()).toBe(200);
  return negotiateResponseSchema.parse(await result.json());
}

test("paid completion, free Replay, comparison and persisted original attempt", async ({ page }) => {
  await page.goto("/simulation");
  const impact = page.getByRole("region", { name: "Project impact" });
  await expect(impact).toContainText("$75.00/h");
  await send(page, paid);
  await expect(impact).toContainText("$1,900");
  await send(page, rush);
  const original = await send(page, swap);
  expect(original.project.totalFeeCents).toBe(205000);
  await expect(page.getByRole("textbox")).toBeDisabled();
  await page.getByRole("button", { name: "Replay from here" }).first().click();
  await expect(page.getByRole("tab", { name: "Attempt 2", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(impact).toContainText("$75.00/h");
  await send(page, free);
  await send(page, "I decline this request.");
  const alternative = await send(page, swap);
  expect(alternative.project).toMatchObject({ totalFeeCents: 150000, estimatedHours: 26, deadlineDays: 7 });
  await page.getByRole("link", { name: "Results", exact: true }).click();
  const first = page.getByRole("region", { name: "Attempt 1", exact: true });
  const second = page.getByRole("region", { name: "Attempt 2", exact: true });
  await expect(first).toContainText("$2,050");
  await expect(first).toContainText("$78.85/h");
  await expect(second).toContainText("$1,500");
  await expect(second).toContainText("$57.69/h");
  await expect(first).toContainText("Rule:");
  await expect(first).toContainText("Action:");
  await page.reload();
  await expect(first).toContainText("$2,050");
  await expect(second).toContainText("$1,500");
});

test("counteroffer is pending until acceptance, then refusal keeps economics", async ({ page }) => {
  await page.goto("/simulation");
  const pending = await send(page, "I can add booking for an extra $900 and two more days.");
  expect(pending.project.totalFeeCents).toBe(150000);
  await expect(page.getByRole("log")).toContainText("contract is unchanged until you accept");
  const accepted = await send(page, "I accept your offer.");
  expect(accepted.project.totalFeeCents).toBe(190000);
  const declined = await send(page, "I decline this request.");
  expect(declined.project).toEqual(accepted.project);
});

test("lost response after real server acceptance retries identical turn without double application", async ({ page }) => {
  const bodies: unknown[] = [];
  await page.route("**/api/negotiate", async route => {
    bodies.push(route.request().postDataJSON());
    if (bodies.length === 1) {
      const response = await route.fetch(); // Real backend processes the request.
      expect(response.status()).toBe(200);
      await route.abort("failed"); // Inject only a lost response, never a fake agreement.
    } else await route.continue();
  });
  await page.goto("/simulation");
  await page.getByRole("textbox", { name: "Your reply to the client" }).fill(paid);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  const retry = page.waitForResponse(r => r.url().endsWith("/api/negotiate"));
  await page.getByRole("button", { name: "Send again" }).click();
  const result = negotiateResponseSchema.parse(await (await retry).json());
  expect(bodies).toHaveLength(2);
  expect(bodies[0]).toEqual(bodies[1]);
  expect(result.project).toMatchObject({ totalFeeCents: 190000, estimatedHours: 26 });
  expect(result.project.acceptedAgreementIds).toHaveLength(1);
  await expect(page.getByRole("region", { name: "Project impact" })).toContainText("$1,900");
});

