import { expect, test } from "@playwright/test";


test("exercise catalog navigation fits the desktop viewport", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.goto("/exercises");

  await expect(page.getByRole("heading", { name: /Твоя карта/ })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Тренировочный день" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Подгруппа упражнений" })).toBeVisible();

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(horizontalOverflow).toBe(false);

  await page.screenshot({
    path: testInfo.outputPath("exercise-catalog-navigation-2560.png"),
    fullPage: true,
  });
});


test("exercise editor is readable and closes with Escape", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.goto("/exercises");
  await page.getByRole("button", { name: "Новое упражнение" }).click();

  const dialog = page.getByRole("dialog", { name: "Новое упражнение" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Выбери прямо на силуэте")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Сохранить" })).toBeVisible();
  await dialog.screenshot({
    path: testInfo.outputPath("exercise-editor-dialog.png"),
  });

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("exercise image rejects unsupported file before upload", async ({ page }) => {
  await page.goto("/exercises");
  const imageInput = page.locator('article[data-exercise-id] input[type="file"]').first();
  await expect(imageInput).toBeAttached();
  await imageInput.setInputFiles({
    name: "not-an-image.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });

  await expect(
    page.getByText("Фото должно быть PNG, JPG, WEBP или GIF."),
  ).toBeVisible();
});

test("exercise save ignores rapid repeat submit", async ({ page }, testInfo) => {
  await page.goto("/exercises");
  await page.getByRole("button", { name: "Новое упражнение" }).click();

  const dialog = page.getByRole("dialog", { name: "Новое упражнение" });
  await dialog
    .getByLabel("Название")
    .fill(`E2E двойное сохранение ${testInfo.repeatEachIndex}`);

  let createRequests = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/api/exercises")) {
      createRequests += 1;
    }
  });

  const submit = dialog.getByRole("button", { name: "Сохранить" });
  await submit.evaluate((button) => {
    button.click();
    button.click();
  });
  await expect(dialog).toBeHidden();
  expect(createRequests).toBe(1);
});

test("deleting a nonempty subgroup requires an explicit destination", async ({ page }) => {
  await page.goto("/exercises");
  const createDialogPromise = page.waitForEvent("dialog");
  const createClick = page.getByRole("button", { name: "Новая подгруппа" }).click();
  const createDialog = await createDialogPromise;
  await createDialog.accept("Временная подгруппа");
  await createClick;

  const subgroup = page.locator("[data-subgroup-id]").first();
  await subgroup.getByRole("button", { name: /Действия с подгруппой/ }).click();
  const deleteDialogPromise = page.waitForEvent("dialog");
  const deleteClick = subgroup.getByRole("button", { name: "Удалить" }).click();
  const deleteDialog = await deleteDialogPromise;
  expect(deleteDialog.type()).toBe("prompt");
  expect(deleteDialog.defaultValue()).toBe("");
  await deleteDialog.dismiss();
  await deleteClick;
  await expect(
    page.getByRole("button", { name: "Временная подгруппа", exact: true }),
  ).toBeVisible();
});
