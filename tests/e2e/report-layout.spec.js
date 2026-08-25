import { expect, test } from "@playwright/test";


test("detailed report fits the desktop viewport", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.goto("/report");

  await expect(page.getByRole("heading", { name: "История без потери деталей" })).toBeVisible();
  await expect(page.getByText("Крайняя биометрия")).toBeVisible();
  await expect(page.getByRole("button", { name: "Для LLM" })).toBeVisible();

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(horizontalOverflow).toBe(false);

  await page.screenshot({
    path: testInfo.outputPath("detailed-report-2560.png"),
    fullPage: true,
  });
});

test("latest report response wins after a faster refresh", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/report?*", async (route) => {
    requests += 1;
    const first = requests === 1;
    if (first) await new Promise((resolve) => setTimeout(resolve, 350));
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        start: first ? "2026-01-01" : "2026-02-01",
        end: first ? "2026-01-31" : "2026-02-28",
        global_balance: first ? 101 : 202,
        latest_measurement: null,
        days: [],
      }),
    });
  });

  await page.goto("/report");
  await page.getByLabel("С").fill("2026-02-01");
  await page.getByLabel("По").fill("2026-02-28");
  await page.getByRole("button", { name: "Обновить" }).click();

  await expect(page.getByText("Глобальный счёт на 2026-02-28:")).toBeVisible();
  await expect(page.getByText("202 ккал")).toBeVisible();
});

test("clipboard failure is shown to the user", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: () => Promise.reject(new Error("denied")) },
    });
  });
  await page.goto("/report");
  await page.getByRole("button", { name: "Для LLM" }).click();

  await expect(
    page.getByText("Не удалось скопировать отчёт. Скачай .md файл."),
  ).toBeVisible();
});
