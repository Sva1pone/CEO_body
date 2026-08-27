import { expect, test } from "@playwright/test";

test.use({ timezoneId: "Europe/Moscow" });

const fields = [
  { id: 1, slug: "waist", name: "Талия", unit: "см", sort_order: 10, active: true },
  { id: 2, slug: "belly", name: "Живот", unit: "см", sort_order: 20, active: true },
];

async function mockProgressApi(page, initialMeasurements, hooks = {}) {
  let currentFields = [...(hooks.initialFields || fields)];
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === "/api/progress" && request.method() === "GET") {
      await route.fulfill({ json: { measurements: initialMeasurements, measurement_fields: currentFields } });
      return;
    }
    if (url.pathname === "/api/measurement-fields" && request.method() === "GET") {
      await route.fulfill({ json: { fields: currentFields } });
      return;
    }
    if (url.pathname === "/api/measurement-fields" && request.method() === "POST") {
      const payload = request.postDataJSON();
      const created = { id: 30, slug: "new-field", name: payload.name, unit: "см", sort_order: 100, active: true };
      currentFields = [...currentFields, created];
      hooks.onFieldCreated?.(created);
      await route.fulfill({ status: 201, json: created });
      return;
    }
    if (url.pathname.startsWith("/api/measurement-fields/") && request.method() === "PATCH") {
      const fieldId = Number(url.pathname.split("/").at(-1));
      const payload = request.postDataJSON();
      const existing = currentFields.find((field) => field.id === fieldId);
      const updated = { ...existing, ...payload };
      currentFields = currentFields.map((field) => field.id === fieldId ? updated : field);
      hooks.onFieldUpdated?.(request);
      await route.fulfill({ json: updated });
      return;
    }
    if (url.pathname.startsWith("/api/measurements/") && ["POST", "PATCH"].includes(request.method())) {
      hooks.onMeasurementSaved?.(request);
      await route.fulfill({ json: initialMeasurements[0] || { id: 1 } });
      return;
    }
    await route.continue();
  });
}

