import { expect, test } from "@playwright/test";

const REPORT_KEY = "ceo-body:range:report";
const STATISTICS_KEY = "ceo-body:range:statistics";
const WEIGHT_TREND_KEY = "ceo-body:range:weight-trend";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/report?*", async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        start: url.searchParams.get("start"),
        end: url.searchParams.get("end"),
        global_balance: 0,
        latest_measurement: null,
        days: [],
      }),
    });
  });
  await page.route("**/api/statistics?*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        summary: {
          average_protein: 0,
          protein_days_met: 0,
          logged_days: 0,
          current_global_balance: 0,
          estimated_fat_kg: 0,
          closed_days: 0,
        },
        targets: { protein_min: 0, protein_max: 0 },
        global_curve: [],
        weekly: [],
        monthly: [],
        products: [],
        training: {
          summary: { sessions: 0 },
          weekly: [],
          muscles: [],
          exercises: [],
          method: { volume: "", muscle_load: "" },
        },
      }),
    });
  });
  await page.route("**/api/weight-trend?*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        kcal_per_kg_energy_equivalent: 7500,
        points: [],
        comparison: {
          status: "insufficient",
          message: "Недостаточно данных",
          expected_change: 0,
          observed_change: 0,
          residual: 0,
        },
      }),
    });
  });
  await page.route("**/api/day?*", async (route) => {
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ error: "Тестовый ответ" }),
    });
  });
});

async function submitRange(page, endpoint, buttonName) {
  await Promise.all([
    page.waitForResponse((response) => response.url().includes(endpoint)),
    page.getByRole("button", { name: buttonName }).click(),
  ]);
}

test("date ranges survive reload and stay isolated between pages", async ({
  page,
}) => {
  await page.goto("/report");
  await expect(
    page.getByRole("heading", { name: "История без потери деталей" }),
  ).toBeVisible();
  await page.getByLabel("С", { exact: true }).fill("2035-07-01");
  await page.getByLabel("По", { exact: true }).fill("2035-07-31");
  await submitRange(page, "/api/report?", "Обновить");

  await page.reload();
  await expect(page.getByLabel("С", { exact: true })).toHaveValue("2035-07-01");
  await expect(page.getByLabel("По", { exact: true })).toHaveValue("2035-07-31");

  await page.goto("/statistics");
  await expect(
    page.getByRole("heading", { name: "Не отдельные дни, а система" }),
  ).toBeVisible();
  await page.getByLabel("С", { exact: true }).fill("2035-05-01");
  await page.getByLabel("По", { exact: true }).fill("2035-05-31");
  await submitRange(page, "/api/statistics?", "Пересчитать");

  await page.goto("/weight-trend");
  await expect(
    page.getByRole("heading", { name: "Вес и энергобаланс" }),
  ).toBeVisible();
  await page.getByLabel("От", { exact: true }).fill("2034-01-01");
  await page.getByLabel("До", { exact: true }).fill("2035-01-01");
  await submitRange(page, "/api/weight-trend?", "Пересчитать");
  await page.reload();
  await expect(page.getByLabel("От", { exact: true })).toHaveValue("2034-01-01");
  await expect(page.getByLabel("До", { exact: true })).toHaveValue("2035-01-01");

  const storedRanges = await page.evaluate(
    ([reportKey, statisticsKey, weightTrendKey]) => ({
      report: JSON.parse(localStorage.getItem(reportKey)),
      statistics: JSON.parse(localStorage.getItem(statisticsKey)),
      weightTrend: JSON.parse(localStorage.getItem(weightTrendKey)),
    }),
    [REPORT_KEY, STATISTICS_KEY, WEIGHT_TREND_KEY],
  );
  expect(storedRanges).toEqual({
    report: { start: "2035-07-01", end: "2035-07-31" },
    statistics: { start: "2035-05-01", end: "2035-05-31" },
    weightTrend: { start: "2034-01-01", end: "2035-01-01" },
  });
});

test("damaged stored ranges are replaced with page defaults", async ({
  page,
}) => {
  await page.addInitScript(
    ([reportKey, statisticsKey]) => {
      localStorage.setItem(reportKey, "not-json");
      localStorage.setItem(
        statisticsKey,
        JSON.stringify({ start: "2035-12-31", end: "2035-01-01" }),
      );
    },
    [REPORT_KEY, STATISTICS_KEY],
  );

  await page.goto("/report");
  const reportDefault = await page.evaluate(() => {
    const today = new Date().toISOString().slice(0, 10);
    return { start: `${today.slice(0, 8)}01`, end: today };
  });
  await expect(page.getByLabel("С", { exact: true })).toHaveValue(reportDefault.start);
  await expect(page.getByLabel("По", { exact: true })).toHaveValue(reportDefault.end);

  await page.goto("/statistics");
  const statisticsDefault = await page.evaluate(() => {
    const start = new Date();
    start.setDate(start.getDate() - 89);
    return {
      start: start.toISOString().slice(0, 10),
      end: new Date().toISOString().slice(0, 10),
    };
  });
  await expect(page.getByLabel("С", { exact: true })).toHaveValue(statisticsDefault.start);
  await expect(page.getByLabel("По", { exact: true })).toHaveValue(statisticsDefault.end);
});

test("an incomplete date edit does not call the report API or overwrite storage", async ({
  page,
}) => {
  await page.goto("/report");
  await expect(
    page.getByRole("heading", { name: "История без потери деталей" }),
  ).toBeVisible();
  await page.getByLabel("С", { exact: true }).fill("2035-07-01");
  await page.getByLabel("По", { exact: true }).fill("2035-07-31");
  await submitRange(page, "/api/report?", "Обновить");

  let reportRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/report?")) reportRequests += 1;
  });
  await page.getByLabel("С", { exact: true }).fill("");
  await page.getByRole("button", { name: "Обновить" }).click();
  await page.waitForTimeout(150);

  expect(reportRequests).toBe(0);
  await expect
    .poll(() =>
      page.evaluate((key) => JSON.parse(localStorage.getItem(key)), REPORT_KEY),
    )
    .toEqual({ start: "2035-07-01", end: "2035-07-31" });
});

test("Today ignores stored ranges and opens the current date", async ({
  page,
}) => {
  await page.addInitScript(
    ([reportKey, statisticsKey, weightTrendKey]) => {
      const oldRange = JSON.stringify({
        start: "2000-01-01",
        end: "2000-01-31",
      });
      localStorage.setItem(reportKey, oldRange);
      localStorage.setItem(statisticsKey, oldRange);
      localStorage.setItem(weightTrendKey, oldRange);
      localStorage.setItem("ceo-body:range:today", oldRange);
    },
    [REPORT_KEY, STATISTICS_KEY, WEIGHT_TREND_KEY],
  );

  const dayRequest = page.waitForRequest((request) =>
    request.url().includes("/api/day?date="),
  );
  await page.goto("/");
  const request = await dayRequest;
  const requestedDate = new URL(request.url()).searchParams.get("date");
  const today = await page.evaluate(() => new Date().toISOString().slice(0, 10));

  expect(requestedDate).toBe(today);
});
