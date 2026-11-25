import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

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

// The text of every row, in the order the page shows them.
function shownNotes(page: Page) {
  return page.getByRole("listitem").locator("span").allTextContents();
}

test("the export and import buttons sit under the list of notes", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Note").fill("Acheter du pain");
  await page.getByRole("button", { name: "Ajouter" }).click();

  const list = await page.getByRole("list").boundingBox();
  const exportButton = await page.getByRole("button", { name: "Exporter les données" }).boundingBox();
  await expect(page.getByRole("button", { name: "Importer une sauvegarde" })).toBeVisible();
  // Under the list: the buttons start below the last row.
  expect(list!.y + list!.height).toBeLessThanOrEqual(exportButton!.y);
});

test("the exported file gives the notes back, in their order, after a reload", async ({ page }) => {
  await page.goto("/");
  for (const text of ["Acheter du pain", "Appeler"]) {
    await page.getByLabel("Note").fill(text);
    await page.getByRole("button", { name: "Ajouter" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: text })).toBeVisible();
  }
  const rows = page.getByRole("listitem");
  await expect(rows).toHaveCount(2);
  expect(await shownNotes(page)).toEqual(["Appeler", "Acheter du pain"]);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Exporter les données" }).click(),
  ]);
  const file = test.info().outputPath("notes.json");
  await download.saveAs(file);
  // The file holds the notes in display order, and nothing else.
  expect(JSON.parse(await readFile(file, "utf8"))).toEqual({ notes: ["Appeler", "Acheter du pain"] });

  // The notes are gone from the list and from the browser...
  await rows.first().getByRole("button", { name: "Supprimer" }).click();
  await expect(rows).toHaveCount(1);
  await rows.first().getByRole("button", { name: "Supprimer" }).click();
  await expect(rows).toHaveCount(0);

  // ...and the file puts them back, in their order, and they stay after a reload.
  await page.locator('input[type="file"]').setInputFiles(file);
  await expect(page.getByRole("status")).toHaveText("Notes importées.");
  expect(await shownNotes(page)).toEqual(["Appeler", "Acheter du pain"]);

  await page.reload();

  await expect(rows).toHaveCount(2);
  expect(await shownNotes(page)).toEqual(["Appeler", "Acheter du pain"]);
});
