import { expect, test } from "@playwright/test";


test("strategy settings fit the desktop viewport", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.goto("/settings");

  await expect(page.getByRole("heading", { name: "Меняй правила, не переписывая прошлое" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Параметры стратегии" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Резервные копии базы" })).toBeVisible();

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(horizontalOverflow).toBe(false);

  await page.screenshot({
    path: testInfo.outputPath("strategy-settings-2560.png"),
    fullPage: true,
  });
});

test("backup downloads stay within the local API origin", async ({ page }) => {
  await page.route("**/api/backups", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        backups: [
          {
            filename: "foreign.db",
            created_at: "2030-01-01T00:00:00",
            size: 100,
            download_url: "https://example.com/foreign.db",
          },
        ],
      }),
    });
  });

  await page.goto("/settings");
  await expect(page.locator('a[href*="example.com"]')).toHaveCount(0);
});