test("progress separates weight and tape histories without records", async ({ page }, testInfo) => {
  await mockProgressApi(page, [
    { id: 3, measured_on: "2030-03-03", record_type: "mixed", weight: 74, note: "", values: { waist: 80 } },
    { id: 2, measured_on: "2030-03-02", record_type: "tape", weight: null, note: "", values: { belly: 84 } },
    { id: 1, measured_on: "2030-03-01", record_type: "weight", weight: 74.2, note: "", values: {} },
  ]);
  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.goto("/progress");

  await expect(page.getByRole("heading", { name: "Форма тела — в цифрах" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "История веса" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "История замеров тела" })).toBeVisible();
  await expect(page.getByText("Лучший результат")).toHaveCount(0);
  await expect(page.getByText("74 кг", { exact: true })).toHaveCount(2);
  await expect(page.getByText("2030-03-03", { exact: true })).toHaveCount(4);

  const weightHistory = page.getByRole("heading", { name: "История веса" }).locator("..");
  const tapeHistory = page.getByRole("heading", { name: "История замеров тела" }).locator("../..");
  await expect(weightHistory.getByText("Талия")).toHaveCount(0);
  await expect(tapeHistory.getByText(/Вес .*кг/)).toHaveCount(0);

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(horizontalOverflow).toBe(false);

  await page.getByRole("button", { name: "Добавить замеры" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Добавить замеры" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Вес, кг")).toHaveCount(0);
  await dialog.screenshot({ path: testInfo.outputPath("tape-dialog.png") });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

for (const scenario of [
  {
    name: "empty data",
    measurements: [],
    visible: ["Вес ещё не записан", "Замеров тела ещё нет"],
  },
  {
    name: "only weight",
    measurements: [{ id: 1, measured_on: "2030-03-01", record_type: "weight", weight: 74.2, note: "", values: {} }],
    visible: ["74,2 кг", "Замеров тела ещё нет"],
  },
  {
    name: "only tape",
    measurements: [{ id: 2, measured_on: "2030-03-02", record_type: "tape", weight: null, note: "", values: { waist: 80 } }],
    visible: ["Вес ещё не записан", "Талия 80 см"],
  },
]) {
  test(`progress handles ${scenario.name}`, async ({ page }) => {
    await mockProgressApi(page, scenario.measurements);
    await page.goto("/progress");
    for (const text of scenario.visible) {
      await expect(page.getByText(text, { exact: true }).first()).toBeVisible();
    }
  });
}

test("historical tape measurement accepts a newly created field", async ({ page }) => {
  let savedRequest;
  await mockProgressApi(
    page,
    [{ id: 2, measured_on: "2030-03-02", record_type: "tape", weight: null, note: "", values: { waist: 80, old_neck: 39 } }],
    {
      initialFields: [
        ...fields,
        { id: 3, slug: "old_neck", name: "Архивная шея", unit: "см", sort_order: 15, active: false },
      ],
      onMeasurementSaved: (request) => { savedRequest = request; },
    },
  );
  await page.goto("/progress");

  await page.getByText("Управление частями тела", { exact: true }).click();
  await page.getByLabel("Новая часть тела").fill("Грудь");
  await page.getByRole("button", { name: "Добавить поле" }).click();

  await page.getByText("2 значения", { exact: true }).click();
  await page.getByRole("button", { name: "Изменить" }).last().click();
  const dialog = page.getByRole("dialog", { name: "Изменить замеры" });
  await expect(dialog.getByLabel("Архивная шея, см")).toHaveValue("39");
  await dialog.getByLabel("Грудь, см").fill("99.5");
  await dialog.getByRole("button", { name: "Сохранить изменения" }).click();

  await expect.poll(() => savedRequest?.method()).toBe("PATCH");
  expect(savedRequest.postDataJSON().values).toMatchObject({ waist: 80, old_neck: 39, "new-field": "99.5" });
});

test("measurement fields can be reordered", async ({ page }) => {
  let updatedRequest;
  await mockProgressApi(page, [], {
    onFieldUpdated: (request) => { updatedRequest = request; },
  });
  await page.goto("/progress");

  await page.getByText("Управление частями тела", { exact: true }).click();
  const waistRow = page.locator('input[value="Талия"]').locator("../..");
  await waistRow.getByLabel("Порядок").fill("5");
  await waistRow.getByRole("button", { name: "Сохранить" }).click();

  await expect.poll(() => updatedRequest?.postDataJSON()).toEqual({ name: "Талия", sort_order: 5 });
});

test("double click saves one weight measurement", async ({ page }) => {
  let saveRequests = 0;
  await mockProgressApi(page, [], {
    onMeasurementSaved: () => { saveRequests += 1; },
  });
  await page.goto("/progress");
  await page.getByRole("button", { name: "Добавить вес" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Добавить вес" });
  await dialog.getByLabel("Вес, кг").fill("74.1");
  await dialog.getByRole("button", { name: "Сохранить вес" }).dblclick();

  await expect.poll(() => saveRequests).toBe(1);
});

test("measurement dialog traps focus and restores it to the trigger", async ({ page }) => {
  await mockProgressApi(page, []);
  await page.goto("/progress");
  const trigger = page.getByRole("button", { name: "Добавить вес" }).first();
  await trigger.focus();
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Добавить вес" });
  const closeButton = dialog.getByRole("button", { name: "Закрыть форму" });
  const saveButton = dialog.getByRole("button", { name: "Сохранить вес" });

  await closeButton.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(saveButton).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(closeButton).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("new measurement defaults to the local calendar date", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2030-01-01T22:30:00Z"));
  await mockProgressApi(page, []);
  await page.goto("/progress");
  await page.getByRole("button", { name: "Добавить вес" }).first().click();

  await expect(page.getByRole("dialog", { name: "Добавить вес" }).getByLabel("Дата"))
    .toHaveValue("2030-01-02");
});

test("long dynamic measurement list stays within the desktop viewport", async ({ page }) => {
  const longFields = [
    ...fields,
    { id: 3, slug: "right-forearm", name: "Предплечье справа", unit: "см", sort_order: 30, active: true },
    { id: 4, slug: "left-calf", name: "Голень слева", unit: "см", sort_order: 40, active: true },
    { id: 5, slug: "custom-long", name: "Очень длинное название пользовательской части тела", unit: "см", sort_order: 50, active: true },
  ];
  await mockProgressApi(page, [
    {
      id: 5,
      measured_on: "2030-03-04",
      record_type: "tape",
      weight: null,
      note: "Контрольный замер",
      values: Object.fromEntries(longFields.map((field, index) => [field.slug, 30 + index])),
    },
  ], { initialFields: longFields });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/progress");
  await page.getByText("5 значений", { exact: true }).click();

  expect(await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  )).toBe(true);
  await expect(page.getByText("Очень длинное название пользовательской части тела 34 см", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Добавить замеры" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Добавить замеры" });
  await expect(dialog.getByLabel("Очень длинное название пользовательской части тела, см")).toBeVisible();
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
});
