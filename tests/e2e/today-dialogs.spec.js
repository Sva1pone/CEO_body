import { expect, test } from "@playwright/test";


test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.goto("/?date=2035-07-31");
});


test("product picker is readable and closes with Escape", async ({ page }, testInfo) => {
  await page.locator(".finder-card article button").first().click();

  const dialog = page.getByRole("dialog", { name: /Добавить/ });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: /Добавить в/ })).toBeVisible();
  await expect(dialog).toHaveCSS("overflow-y", "auto");
  await expect(dialog.getByTestId("category-icon")).toHaveCSS("width", "70px");

  await page.screenshot({
    path: testInfo.outputPath("product-picker-2560.png"),
    fullPage: true,
  });
  await dialog.screenshot({
    path: testInfo.outputPath("product-picker-dialog.png"),
  });

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});


test("entry editor is readable and closes with Escape", async ({ page }, testInfo) => {
  await page.locator('svg [role="button"]').first().click();

  const dialog = page.getByRole("dialog", { name: /Изменить/ });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Сохранить" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Удалить" })).toBeVisible();
  await expect(dialog.getByTestId("category-icon")).toHaveCSS("width", "70px");

  await page.screenshot({
    path: testInfo.outputPath("entry-editor-2560.png"),
    fullPage: true,
  });
  await dialog.screenshot({
    path: testInfo.outputPath("entry-editor-dialog.png"),
  });

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});


test("workout starter is readable and closes with Escape", async ({ page }, testInfo) => {
  await page.getByRole("button", { name: "Начать тренировку" }).click();

  const dialog = page.getByRole("dialog", { name: "Выбери шаблон" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: /Открыть журнал/ })).toBeVisible();
  await dialog.screenshot({
    path: testInfo.outputPath("workout-starter-dialog.png"),
  });

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});


test("delete day confirmation is readable and closes with Escape", async ({ page }, testInfo) => {
  await page.getByRole("button", { name: "Удалить день" }).click();

  const dialog = page.getByRole("dialog", { name: /Удалить день/ });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByPlaceholder("ГГГГ-ММ-ДД")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Удалить безвозвратно" })).toBeDisabled();
  await dialog.screenshot({
    path: testInfo.outputPath("delete-day-dialog.png"),
  });

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});


test("closing a day sends one request during repeated clicks", async ({ page }) => {
  let closeRequests = 0;

  await page.route("**/api/day/*/close", async (route) => {
    closeRequests += 1;
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.continue();
  });

  const closeButton = page.getByRole("button", { name: "Закрыть день" });
  await expect(closeButton).toBeVisible();
  await closeButton.dblclick();

  await expect.poll(() => closeRequests).toBe(1);
  await expect(page.getByText("День закрыт и учтён в глобальном счёте")).toBeVisible();

  const reopenButton = page.getByRole("button", { name: "Открыть для правок" });
  await reopenButton.click();
  await expect(page.getByText("День снова открыт")).toBeVisible();
});

test("food mutation error is visible instead of an unhandled rejection", async ({ page }) => {
  await page.route("**/api/food/*", async (route) => {
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ error: "День уже закрыт." }),
    });
  });

  await page.getByRole("button", { name: /Удалить Тестовый продукт/ }).click();
  await expect(page.getByRole("alert")).toContainText("День уже закрыт.");
});
