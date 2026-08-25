import { expect, test } from "@playwright/test";


test("new exercise is first, visible and highlighted", async ({ page }, testInfo) => {
  let workoutPayload;
  let createRequests = 0;
  const newExercise = { id: 9001, name: "Новое тестовое упражнение" };

  await page.route("**/api/workout/1", async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    workoutPayload = {
      ...payload,
      workout: { ...payload.workout, day_closed_at: null },
      available_exercises: [newExercise],
      exercise_meta: {
        ...payload.exercise_meta,
        [newExercise.name]: {
          id: newExercise.id,
          muscle_group: "Тест",
          image_url: null,
        },
      },
    };
    await route.fulfill({ response, json: workoutPayload });
  });

  await page.route("**/api/workout/1/exercise", async (route) => {
    createRequests += 1;
    const request = JSON.parse(route.request().postData() || "{}");
    const createdSets = Array.from(
      { length: Number(request.set_count) },
      (_, index) => ({
        id: 9001 + index,
        workout_id: 1,
        exercise: newExercise.name,
        exercise_catalog_id: newExercise.id,
        set_number: index + 1,
        weight: 0,
        reps: 0,
        note: "",
        is_warmup: 0,
        estimated_1rm: 0,
      }),
    );
    workoutPayload = {
      ...workoutPayload,
      sets: [...createdSets, ...workoutPayload.sets],
    };
    await route.fulfill({ status: 201, json: workoutPayload });
  });

  await page.goto("/workout/1");
  await page.getByRole("button", { name: "Добавить упражнение в тренировку" }).click();
  const createButton = page.getByRole("button", { name: "Создать подходы" });
  await createButton.dblclick();
  await expect.poll(() => createRequests).toBe(1);

  const card = page.locator(`[data-exercise-name="${newExercise.name}"]`);
  await expect(card).toHaveAttribute("data-arrival", "true");
  await expect(page.locator("article").first()).toHaveAttribute(
    "data-exercise-name",
    newExercise.name,
  );
  await expect(card).toBeInViewport();
  await page.screenshot({
    path: testInfo.outputPath("new-exercise-arrival.png"),
    fullPage: false,
  });
});

test("equal display names with different catalog IDs render as separate blocks", async ({ page }) => {
  await page.route("**/api/workout/1", async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    const duplicateName = "Одинаковое название";
    const duplicateSets = [1, 2].map((exerciseCatalogId) => ({
      id: 9900 + exerciseCatalogId,
      workout_id: 1,
      exercise: duplicateName,
      exercise_catalog_id: exerciseCatalogId,
      set_number: 1,
      weight: 50,
      reps: 10,
      note: "",
      is_warmup: 0,
      estimated_1rm: 66.7,
    }));

    await route.fulfill({
      response,
      json: {
        ...payload,
        sets: [...duplicateSets, ...payload.sets],
      },
    });
  });

  await page.goto("/workout/1");

  const duplicateCards = page.locator('[data-exercise-name="Одинаковое название"]');
  await expect(duplicateCards).toHaveCount(2);
  await expect(
    page.locator('[data-exercise-catalog-id="1"]'),
  ).toBeVisible();
  await expect(
    page.locator('[data-exercise-catalog-id="2"]'),
  ).toBeVisible();
});

test("double click saves one cardio session", async ({ page }) => {
  let createRequests = 0;

  await page.route("**/api/workout/1/cardio", async (route) => {
    createRequests += 1;
    await new Promise((resolve) => setTimeout(resolve, 150));
    const response = await route.fetch();
    await route.fulfill({ response });
  });

  await page.goto("/workout/1");
  await page.getByRole("button", { name: "Добавить кардио" }).click();
  const saveResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/workout/1/cardio") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Сохранить кардио" }).dblclick();

  await saveResponse;
  await expect.poll(() => createRequests).toBe(1);
});
