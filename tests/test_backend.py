from __future__ import annotations

import io
import sys
import tempfile
import unittest
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / ".venv" / "Lib" / "site-packages"))
sys.path.insert(0, str(ROOT))

import app as application  # noqa: E402
from tests.fixtures import create_test_data  # noqa: E402


class BackendApiTest(unittest.TestCase):
    def product_update_payload(self, product: dict, **changes) -> dict:
        payload = {
            "name": product["name"],
            "brand": product["brand"],
            "category": product["category"],
            "serving_grams": product["serving_grams"],
            "serving_label": product["serving_label"],
            "serving_units": product["serving_units"],
            "unit_name": product["unit_name"],
            "package_units": product["package_units"],
            "kcal_100": product["kcal_100"],
            "protein_100": product["protein_100"],
            "fat_100": product["fat_100"],
            "carbs_100": product["carbs_100"],
            "benefit_tag": product["benefit_tag"],
            "benefit_color": product["benefit_color"],
            "approximate": product["approximate"],
            "note": product["note"],
        }
        payload.update(changes)
        return payload

    def materialize_day(self, log_date: str) -> dict:
        response = self.client.post(f"/api/day?date={log_date}")
        self.assertEqual(response.status_code, 201)
        return response.get_json()

    def test_api_rejects_non_object_json(self) -> None:
        response = self.client.post("/api/strategy", json=[])
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json()["error"], "JSON-тело запроса должно быть объектом.")

    def test_viewing_missing_day_is_read_only_and_materialization_is_explicit(self) -> None:
        log_date = "2030-12-31"
        viewed = self.client.get(f"/api/day?date={log_date}")

        self.assertEqual(viewed.status_code, 200)
        self.assertIsNone(viewed.get_json()["day"]["id"])
        with application.db() as connection:
            self.assertIsNone(
                connection.execute(
                    "SELECT id FROM days WHERE log_date=?", (log_date,)
                ).fetchone()
            )

        created = self.client.post(f"/api/day?date={log_date}")

        self.assertEqual(created.status_code, 201)
        self.assertIsNotNone(created.get_json()["day"]["id"])

    def test_day_endpoint_rejects_invalid_iso_date(self) -> None:
        response = self.client.get("/api/day?date=2030-2-3")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json()["error"], "Укажи дату в формате YYYY-MM-DD.")

    def test_missing_workout_returns_json_404(self) -> None:
        response = self.client.get("/api/workout/999999")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.get_json()["error"], "Тренировка не найдена.")

    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_db = application.DB_PATH
        self.original_upload = application.UPLOAD_DIR
        self.original_backup = application.BACKUP_DIR
        application.DB_PATH = Path(self.temp_dir.name) / "test.db"
        application.UPLOAD_DIR = Path(self.temp_dir.name) / "uploads"
        application.BACKUP_DIR = Path(self.temp_dir.name) / "backups"
        application.app.config.update(TESTING=True)
        application.init_db()
        create_test_data(application.db)
        application.init_db()
        self.client = application.app.test_client()

    def tearDown(self) -> None:
        application.DB_PATH = self.original_db
        application.UPLOAD_DIR = self.original_upload
        application.BACKUP_DIR = self.original_backup
        self.temp_dir.cleanup()

    def test_food_request_token_is_idempotent_and_open_day_is_projected_once(self) -> None:
        initial = self.materialize_day("2030-01-10")
        day_id = initial["day"]["id"]
        product_id = initial["products"][0]["id"]
        request_data = {
            "product_id": product_id,
            "quantity": 1,
            "quantity_mode": "serving",
            "meal_type": "Завтрак",
            "request_token": "same-click",
        }
        first = self.client.post(f"/api/day/{day_id}/food", json=request_data)
        second = self.client.post(f"/api/day/{day_id}/food", json=request_data)
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.get_json()["food_write"], "created")
        self.assertEqual(second.get_json()["food_write"], "duplicate_ignored")
        with application.db() as con:
            count = con.execute("SELECT COUNT(*) FROM food_entries WHERE day_id=?", (day_id,)).fetchone()[0]
        self.assertEqual(count, 1)
        payload = second.get_json()
        self.assertAlmostEqual(
            payload["projected_global_balance"],
            payload["global_balance"] + payload["summary"]["delta"],
            places=1,
        )

    def test_history_recalculation_requires_explicit_confirmation(self) -> None:
        day = self.materialize_day("2030-01-11")
        product = day["products"][0]
        product_id = product["id"]
        self.client.post(
            f"/api/day/{day['day']['id']}/food",
            json={
                "product_id": product_id,
                "quantity": 1,
                "quantity_mode": "serving",
                "meal_type": "Завтрак",
                "request_token": "history-confirmation",
            },
        )

        impact = self.client.get(f"/api/registry/{product_id}/history-impact")
        self.assertEqual(impact.status_code, 200)
        self.assertEqual(impact.get_json(), {"history_entries": 1})

        update = self.product_update_payload(
            product,
            kcal_100=product["kcal_100"] + 10,
            apply_to_history=True,
        )
        rejected = self.client.patch(f"/api/registry/{product_id}", json=update)
        self.assertEqual(rejected.status_code, 400)
        self.assertEqual(
            rejected.get_json()["error"],
            "Подтверди пересчёт исторических записей.",
        )

        update["history_confirmation"] = "confirmed"
        accepted = self.client.patch(f"/api/registry/{product_id}", json=update)
        self.assertEqual(accepted.status_code, 200)
        self.assertEqual(accepted.get_json()["history_updated"], 1)

    def test_profile_backfill_runs_once_for_legacy_workout_sets(self) -> None:
        day = application.get_or_create_day("2030-01-09")
        with application.db() as connection:
            exercise = connection.execute(
                "SELECT id, name, muscle_profile FROM exercise_catalog ORDER BY id LIMIT 1"
            ).fetchone()
            workout_id = connection.execute(
                """INSERT INTO workouts(
                       day_id, title, duration_minutes, intensity_met, created_at
                   ) VALUES (?, ?, ?, ?, ?)""",
                (day["id"], "Legacy workout", 45, 3.5, "2030-01-09T12:00:00"),
            ).lastrowid
            workout_set_id = connection.execute(
                """INSERT INTO workout_sets(
                       workout_id, exercise, set_number, weight, reps,
                       exercise_catalog_id, muscle_profile_snapshot
                   ) VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (workout_id, exercise["name"], 1, 50, 10, exercise["id"], "{\"primary\": [], \"secondary\": []}"),
            ).lastrowid
            connection.execute("DELETE FROM settings WHERE key='workout_profile_snapshots_v1'")

        application.init_db()

        with application.db() as connection:
            marker = connection.execute(
                "SELECT value FROM settings WHERE key='workout_profile_snapshots_v1'"
            ).fetchone()
            first_snapshot = connection.execute(
                "SELECT muscle_profile_snapshot FROM workout_sets WHERE id=?",
                (workout_set_id,),
            ).fetchone()["muscle_profile_snapshot"]

        application.init_db()

        with application.db() as connection:
            second_snapshot = connection.execute(
                "SELECT muscle_profile_snapshot FROM workout_sets WHERE id=?",
                (workout_set_id,),
            ).fetchone()["muscle_profile_snapshot"]

        self.assertIsNotNone(marker)
        self.assertEqual(first_snapshot, exercise["muscle_profile"])
        self.assertEqual(second_snapshot, first_snapshot)

    def test_workout_set_numbers_are_normalized_and_unique(self) -> None:
        day = application.get_or_create_day("2030-01-08")
        with application.db() as connection:
            connection.execute("DROP INDEX idx_workout_sets_exercise_number")
            workout_id = connection.execute(
                """INSERT INTO workouts(day_id, title, duration_minutes, intensity_met, created_at)
                   VALUES (?, ?, ?, ?, ?)""",
                (day["id"], "Legacy workout", 45, 3.5, "2030-01-08T12:00:00"),
            ).lastrowid
            for weight in (20, 30):
                connection.execute(
                    """INSERT INTO workout_sets(workout_id, exercise, set_number, weight, reps)
                       VALUES (?, ?, ?, ?, ?)""",
                    (workout_id, "Тестовое упражнение A", 1, weight, 10),
                )

        application.init_db()

        with application.db() as connection:
            numbers = [
                row["set_number"]
                for row in connection.execute(
                    "SELECT set_number FROM workout_sets WHERE workout_id=? ORDER BY id",
                    (workout_id,),
                )
            ]
            with self.assertRaises(Exception):
                connection.execute(
                    """INSERT INTO workout_sets(workout_id, exercise, set_number, weight, reps)
                       VALUES (?, ?, ?, ?, ?)""",
                    (workout_id, "Тестовое упражнение A", 1, 40, 10),
                )

        self.assertEqual(numbers, [1, 2])

    def test_initialization_preserves_existing_product_category(self) -> None:
        with application.db() as connection:
            product_id = connection.execute(
                """INSERT INTO products(
                       name, category, serving_label, serving_grams, serving_units,
                       unit_name, kcal, protein, fat, carbs, created_at
                   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                ("Синтетический продукт 001", "Тестовая категория", "100 г", 100, 1, "порция", 300, 0, 0, 75, "2030-01-01T00:00:00"),
            ).lastrowid

        application.init_db()

        with application.db() as connection:
            category = connection.execute(
                "SELECT category FROM products WHERE id=?", (product_id,)
            ).fetchone()["category"]

        self.assertEqual(category, "Тестовая категория")

    def test_closing_day_freezes_weight_dependent_energy(self) -> None:
        payload = self.materialize_day("2030-01-11")
        day_id = payload["day"]["id"]
        with application.db() as con:
            con.execute(
                "INSERT INTO measurements(measured_on, weight) VALUES (?, ?)",
                ("2030-01-11", 70),
            )
        self.client.patch(f"/api/day/{day_id}", json={"steps": 10000, "step_cadence": 100})
        closed = self.client.post(f"/api/day/{day_id}/close").get_json()
        frozen_tdee = closed["summary"]["tdee"]
        with application.db() as con:
            con.execute(
                "INSERT INTO measurements(measured_on, weight) VALUES (?, ?)",
                ("2030-02-01", 100),
            )
        after_weight_change = self.client.get("/api/day?date=2030-01-11").get_json()
        self.assertEqual(after_weight_change["summary"]["tdee"], frozen_tdee)
        self.assertEqual(
            after_weight_change["projected_global_balance"],
            after_weight_change["global_balance"],
        )

    def test_workout_contract_and_product_photo_replacement(self) -> None:
        day = application.get_or_create_day("2030-01-12")
        with application.db() as con:
            cursor = con.execute(
                """INSERT INTO workouts(day_id, title, duration_minutes, intensity_met, note, created_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (day["id"], "Тестовый тип дня", 50, 5.0, "", datetime.now().isoformat()),
            )
            workout_id = cursor.lastrowid
            product_id = con.execute("SELECT id FROM products ORDER BY id LIMIT 1").fetchone()[0]
        created = self.client.post(
            f"/api/workout/{workout_id}/set",
            json={"exercise": "Тестовое упражнение C", "weight": 170, "reps": 10, "note": ""},
        )
        self.assertEqual(created.status_code, 201)
        workout_payload = created.get_json()
        self.assertTrue(
            {"workout", "sets", "previous", "exercises", "estimated_kcal", "weight"}
            <= workout_payload.keys()
        )
        updated = self.client.patch(
            f"/api/workout/{workout_id}",
            json={"title": "Тяжёлые ноги", "duration_minutes": 55, "intensity_met": 5.5, "note": "PR"},
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.get_json()["workout"]["title"], "Тяжёлые ноги")
        set_id = workout_payload["sets"][0]["id"]
        self.assertEqual(self.client.delete(f"/api/workout/set/{set_id}").status_code, 200)
        photo = self.client.post(
            f"/api/registry/{product_id}/image",
            data={"image": (io.BytesIO(b"\x89PNG\r\n\x1a\nlocal-test-image"), "food.png")},
            content_type="multipart/form-data",
        )
        self.assertEqual(photo.status_code, 200)
        self.assertTrue(photo.get_json()["product"]["image_url"].endswith("food.png"))

    def test_registry_uses_per_100g_and_can_recalculate_history_explicitly(self) -> None:
        created = self.client.post(
            "/api/registry",
            data={
                "name": "Тестовая позиция", "category": "Тестовая категория", "serving_grams": "250",
                "serving_units": "1", "unit_name": "порция", "kcal_100": "100",
                "protein_100": "10", "fat_100": "5", "carbs_100": "15",
                "benefit_tag": "Новая метка", "benefit_color": "#6d5dfc",
            },
            content_type="multipart/form-data",
        )
        self.assertEqual(created.status_code, 201)
        product = created.get_json()["product"]
        self.assertEqual(product["kcal_100"], 100)
        self.assertEqual(product["kcal"], 250)
        self.assertEqual(product["protein"], 25)
        self.assertIn("Новая метка", self.client.get("/api/registry").get_json()["benefit_tags"])

        day = self.materialize_day("2030-01-13")["day"]
        self.assertEqual(self.client.post(
            f"/api/day/{day['id']}/food",
            json={"product_id": product["id"], "quantity": 100, "quantity_mode": "grams", "meal_type": "Завтрак"},
        ).status_code, 200)
        unchanged = self.client.patch(
            f"/api/registry/{product['id']}",
            json={"name": "Тестовая позиция", "category": "Тестовая категория", "serving_grams": 250,
                  "serving_units": 1, "unit_name": "порция", "kcal_100": 200,
                  "protein_100": 20, "fat_100": 10, "carbs_100": 30, "benefit_tag": "Новая метка", "benefit_color": "#6d5dfc"},
        )
        self.assertEqual(unchanged.status_code, 200)
        self.assertEqual(unchanged.get_json()["history_updated"], 0)
        with application.db() as con:
            self.assertEqual(con.execute("SELECT kcal FROM food_entries WHERE product_id=?", (product["id"],)).fetchone()[0], 100)
        recalculated = self.client.patch(
            f"/api/registry/{product['id']}",
            json={"name": "Тестовая позиция", "category": "Тестовая категория", "serving_grams": 250,
                  "serving_units": 1, "unit_name": "порция", "kcal_100": 200,
                  "protein_100": 20, "fat_100": 10, "carbs_100": 30, "benefit_tag": "Новая метка", "benefit_color": "#6d5dfc",
                  "apply_to_history": True, "history_confirmation": "confirmed"},
        )
        self.assertEqual(recalculated.status_code, 200)
        self.assertEqual(recalculated.get_json()["history_updated"], 1)
        with application.db() as con:
            self.assertEqual(con.execute("SELECT kcal FROM food_entries WHERE product_id=?", (product["id"],)).fetchone()[0], 200)

    def test_workout_templates_catalog_and_three_record_baselines(self) -> None:
        templates = self.client.get("/api/workout/templates")
        self.assertEqual(templates.status_code, 200)
        payload = templates.get_json()
        self.assertEqual([item["name"] for item in payload["templates"]], [
            "Тестовый шаблон A", "Тестовый шаблон B", "Тестовый шаблон C",
        ])
        self.assertIn("Тестовое упражнение C", payload["exercises"])
        legs_id = next(item["id"] for item in payload["templates"] if item["name"] == "Тестовый шаблон C")

        first_day = self.materialize_day("2030-01-20")["day"]
        first = self.client.post(f"/api/day/{first_day['id']}/workout", json={"template_id": legs_id})
        self.assertEqual(first.status_code, 201)
        first_workout = first.get_json()["workout"]
        self.assertEqual(first_workout["title"], "Тестовый шаблон C")
        self.assertEqual(first_workout["intensity_met"], 3.5)
        self.client.post(
            f"/api/workout/{first_workout['id']}/set",
            json={"exercise": "Тестовое упражнение C", "weight": 170, "reps": 10},
        )

        second_day = self.materialize_day("2030-01-21")["day"]
        second_workout = self.client.post(
            f"/api/day/{second_day['id']}/workout", json={"template_id": legs_id}
        ).get_json()["workout"]
        result = self.client.post(
            f"/api/workout/{second_workout['id']}/set",
            json={"exercise": "Тестовое упражнение C", "weight": 170, "reps": 12},
        )
        self.assertEqual(result.status_code, 201)
        previous = result.get_json()["previous"]["Тестовое упражнение C"]
        self.assertEqual(previous["best_weight"], 170)
        self.assertGreater(previous["best_1rm"], 220)
        self.assertEqual(previous["reps_by_weight"], [{"weight": 170, "best_reps": 10}])

        earlier_day = self.materialize_day("2030-01-19")["day"]
        earlier_workout = self.client.post(
            f"/api/day/{earlier_day['id']}/workout", json={"template_id": legs_id}
        ).get_json()["workout"]
        result = self.client.post(
            f"/api/workout/{earlier_workout['id']}/set",
            json={"exercise": "Тестовое упражнение C", "weight": 100, "reps": 8},
        )
        self.assertNotIn("Тестовое упражнение C", result.get_json()["previous"])

        same_day = self.materialize_day("2030-01-22")["day"]
        same_day_first = self.client.post(
            f"/api/day/{same_day['id']}/workout", json={"template_id": legs_id}
        ).get_json()["workout"]
        self.client.post(
            f"/api/workout/{same_day_first['id']}/set",
            json={"exercise": "Тестовое упражнение A", "weight": 160, "reps": 10},
        )
        same_day_second = self.client.post(
            f"/api/day/{same_day['id']}/workout", json={"template_id": legs_id}
        ).get_json()["workout"]
        same_day_result = self.client.post(
            f"/api/workout/{same_day_second['id']}/set",
            json={"exercise": "Тестовое упражнение A", "weight": 150, "reps": 10},
        )
        self.assertEqual(
            same_day_result.get_json()["previous"]["Тестовое упражнение A"]["best_weight"],
            160,
        )

    def test_exercise_catalog_assigns_new_exercise_to_selected_training_days(self) -> None:
        initial = self.client.get("/api/exercises")
        self.assertEqual(initial.status_code, 200)
        templates = initial.get_json()["templates"]
        selected_ids = [templates[0]["id"], templates[1]["id"]]
        created = self.client.post(
            "/api/exercises",
            json={"name": "Тестовый жим", "muscle_group": "грудь", "template_ids": selected_ids},
        )
        self.assertEqual(created.status_code, 201)
        item = next(row for row in created.get_json()["exercises"] if row["name"] == "Тестовый жим")
        self.assertEqual(item["template_ids"], selected_ids)

    def test_renaming_exercise_keeps_historical_set_name(self) -> None:
        catalog = self.client.get("/api/exercises").get_json()
        exercise = catalog["exercises"][0]
        template_id = exercise["template_ids"][0]
        day = application.get_or_create_day("2030-01-14")
        with application.db() as connection:
            workout_id = connection.execute(
                "INSERT INTO workouts(day_id, title, duration_minutes, intensity_met, created_at) VALUES (?, ?, ?, ?, ?)",
                (day["id"], "История", 30, 3.5, "2030-01-14T12:00:00"),
            ).lastrowid
            connection.execute(
                "INSERT INTO workout_sets(workout_id, exercise, set_number, weight, reps) VALUES (?, ?, ?, ?, ?)",
                (workout_id, exercise["name"], 1, 50, 10),
            )
        renamed = self.client.patch(
            f"/api/exercises/{exercise['id']}",
            json={"name": "Новое имя упражнения", "template_ids": [template_id]},
        )
        self.assertEqual(renamed.status_code, 200)
        with application.db() as connection:
            historical_name = connection.execute("SELECT exercise FROM workout_sets WHERE workout_id=?", (workout_id,)).fetchone()["exercise"]
        self.assertEqual(historical_name, exercise["name"])

    def test_exercise_subgroups_are_created_and_keep_exercises_ordered(self) -> None:
        initial = self.client.get("/api/exercises").get_json()
        template = initial["templates"][0]
        created_group = self.client.post(
            "/api/exercise-subgroups",
            json={"template_id": template["id"], "name": "Тестовая подгруппа"},
        )
        self.assertEqual(created_group.status_code, 201)
        subgroup = next(
            row
            for row in created_group.get_json()["subgroups"]
            if row["name"] == "Тестовая подгруппа"
        )
        first = self.client.post(
            "/api/exercises",
            json={
                "name": "Тестовый жим A",
                "template_ids": [template["id"]],
                "subgroup_ids": {str(template["id"]): subgroup["id"]},
            },
        )
        self.assertEqual(first.status_code, 201)
        second = self.client.post(
            "/api/exercises",
            json={
                "name": "Тестовый жим B",
                "template_ids": [template["id"]],
                "subgroup_ids": {str(template["id"]): subgroup["id"]},
            },
        )
        self.assertEqual(second.status_code, 201)
        second_payload = second.get_json()
        item_b = next(row for row in second_payload["exercises"] if row["name"] == "Тестовый жим B")
        moved = self.client.patch(
            f"/api/exercises/{item_b['id']}/position",
            json={"subgroup_id": subgroup["id"], "direction": "up"},
        )
        self.assertEqual(moved.status_code, 200)
        collapsed = self.client.patch(
            f"/api/exercise-subgroups/{subgroup['id']}", json={"collapsed": True}
        )
        self.assertEqual(collapsed.status_code, 200)
        saved_group = next(
            row for row in collapsed.get_json()["subgroups"] if row["id"] == subgroup["id"]
        )
        self.assertEqual(saved_group["collapsed"], 1)
        self.assertEqual(
            self.client.delete(f"/api/exercise-subgroups/{subgroup['id']}").status_code,
            409,
        )
        with application.db() as con:
            names = [
                row["exercise_name"]
                for row in con.execute(
                    """SELECT exercise_name FROM workout_template_exercises
                       WHERE subgroup_id=? ORDER BY sort_order, id""",
                    (subgroup["id"],),
                )
            ]
        self.assertEqual(names[:2], ["Тестовый жим B", "Тестовый жим A"])

    def test_exercise_subgroup_migration_is_idempotent(self) -> None:
        application.migrate_exercise_subgroups()
        application.migrate_exercise_subgroups()
        with application.db() as con:
            names = [row["name"] for row in con.execute("SELECT name FROM exercise_subgroups WHERE active=1")]
            duplicates = con.execute(
                """SELECT template_id, name, COUNT(*) AS amount
                   FROM exercise_subgroups GROUP BY template_id, name HAVING COUNT(*) > 1"""
            ).fetchall()
            missing = con.execute(
                "SELECT COUNT(*) FROM workout_template_exercises WHERE subgroup_id IS NULL"
            ).fetchone()[0]
        self.assertEqual(duplicates, [])
        self.assertEqual(missing, 0)
        self.assertNotIn("Без подгруппы", names)
        self.assertIn("Неразмеченное", names)

    def test_exercise_can_be_dragged_between_subgroups_and_group_can_be_renamed_or_deleted(self) -> None:
        initial = self.client.get("/api/exercises").get_json()
        template = initial["templates"][0]
        source_response = self.client.post(
            "/api/exercise-subgroups",
            json={"template_id": template["id"], "name": "Источник"},
        )
        source = next(row for row in source_response.get_json()["subgroups"] if row["name"] == "Источник")
        target_response = self.client.post(
            "/api/exercise-subgroups",
            json={"template_id": template["id"], "name": "Назначение"},
        )
        target = next(row for row in target_response.get_json()["subgroups"] if row["name"] == "Назначение")
        created = self.client.post(
            "/api/exercises",
            json={
                "name": "Перетаскиваемое упражнение",
                "template_ids": [template["id"]],
                "subgroup_ids": {str(template["id"]): source["id"]},
            },
        ).get_json()
        exercise = next(row for row in created["exercises"] if row["name"] == "Перетаскиваемое упражнение")
        placed = self.client.patch(
            f"/api/exercises/{exercise['id']}/placement",
            json={"subgroup_id": target["id"], "target_index": 0},
        )
        self.assertEqual(placed.status_code, 200)
        moved = next(row for row in placed.get_json()["exercises"] if row["id"] == exercise["id"])
        self.assertEqual(next(row for row in moved["placements"] if row["template_id"] == template["id"])["subgroup_id"], target["id"])
        renamed = self.client.patch(
            f"/api/exercise-subgroups/{target['id']}", json={"name": "Новая грудь"}
        )
        self.assertEqual(renamed.status_code, 200)
        self.assertIn("Новая грудь", [row["name"] for row in renamed.get_json()["subgroups"]])
        deleted = self.client.delete(
            f"/api/exercise-subgroups/{target['id']}", json={"destination_id": source["id"]}
        )
        self.assertEqual(deleted.status_code, 200)
        payload = deleted.get_json()
        self.assertNotIn(target["id"], [row["id"] for row in payload["subgroups"]])
        restored = next(row for row in payload["exercises"] if row["id"] == exercise["id"])
        self.assertEqual(next(row for row in restored["placements"] if row["template_id"] == template["id"])["subgroup_id"], source["id"])

    def test_empty_subgroup_with_only_archived_exercise_mappings_can_be_deleted(self) -> None:
        initial = self.client.get("/api/exercises").get_json()
        template = initial["templates"][0]
        group_response = self.client.post(
            "/api/exercise-subgroups",
            json={"template_id": template["id"], "name": "Временно неразмеченное"},
        )
        group = next(row for row in group_response.get_json()["subgroups"] if row["name"] == "Временно неразмеченное")
        created = self.client.post(
            "/api/exercises",
            json={
                "name": "Упражнение для архива",
                "template_ids": [template["id"]],
                "subgroup_ids": {str(template["id"]): group["id"]},
            },
        ).get_json()
        exercise = next(row for row in created["exercises"] if row["name"] == "Упражнение для архива")
        self.assertEqual(self.client.delete(f"/api/exercises/{exercise['id']}").status_code, 200)
        deleted = self.client.delete(f"/api/exercise-subgroups/{group['id']}", json={"destination_id": None})
        self.assertEqual(deleted.status_code, 200)
        self.assertNotIn(group["id"], [row["id"] for row in deleted.get_json()["subgroups"]])
        recreated = self.client.post(
            "/api/exercise-subgroups",
            json={"template_id": template["id"], "name": "Временно неразмеченное"},
        )
        self.assertEqual(recreated.status_code, 201)
        recreated_group = next(
            row for row in recreated.get_json()["subgroups"]
            if row["name"] == "Временно неразмеченное"
        )
        self.assertEqual(recreated_group["id"], group["id"])

    def test_sleep_crosses_midnight_and_report_includes_latest_biometrics(self) -> None:
        payload = self.materialize_day("2030-01-13")
        day_id = payload["day"]["id"]
        saved = self.client.patch(
            f"/api/day/{day_id}/sleep",
            json={"start": "23:30", "end": "07:15", "deep_percent": 21, "rem_percent": 19},
        )
        self.assertEqual(saved.status_code, 200)
        self.assertEqual(saved.get_json()["sleep"]["duration_minutes"], 465)
        with application.db() as con:
            con.execute(
                "INSERT INTO measurements(measured_on, weight, waist, belly) VALUES (?, ?, ?, ?)",
                ("2030-01-13", 137.25, 179, 184),
            )
        report = self.client.get("/api/report?start=2030-01-01&end=2030-01-31").get_json()
        self.assertEqual(report["latest_measurement"]["weight"], 137.25)
        self.assertEqual(report["days"][0]["sleep"]["duration_minutes"], 465)

    def test_report_ignores_empty_days_created_only_by_viewing_a_date(self) -> None:
        empty_date = "2030-01-30"
        viewed = self.client.get(f"/api/day?date={empty_date}")
        self.assertEqual(viewed.status_code, 200)
        report = self.client.get(
            f"/api/report?start={empty_date}&end={empty_date}"
        ).get_json()
        self.assertEqual(report["days"], [])
        self.assertEqual(report["aggregate"]["days_count"], 0)

    def test_report_combines_latest_weight_and_tape_measurement_dates(self) -> None:
        weight = self.client.post(
            "/api/measurements/weight",
            json={"measured_on": "2030-01-08", "weight": 73.7},
        )
        tape = self.client.post(
            "/api/measurements/tape",
            json={"measured_on": "2030-01-10", "values": {"waist": 81.1}},
        )
        self.assertEqual(weight.status_code, 200)
        self.assertEqual(tape.status_code, 200)

        measurement = self.client.get(
            "/api/report?start=2030-01-01&end=2030-01-31"
        ).get_json()["latest_measurement"]

        self.assertEqual(measurement["weight"], 73.7)
        self.assertEqual(measurement["weight_measured_on"], "2030-01-08")
        self.assertEqual(measurement["waist"], 81.1)
        self.assertEqual(measurement["tape_measured_on"], "2030-01-10")

    def test_sleep_may_be_cleared(self) -> None:
        payload = self.materialize_day("2030-01-14")
        self.assertEqual(payload["day"]["phase"], "Тестовый режим")
        response = self.client.patch(
            f"/api/day/{payload['day']['id']}/sleep",
            json={"start": "", "end": "", "deep_percent": "", "rem_percent": ""},
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.get_json()["sleep"]["has_data"])

    def test_cardio_intervals_are_reported_without_double_counting_tdee(self) -> None:
        day_payload = self.materialize_day("2030-01-25")
        day = day_payload["day"]
        workout = self.client.post(
            f"/api/day/{day['id']}/workout",
            json={"title": "Тестовая тренировка", "duration_minutes": 60, "intensity_met": 3.5},
        ).get_json()["workout"]
        before_cardio = self.client.get("/api/day?date=2030-01-25").get_json()["summary"]["tdee"]
        saved = self.client.post(
            f"/api/workout/{workout['id']}/cardio",
            json={
                "activity_type": "Беговая дорожка",
                "duration_minutes": 15,
                "watch_steps": 1800,
                "watch_kcal": 120,
                "intervals": [
                    {"start_minute": 0, "end_minute": 4, "incline_percent": 4, "speed_kmh": 3.5},
                    {"start_minute": 4, "end_minute": 12, "incline_percent": 9, "speed_kmh": 4},
                    {"start_minute": 12, "end_minute": 15, "incline_percent": 5, "speed_kmh": 5},
                ],
            },
        )
        self.assertEqual(saved.status_code, 201)
        cardio = saved.get_json()["cardio"][0]
        self.assertEqual(len(cardio["intervals"]), 3)
        self.assertFalse(cardio["included_in_tdee"])
        self.assertGreater(cardio["estimated_kcal"], 0)
        after_cardio = self.client.get("/api/day?date=2030-01-25").get_json()["summary"]["tdee"]
        self.assertEqual(after_cardio, before_cardio)
        report = self.client.get("/api/report?start=2030-01-25&end=2030-01-25").get_json()
        self.assertEqual(report["days"][0]["workouts"][0]["cardio"][0]["watch_kcal"], 120)

        invalid = self.client.post(
            f"/api/workout/{workout['id']}/cardio",
            json={"duration_minutes": 10, "intervals": [{"start_minute": 1, "end_minute": 10, "incline_percent": 0, "speed_kmh": 4}]},
        )
        self.assertEqual(invalid.status_code, 400)

    def test_statistics_groups_protein_and_uses_only_closed_days_for_balance(self) -> None:
        first = self.materialize_day("2030-02-04")
        second = self.materialize_day("2030-02-05")
        product_id = first["products"][0]["id"]
        with application.db() as con:
            con.execute(
                """UPDATE products
                   SET serving_grams=100, kcal=500, protein=90,
                       kcal_100=500, protein_100=90
                   WHERE id=?""",
                (product_id,),
            )
        self.client.post(
            f"/api/day/{first['day']['id']}/food",
            json={"product_id": product_id, "quantity": 1, "quantity_mode": "serving", "meal_type": "Завтрак"},
        )
        self.client.post(
            f"/api/day/{second['day']['id']}/food",
            json={"product_id": product_id, "quantity": 160, "quantity_mode": "grams", "meal_type": "Завтрак"},
        )
        self.client.post(f"/api/day/{first['day']['id']}/close")
        statistics = self.client.get("/api/statistics?start=2030-02-04&end=2030-02-10")
        self.assertEqual(statistics.status_code, 200)
        payload = statistics.get_json()
        self.assertEqual(payload["summary"]["logged_days"], 2)
        self.assertEqual(payload["summary"]["closed_days"], 1)
        self.assertEqual(payload["weekly"][0]["average_protein"], 117)
        self.assertTrue(payload["weekly"][0]["compensated"])
        self.assertEqual(payload["weekly"][0]["logged_days"], 2)
        self.assertEqual(len(payload["global_curve"]), 2)
        self.assertEqual(payload["products"][0]["uses"], 2)
        self.assertGreater(payload["products"][0]["value_score"], 0)

    def test_finisher_activates_at_seventy_percent_and_adds_full_combo_once(self) -> None:
        initial = self.materialize_day("2030-03-01")
        self.assertFalse(initial["finisher_active"])
        self.assertEqual(initial["finishers"], [])
        day_id = initial["day"]["id"]
        first_id, protein_id = [item["id"] for item in initial["products"][:2]]
        activation_kcal = initial["summary"]["target"] * 0.70
        with application.db() as con:
            con.execute(
                "UPDATE products SET kcal=?, protein=50, fat=0, carbs=0 WHERE id=?",
                (activation_kcal, first_id),
            )
            con.execute(
                "UPDATE products SET kcal=200, protein=70, fat=0, carbs=0 WHERE id=?",
                (protein_id,),
            )
        added = self.client.post(
            f"/api/day/{day_id}/food",
            json={"product_id": first_id, "quantity": 1, "quantity_mode": "serving", "meal_type": "Ужин"},
        ).get_json()
        self.assertTrue(added["finisher_active"])
        self.assertEqual(added["finisher_progress"], 70)
        self.assertTrue(added["finishers"])
        option = next(
            option for option in added["finishers"]
            if any(line["product"]["id"] == protein_id for line in option["lines"])
        )
        self.assertTrue(option["protein_met"])
        self.assertEqual(
            option["projected_intake"],
            added["summary"]["intake"] + option["kcal"],
        )
        batch_payload = {
            "meal_type": "Ужин",
            "request_token": "finisher-combo-test",
            "items": [
                {"product_id": line["product"]["id"], "quantity": line["quantity"]}
                for line in option["lines"]
            ],
        }
        created = self.client.post(f"/api/day/{day_id}/food/batch", json=batch_payload)
        self.assertEqual(created.status_code, 200)
        self.assertEqual(created.get_json()["batch_entries_created"], len(option["lines"]))
        repeated = self.client.post(f"/api/day/{day_id}/food/batch", json=batch_payload)
        self.assertEqual(repeated.status_code, 200)
        self.assertEqual(repeated.get_json()["food_write"], "batch_duplicate_ignored")
        with application.db() as con:
            count = con.execute("SELECT COUNT(*) FROM food_entries WHERE day_id=?", (day_id,)).fetchone()[0]
        self.assertEqual(count, 1 + len(option["lines"]))
        complete_day = self.materialize_day("2030-03-02")["day"]
        with application.db() as con:
            con.execute(
                "UPDATE products SET kcal=?, protein=160, fat=0, carbs=0 WHERE id=?",
                (initial["summary"]["target"], first_id),
            )
        complete = self.client.post(
            f"/api/day/{complete_day['id']}/food",
            json={"product_id": first_id, "quantity": 1, "quantity_mode": "serving", "meal_type": "Ужин"},
        ).get_json()
        self.assertTrue(complete["finisher_active"])
        self.assertTrue(complete["finisher_complete"])
        self.assertEqual(complete["finishers"], [])
        self.assertEqual(complete["finisher_product_ids"], [])

    def test_strategy_versions_apply_only_when_a_new_day_is_created(self) -> None:
        existing = self.materialize_day("2030-04-02")["day"]
        self.assertEqual(existing["base_tdee"], 2345)
        created = self.client.post(
            "/api/strategy",
            json={
                "effective_from": "2030-04-01",
                "phase": "Тестовая фаза",
                "base_tdee": 1987,
                "protein_min": 117,
                "protein_max": 153,
                "goal_delta": -333,
                "note": "Проверка неизменности истории",
            },
        )
        self.assertEqual(created.status_code, 201)
        unchanged = self.client.get("/api/day?date=2030-04-02").get_json()["day"]
        self.assertEqual(unchanged["base_tdee"], 2345)
        self.assertEqual(unchanged["protein_min"], 111)
        new_day = self.materialize_day("2030-04-03")["day"]
        self.assertEqual(new_day["phase"], "Тестовая фаза")
        self.assertEqual(new_day["base_tdee"], 1987)
        self.assertEqual(new_day["goal_delta"], -333)
        self.assertEqual(new_day["protein_min"], 117)
        self.assertEqual(new_day["protein_max"], 153)
        duplicate = self.client.post(
            "/api/strategy",
            json={
                "effective_from": "2030-04-01", "phase": "Дубль", "base_tdee": 1987,
                "protein_min": 117, "protein_max": 153, "goal_delta": -333,
            },
        )
        self.assertEqual(duplicate.status_code, 409)

    def test_training_statistics_exclude_warmups_and_use_muscle_snapshots(self) -> None:
        day = self.materialize_day("2030-05-06")["day"]
        templates = self.client.get("/api/workout/templates").get_json()["templates"]
        template = next(item for item in templates if item["exercises"])
        exercise = template["exercises"][0]
        created = self.client.post(
            f"/api/day/{day['id']}/workout",
            json={"template_id": template["id"]},
        )
        self.assertEqual(created.status_code, 201)
        workout_id = created.get_json()["workout"]["id"]
        added = self.client.post(
            f"/api/workout/{workout_id}/exercise",
            json={"exercise": exercise, "set_count": 4},
        )
        self.assertEqual(added.status_code, 201)
        sets = added.get_json()["sets"]
        self.client.patch(
            f"/api/workout/set/{sets[0]['id']}",
            json={"weight": 100, "reps": 10, "is_warmup": False},
        )
        self.client.patch(
            f"/api/workout/set/{sets[1]['id']}",
            json={"weight": 200, "reps": 10, "is_warmup": True},
        )
        self.client.patch(
            f"/api/workout/set/{sets[2]['id']}",
            json={"weight": 0, "reps": 10, "is_warmup": False},
        )
        self.client.patch(
            f"/api/workout/set/{sets[3]['id']}",
            json={"weight": 100, "reps": 0, "is_warmup": False},
        )
        statistics = self.client.get("/api/statistics?start=2030-05-01&end=2030-05-31")
        self.assertEqual(statistics.status_code, 200)
        training = statistics.get_json()["training"]
        self.assertEqual(training["summary"]["sessions"], 1)
        self.assertEqual(training["summary"]["working_sets"], 2)
        self.assertEqual(training["summary"]["warmup_sets"], 1)
        self.assertEqual(training["summary"]["volume"], 1000)
        self.assertEqual(training["exercises"][0]["sets"], 2)
        self.assertTrue(training["muscles"])
        progress = self.client.get("/api/progress").get_json()
        self.assertNotIn("records", progress)
        with application.db() as con:
            snapshots = con.execute(
                "SELECT muscle_profile_snapshot FROM workout_sets WHERE workout_id=?",
                (workout_id,),
            ).fetchall()
        self.assertTrue(all(row["muscle_profile_snapshot"] for row in snapshots))

    def test_delete_exercise_block_uses_catalog_id_not_display_name(self) -> None:
        day = application.get_or_create_day("2030-06-01")
        with application.db() as connection:
            catalog_rows = connection.execute(
                "SELECT id FROM exercise_catalog ORDER BY id LIMIT 2"
            ).fetchall()
            workout_id = connection.execute(
                """INSERT INTO workouts(day_id, title, duration_minutes, intensity_met, created_at)
                   VALUES (?, ?, ?, ?, ?)""",
                (day["id"], "Тест ID упражнения", 60, 3.5, "2030-06-01T12:00:00"),
            ).lastrowid
            for index, catalog_row in enumerate(catalog_rows, start=1):
                connection.execute(
                    """INSERT INTO workout_sets(
                           workout_id, exercise, set_number, weight, reps,
                           exercise_catalog_id, muscle_profile_snapshot
                       ) VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (
                        workout_id,
                        "Одинаковое отображаемое имя",
                        index,
                        50,
                        10,
                        catalog_row["id"],
                        '{"primary": [], "secondary": []}',
                    ),
                )

        deleted = self.client.delete(
            f"/api/workout/{workout_id}/exercise",
            json={"exercise_catalog_id": catalog_rows[0]["id"]},
        )

        self.assertEqual(deleted.status_code, 200)
        with application.db() as connection:
            remaining_catalog_ids = [
                row["exercise_catalog_id"]
                for row in connection.execute(
                    "SELECT exercise_catalog_id FROM workout_sets WHERE workout_id=?",
                    (workout_id,),
                )
            ]
        self.assertEqual(remaining_catalog_ids, [catalog_rows[1]["id"]])

    def test_adding_set_does_not_create_unknown_catalog_exercise(self) -> None:
        day = self.materialize_day("2030-06-02")["day"]
        workout = self.client.post(
            f"/api/day/{day['id']}/workout",
            json={"title": "Тест", "duration_minutes": 60, "intensity_met": 3.5},
        ).get_json()["workout"]

        result = self.client.post(
            f"/api/workout/{workout['id']}/set",
            json={"exercise": "Несуществующее упражнение", "weight": 10, "reps": 10},
        )

        self.assertEqual(result.status_code, 404)
        with application.db() as connection:
            self.assertIsNone(
                connection.execute(
                    "SELECT id FROM exercise_catalog WHERE name=?",
                    ("Несуществующее упражнение",),
                ).fetchone()
            )


if __name__ == "__main__":
    unittest.main()
