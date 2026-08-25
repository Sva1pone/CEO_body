import { expect, test } from "@playwright/test";


test("workout journal fits the desktop viewport", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 2048, height: 1152 });
  await page.goto("/workout/1");

  await expect(page.getByRole("heading", { name: "Тестовый шаблон A — каждый подход виден" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Параметры сессии" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Дорожка по интервалам" })).toBeVisible();

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(horizontalOverflow).toBe(false);

  const setRows = page.locator("[data-workout-set-row]");
  await expect(setRows.first()).toBeVisible();

  const setRowLayout = await setRows.evaluateAll((rows) =>
    rows.map((row) => {
      const status = row.querySelector("[data-workout-set-status]");
      const deleteButton = row.querySelector("[data-workout-set-delete]");

      return {
        statusWidth: status?.getBoundingClientRect().width,
        deleteOffset: deleteButton?.getBoundingClientRect().left - row.getBoundingClientRect().left,
      };
    }),
  );

  expect(setRowLayout.length).toBeGreaterThan(1);
  expect(setRowLayout.every(({ statusWidth }) => statusWidth === 150)).toBe(true);
  expect(new Set(setRowLayout.map(({ deleteOffset }) => Math.round(deleteOffset))).size).toBe(1);

  await page.screenshot({
    path: testInfo.outputPath("workout-journal-2048.png"),
    fullPage: true,
  });
});
