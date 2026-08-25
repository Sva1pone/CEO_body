import { expect, test } from "@playwright/test";


test("progress dashboard and measurement dialog fit desktop", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.goto("/progress");

  await expect(page.getByRole("heading", { name: "Сила и форма — в цифрах" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "История замеров" })).toBeVisible();

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(horizontalOverflow).toBe(false);

  await page.getByRole("button", { name: "Новый замер" }).click();
  const dialog = page.getByRole("dialog", { name: "Новый замер" });
  await expect(dialog).toBeVisible();
  await dialog.screenshot({ path: testInfo.outputPath("measurement-dialog.png") });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await page.screenshot({
    path: testInfo.outputPath("progress-dashboard-2560.png"),
    fullPage: true,
  });
});

test("double click saves one measurement", async ({ page }) => {
  let saveRequests = 0;

  await page.route("**/api/progress", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    saveRequests += 1;
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.fulfill({ json: { measurements: [], records: [] } });
  });

  await page.goto("/progress");
  await page.getByRole("button", { name: "Новый замер" }).click();
  await page.getByRole("button", { name: "Сохранить замер" }).dblclick();

  await expect.poll(() => saveRequests).toBe(1);
});
