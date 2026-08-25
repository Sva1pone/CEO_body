import { expect, test } from "@playwright/test";


test("products are managed inside the Today page", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 2048, height: 1152 });
  await page.goto("/?date=2035-07-25");

  await expect(page.getByRole("button", { name: "Новый продукт" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Реестр" })).toHaveCount(0);

  const editButtons = page.locator('button[aria-label^="Изменить "]');
  expect(await editButtons.count()).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Новый продукт" }).click();
  const createDialog = page.getByRole("dialog", { name: "Новая позиция" });
  await expect(createDialog).toBeVisible();
  await expect(createDialog.locator('input[type="file"]')).toHaveCount(1);
  await expect(page.getByLabel("Название")).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath("inline-product-management-2048.png"),
    fullPage: true,
  });
});

test("product browser has no separate finisher panel", async ({ page }) => {
  await page.setViewportSize({ width: 2048, height: 1152 });
  await page.goto("/?date=2035-07-27");

  await expect(page.getByRole("button", { name: "Новый продукт" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Чем закрыть день" })).toHaveCount(0);
  await expect(page.locator(".finder-card article").first()).toBeVisible();
});

test("product category pagination exposes every matching product", async ({ page }) => {
  await page.setViewportSize({ width: 2048, height: 1152 });
  await page.goto("/?date=2035-07-25");

  await page.getByRole("button", { name: "Тестовая категория" }).click();

  const productCards = page.locator(".finder-card article");
  await expect(productCards).toHaveCount(8);
  await expect(page.getByRole("status")).toContainText("страница 1 из 2");

  await page.getByRole("button", { name: "Далее" }).click();

  await expect(productCards).toHaveCount(3);
  await expect(page.getByRole("status")).toContainText("страница 2 из 2");
  await expect(page.getByRole("button", { name: "Назад" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Далее" })).toBeDisabled();
});

test("product form rejects unsupported image before upload", async ({ page }) => {
  await page.goto("/?date=2035-07-25");
  await page.getByRole("button", { name: "Новый продукт" }).click();

  const dialog = page.getByRole("dialog", { name: "Новая позиция" });
  await dialog.locator('input[name="image"]').setInputFiles({
    name: "not-an-image.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });

  await expect(
    dialog.getByText("Фото должно быть PNG, JPG, WEBP или GIF."),
  ).toBeVisible();
});

test("product can be archived and restored without leaving Today", async ({ page }) => {
  await page.goto("/?date=2035-07-25");

  const editButton = page.locator('button[aria-label^="Изменить "]').first();
  const productName = (await editButton.getAttribute("aria-label")).replace("Изменить ", "");
  await editButton.click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "В архив" }).click();

  await page.getByRole("button", { name: "Архив", exact: true }).click();
  const restoreButton = page.getByRole("button", { name: `Восстановить ${productName}` });
  await expect(restoreButton).toBeVisible();
  await restoreButton.click();
  await expect(restoreButton).toHaveCount(0);
});

test("temp product is added to the current day and remains available for promotion", async ({ page }) => {
  await page.goto("/?date=2035-07-25");
  await page.getByRole("button", { name: "Быстро TEMP" }).click();

  const dialog = page.getByRole("dialog", { name: "Новая TEMP-позиция" });
  await dialog.getByLabel("Название").fill("Разовый десерт E2E");
  await dialog.getByLabel("Калории").fill("220");
  await dialog.getByLabel("Белок, г").fill("12");
  await dialog.getByRole("button", { name: /Добавить в/ }).click();

  await page.getByRole("button", { name: "TEMP", exact: true }).click();
  await expect(
    page.getByRole("article").filter({ hasText: "Разовый десерт E2E" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "В реестр" })).toBeVisible();
});

test("product subcategory collects and accepts products", async ({ page }) => {
  await page.goto("/?date=2035-07-25");
  await page.getByRole("button", { name: "Тестовая категория" }).click();

  page.once("dialog", (dialog) => dialog.accept("Сладкое"));
  await page.getByRole("button", { name: "Подкатегория" }).click();

  const unassigned = page.getByRole("button", { name: "Неразмечено" });
  const target = page.getByRole("button", { name: "Сладкое" });
  await expect(unassigned).toBeVisible();
  await expect(target).toBeVisible();

  await page.locator(".finder-card article").first().dragTo(target);
  await expect(page.getByText("Позиция перемещена", { exact: true })).toBeVisible();
  await target.click();
  await expect(page.locator(".finder-card article")).toHaveCount(1);
});
