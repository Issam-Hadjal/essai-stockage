import { expect, test } from "@playwright/test";

// Every test gets a browser context of its own: the notes start empty, and the ones
// written stay in that browser only.
test("a note is still there after a reload", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Note").fill("Acheter du pain");
  await page.getByRole("button", { name: "Ajouter" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Acheter du pain" })).toBeVisible();

  await page.reload();

  await expect(page.getByRole("listitem").filter({ hasText: "Acheter du pain" })).toBeVisible();
});

test("a note can be removed", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Note").fill("Acheter du pain");
  await page.getByRole("button", { name: "Ajouter" }).click();
  const row = page.getByRole("listitem").filter({ hasText: "Acheter du pain" });
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: "Supprimer" }).click();

  await expect(row).toHaveCount(0);
});
