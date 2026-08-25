import { expect, test } from "@playwright/test";


const USER_PAGE_PATHS = [
  "/",
  "/exercises",
  "/workout/1",
  "/report",
  "/progress",
  "/statistics",
  "/weight-trend",
  "/settings",
];


for (const path of USER_PAGE_PATHS) {
  test(`${path} renders without browser errors`, async ({ page }) => {
    const runtimeErrors = [];
    page.on("pageerror", (error) => runtimeErrors.push(error.message));

    const response = await page.goto(path);

    expect(response?.ok()).toBe(true);
    await expect(page.locator("#root > *")).toHaveCount(1);
    expect(runtimeErrors).toEqual([]);
  });
}

test("unknown path shows the not found page", async ({ page }) => {
  const response = await page.goto("/route-that-does-not-exist");

  expect(response?.ok()).toBe(true);
  await expect(
    page.getByRole("heading", { name: "Страница не найдена" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "На сегодня" })).toHaveAttribute(
    "href",
    "/",
  );
});

test("empty profile points to strategy setup", async ({ page }) => {
  await page.route("**/api/day?**", (route) =>
    route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ error: "Сначала создай стратегию питания." }),
    }),
  );

  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Сначала настрой стратегию" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Настроить стратегию" }),
  ).toHaveAttribute("href", "/settings");
});
