import { expect, test } from "@playwright/test";


test("exercise pack parent selection controls all descendants", async ({ page }) => {
  let lastSummaryRequest;
  await page.route("**/api/exercise-packs/summary", async (route) => {
    lastSummaryRequest = route.request().postDataJSON();
    await route.fulfill({
      json: { templates: 3, subgroups: 3, exercises: 3, image_bytes: 0 },
    });
  });
  await page.goto("/exercises");
  await page.getByRole("button", { name: "Импорт и экспорт" }).click();

  const dialog = page.getByRole("dialog", { name: "Паки упражнений" });
  const selectAll = dialog.getByLabel("Выбрать всё");
  await expect(selectAll).toBeChecked();

  const firstTemplateLabel = dialog
    .locator("label")
    .filter({ hasText: "Тестовый шаблон A" })
    .first();
  const templateBranch = firstTemplateLabel.locator("..");
  await firstTemplateLabel.locator('input[type="checkbox"]').uncheck();

  await expect(templateBranch.locator('input[type="checkbox"]:checked')).toHaveCount(0);
  await expect.poll(() => lastSummaryRequest?.selection?.subgroup_ids?.length).toBe(2);
});

test("exercise pack preview and import stay bound to the latest file", async ({ page }) => {
  let previewRequestCount = 0;
  let importedBody;
  await page.route("**/api/exercise-packs/preview", async (route) => {
    previewRequestCount += 1;
    const isFirst = previewRequestCount === 1;
    if (isFirst) await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({
      json: {
        summary: { templates: 1, subgroups: 1, exercises: 2, images: 0 },
        templates: [{
          key: "template-1",
          name: isFirst ? "Первый пак" : "Второй пак",
          subgroups: [{
            key: "subgroup-1",
            name: "Основная группа",
            exercises: [{ key: "exercise-1", name: isFirst ? "Старое упражнение" : "Новое упражнение" }],
          }],
        }],
        unplaced_exercises: [{ key: "exercise-2", name: "Без группы" }],
      },
    });
  });
  await page.route("**/api/exercise-packs/import", async (route) => {
    importedBody = route.request().postDataBuffer().toString("utf8");
    await route.fulfill({ json: { created: 2, updated: 0, skipped: 0, errors: [] } });
  });
  await page.goto("/exercises");
  const trigger = page.getByRole("button", { name: "Импорт и экспорт" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Паки упражнений" });
  const importMode = dialog.getByRole("button", { name: "Импорт" });
  await importMode.click();
  await expect(importMode).toHaveAttribute("aria-pressed", "true");

  const fileInput = dialog.locator('input[type="file"]');
  await fileInput.setInputFiles({ name: "first.ceopack.zip", mimeType: "application/zip", buffer: Buffer.from("first") });
  await fileInput.setInputFiles({ name: "second.ceopack.zip", mimeType: "application/zip", buffer: Buffer.from("second") });

  await expect(dialog.getByText("Второй пак", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Новое упражнение", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Без группы", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Первый пак", { exact: true })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Импортировать целиком" }).click();
  await expect(dialog.getByRole("status")).toContainText("создано 2");
  expect(importedBody).toContain("second.ceopack.zip");

  await dialog.getByRole("button", { name: "Закрыть" }).click();
  await expect(trigger).toBeFocused();
});
