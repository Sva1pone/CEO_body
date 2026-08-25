import { expect, test } from "@playwright/test";


test("new day setup renders without changing stored data", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.route("**/api/day?*", async (route) => {
    const response = await route.fetch();
    const payload = await response.json();

    await route.fulfill({
      response,
      json: {
        ...payload,
        day: {
          ...payload.day,
          setup_done: 0,
          training_planned: null,
        },
      },
    });
  });

  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Сегодня будет зал?" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Нет День отдыха" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Да Будет тренировка" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Начать с завтрака/ })).toBeDisabled();

  await page.getByRole("button", { name: "Да Будет тренировка" }).click();
  await expect(page.getByRole("button", { name: "Тестовый шаблон A" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Начать с завтрака/ })).toBeEnabled();

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(horizontalOverflow).toBe(false);

  await page.screenshot({
    path: testInfo.outputPath("today-setup-2560.png"),
    fullPage: true,
  });
});

test("setup materializes a viewed day only after confirmation", async ({ page }) => {
  let materializeRequests = 0;

  await page.route("**/api/day?date=*", async (route) => {
    if (route.request().method() === "POST") {
      materializeRequests += 1;
    }
    await route.continue();
  });

  await page.goto("/?date=2031-01-01");
  await expect(
    page.getByRole("heading", { name: "Сегодня будет зал?" }),
  ).toBeVisible();
  await expect.poll(() => materializeRequests).toBe(0);

  await page.getByRole("button", { name: "Нет День отдыха" }).click();
  await page.getByRole("button", { name: /Начать с завтрака/ }).click();

  await expect.poll(() => materializeRequests).toBe(1);
  await expect(page.getByText("Бюджет дня")).toBeVisible();
});


test("setup keeps the form open and shows an API error", async ({ page }) => {
  await page.route("**/api/day/*/setup", async (route) => {
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ error: "Не удалось сохранить сценарий дня." }),
    });
  });

  await page.goto("/?date=2031-01-02");
  await page.getByRole("button", { name: "Нет День отдыха" }).click();
  await page.getByRole("button", { name: /Начать с завтрака/ }).dblclick();

  await expect(page.getByText("Не удалось сохранить сценарий дня.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Сегодня будет зал?" }),
  ).toBeVisible();
});
