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
