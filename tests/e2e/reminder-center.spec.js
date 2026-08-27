import { expect, test } from "@playwright/test";

const activeReminders = {
  today: "2030-08-20",
  unclosed_days: {
    count: 5,
    items: [
      { id: 101, log_date: "2030-08-01" },
      { id: 102, log_date: "2030-08-02" },
      { id: 103, log_date: "2030-08-03" },
      { id: 104, log_date: "2030-08-04" },
      { id: 105, log_date: "2030-08-05" },
    ],
  },
  measurement: {
    last_tape_date: "2030-08-04",
    interval_days: 14,
    next_due_date: "2030-08-18",
    elapsed_days: 16,
    overdue: true,
  },
  active_reminders: 2,
};

const emptyReminders = {
  today: "2030-08-20",
  unclosed_days: { count: 0, items: [] },
  measurement: {
    last_tape_date: "2030-08-19",
    interval_days: 14,
    next_due_date: "2030-09-02",
    elapsed_days: 1,
    overdue: false,
  },
  active_reminders: 0,
};

test("attention center, navigation indicators and tape deep link stay available", async ({ page }) => {
  await page.route("**/api/reminders", (route) =>
    route.fulfill({ json: activeReminders }),
  );

  await page.goto("/?date=2035-07-31");

  await expect(page.getByRole("heading", { name: "Требует внимания" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Осталось закрыть 5 дней" })).toBeVisible();
  await expect(page.getByText("Замеры тела не обновлялись 16 дней.")).toBeVisible();
  await expect(page.getByRole("link", { name: /1 августа.*Открыть день/ })).toHaveAttribute(
    "href",
    "/?date=2030-08-01",
  );

  const desktopNavigation = page.locator("aside");
  await expect(desktopNavigation.getByLabel("Незакрытых дней: 5")).toBeVisible();
  await expect(desktopNavigation.getByLabel("Просрочены замеры тела")).toBeVisible();

  await page.getByText("Ещё 2", { exact: true }).click();
  await expect(page.getByRole("link", { name: /5 августа.*Открыть день/ })).toBeVisible();

  await page.getByRole("link", { name: "Добавить замеры" }).click();
  await expect(page).toHaveURL(/\/progress\?action=add-tape$/);
  await expect(page.getByRole("dialog", { name: "Добавить замеры" })).toBeVisible();
});

test("empty reminders do not reserve space or render navigation markers", async ({ page }) => {
  await page.route("**/api/reminders", (route) =>
    route.fulfill({ json: emptyReminders }),
  );

  await page.goto("/?date=2035-07-31");

  await expect(page.getByRole("heading", { name: "Требует внимания" })).toHaveCount(0);
  await expect(page.getByLabel(/Незакрытых дней:/)).toHaveCount(0);
  await expect(page.getByLabel("Просрочены замеры тела")).toHaveCount(0);
});

test("closing a day refreshes persistent reminders", async ({ page }) => {
  const dayResponse = await page.request.get(
    "http://127.0.0.1:5051/api/day?date=2035-07-31",
  );
  const dayId = (await dayResponse.json()).day.id;
  await page.request.post(`http://127.0.0.1:5051/api/day/${dayId}/reopen`);
  let reminderRequests = 0;
  let dayClosed = false;
  await page.route("**/api/reminders", (route) => {
    reminderRequests += 1;
    return route.fulfill({
      json: dayClosed ? emptyReminders : activeReminders,
    });
  });
  await page.route("**/api/day/*/close", async (route) => {
    const response = await route.fetch();
    dayClosed = true;
    await route.fulfill({ response });
  });

  await page.goto("/?date=2035-07-31");
  await expect(page.getByRole("heading", { name: "Требует внимания" })).toBeVisible();

  await page.getByRole("button", { name: "Закрыть день" }).click();

  await expect.poll(() => reminderRequests).toBeGreaterThan(1);
  await expect(page.getByRole("heading", { name: "Требует внимания" })).toHaveCount(0);
  await page.request.post(`http://127.0.0.1:5051/api/day/${dayId}/reopen`);
});
