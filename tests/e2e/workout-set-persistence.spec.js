import { expect, test } from "@playwright/test";


test("quick edits submit the complete latest workout set", async ({ page }) => {
  let workoutPayload;
  const patchBodies = [];

  await page.route("**/api/workout/1", async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    workoutPayload = {
      ...payload,
      workout: { ...payload.workout, day_closed_at: null },
    };
    await route.fulfill({ response, json: workoutPayload });
  });

  await page.route("**/api/workout/set/*", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    patchBodies.push(body);

    const updatedPayload = {
      ...workoutPayload,
      sets: workoutPayload.sets.map((set) =>
        set.id === Number(route.request().url().split("/").at(-1))
          ? { ...set, ...body }
          : set,
      ),
    };

    if (patchBodies.length === 1) {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    workoutPayload = updatedPayload;
    await route.fulfill({ status: 200, json: updatedPayload });
  });

  await page.goto("/workout/1");

  const firstSet = page.locator("article").first();
  const weightInput = firstSet.locator('input[type="number"]').nth(0);
  const repsInput = firstSet.locator('input[type="number"]').nth(1);

  await weightInput.fill("155");
  await repsInput.fill("13");
  await repsInput.blur();

  await expect.poll(() => patchBodies.length).toBe(2);
  expect(patchBodies[1]).toMatchObject({ weight: "155", reps: "13" });
  await expect(weightInput).toHaveValue("155");
  await expect(repsInput).toHaveValue("13");
});
