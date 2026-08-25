import { expect, test } from "@playwright/test";


test("switching meals sends one request during repeated clicks", async ({ page }) => {
  let mealRequests = 0;

  await page.route("**/api/day/*/meal", async (route) => {
    mealRequests += 1;
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.continue();
  });

  await page.goto("/?date=2035-07-31");
  const lunchTab = page.getByRole("tab", { name: /Обед/ });
  await expect(lunchTab).toBeVisible();
  await lunchTab.dblclick();

  await expect.poll(() => mealRequests).toBe(1);
  await expect(lunchTab).toHaveAttribute("aria-selected", "true");
});
