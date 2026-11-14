import { expect, test } from "@playwright/test";

test("Improve this reply restores the earlier prefix, prefills without sending, and preserves comparison", async ({ page }) => {
  const paid = "I can add booking for an extra $400 and two more days.";
  const expensive = "I can deliver two days earlier for an extra $900.";
  const corrected = "I can deliver two days earlier for an extra $150.";
  const submissions: { history: { userMessage: string }[] }[] = [];
  page.on("request", (request) => { if (request.url().endsWith("/api/negotiate") && request.method() === "POST") submissions.push(request.postDataJSON()); });
  await page.goto("/simulation");
  const editor = page.getByRole("textbox", { name: "Your reply to the client" });
  for (const message of [paid, expensive]) {
    await editor.fill(message); await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(editor).toBeEnabled();
  }
  await page.getByRole("link", { name: "Results", exact: true }).click();
  const focus = page.getByRole("complementary", { name: "Your next practice focus" });
  await expect(focus).toContainText(expensive);
  await focus.getByRole("link", { name: "Improve this reply", exact: true }).click();
  await expect(editor).toHaveValue(expensive);
  await expect(editor).toBeEnabled();
  await expect(page.getByRole("region", { name: "Project impact" })).toContainText("$1,900");
  expect(submissions).toHaveLength(3); // Only the preserved prefix was replayed, never the original chosen reply.
  expect(submissions[2].history.map((entry) => entry.userMessage)).toEqual([paid]);
  await expect(page.getByRole("tab", { name: "Attempt 2", exact: true })).toHaveAttribute("aria-selected", "true");
  await editor.fill(corrected); await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("region", { name: "Project impact" })).toContainText("$2,050");
  await page.getByRole("link", { name: "Results", exact: true }).click();
  await expect(page.getByRole("region", { name: "Attempt 1", exact: true })).toContainText("$1,900");
  await expect(page.getByRole("region", { name: "Attempt 2", exact: true })).toContainText("$2,050");
});
