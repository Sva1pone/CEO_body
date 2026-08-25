import { expect, test } from "@playwright/test";


test("native select options keep dark readable colors", async ({ page }) => {
  await page.goto("/workout/1");
  await page.getByRole("button", { name: "Добавить упражнение в тренировку" }).click();

  const select = page.getByRole("dialog").getByRole("combobox");
  const option = select.locator("option").first();

  await expect(select).toHaveCSS("color-scheme", "dark");
  await expect(option).toHaveCSS("background-color", "rgb(27, 41, 60)");
  await expect(option).toHaveCSS("color", "rgb(244, 247, 251)");

  await select.focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");
  await expect(select).toBeFocused();
});
