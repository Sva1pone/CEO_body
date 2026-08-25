import { expect, test } from "@playwright/test";


test("statistics dashboard fits the desktop viewport", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.goto("/statistics");

  await expect(page.getByRole("heading", { name: "Не отдельные дни, а система" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Буфер → чистый дефицит" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Объём и мышечный баланс" })).toBeVisible();

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(horizontalOverflow).toBe(false);

  await page.screenshot({
    path: testInfo.outputPath("statistics-dashboard-2560.png"),
    fullPage: true,
  });
});
