import tempfile
import unittest
from io import BytesIO
from pathlib import Path

import app as project
from backend.services.day_validation import validate_day_update_payload
from backend.services.products import product_values_from_input
from backend.services.strategy import measurement_values_from_payload, validate_strategy_payload
from backend.services.workouts import validate_cardio_payload, validate_exercise_payload, validate_workout_set_payload
from werkzeug.datastructures import FileStorage
from backend.services.products import save_product_image
from tests.fixtures import create_test_data


class CoreCalculationTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_db_path = project.DB_PATH
        project.DB_PATH = Path(self.temp_dir.name) / "test.db"
        project.init_db()
        create_test_data(project.db)
        project.init_db()
        project.app.config.update(TESTING=True)
        self.client = project.app.test_client()

    def tearDown(self):
        project.DB_PATH = self.original_db_path
        self.temp_dir.cleanup()

    def day(self, selected="2035-07-25"):
        response = self.client.post("/api/day", query_string={"date": selected})
        self.assertEqual(response.status_code, 201)
        return response.get_json()

    def first_product_id(self):
        with project.db() as con:
            return con.execute("SELECT id FROM products ORDER BY id LIMIT 1").fetchone()["id"]

    def test_numeric_validators_reject_invalid_and_nonfinite_values(self):
        with self.assertRaises(ValueError):
            validate_strategy_payload({"phase": "Некорректная тестовая фаза", "base_tdee": "Infinity", "protein_min": 111, "protein_max": 149, "goal_delta": -321})
        with self.assertRaises(ValueError):
            product_values_from_input({"name": "Тест", "category": "Супы", "serving_grams": "NaN", "kcal_100": 10, "protein_100": 1, "fat_100": 1, "carbs_100": 1})
        with self.assertRaises(ValueError):
            validate_workout_set_payload({"exercise": "Жим", "weight": "abc", "reps": 10})
        with self.assertRaises(ValueError):
            validate_cardio_payload({"duration_minutes": "Infinity", "intervals": []})

    def test_optional_measurements_remain_empty_but_empty_payload_is_rejected(self):
        with self.assertRaises(ValueError):
            measurement_values_from_payload({})
        _, fields, values, _ = measurement_values_from_payload({"weight": 74})
        self.assertEqual(values[fields.index("weight")], 74)
        self.assertIsNone(values[fields.index("waist")])

    def test_exercise_payload_rejects_invalid_containers_and_duplicate_templates(self):
        valid = {"name": "Жим", "template_ids": [1], "primary_muscles": ["грудь"], "secondary_muscles": [], "subgroup_ids": {"1": 1}}
        self.assertEqual(validate_exercise_payload(valid)["muscle_profile"]["primary"], ["грудь"])
        for payload in (
            {**valid, "template_ids": [1, 1]},
            {**valid, "primary_muscles": "грудь"},
            {**valid, "subgroup_ids": []},
        ):
            with self.assertRaises(ValueError):
                validate_exercise_payload(payload)

    def test_image_upload_validates_signature_and_size(self):
        with self.assertRaises(ValueError):
            save_product_image(FileStorage(BytesIO(b"not an image"), filename="fake.png"))
        oversized = BytesIO(b"\x89PNG\r\n\x1a\n" + b"x" * (8 * 1024 * 1024))
        with self.assertRaises(ValueError):
            save_product_image(FileStorage(oversized, filename="large.png"))

    def test_same_request_token_creates_exactly_one_food_entry(self):
        day = self.day()
        body = {
            "product_id": self.first_product_id(),
            "quantity": 1,
            "quantity_mode": "serving",
            "meal_type": "Завтрак",
            "request_token": "same-click",
        }
        first = self.client.post(f"/api/day/{day['day']['id']}/food", json=body)
        second = self.client.post(f"/api/day/{day['day']['id']}/food", json=body)

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.get_json()["food_write"], "created")
        self.assertEqual(second.get_json()["food_write"], "duplicate_ignored")
        with project.db() as con:
            count = con.execute("SELECT COUNT(*) FROM food_entries").fetchone()[0]
        self.assertEqual(count, 1)

    def test_day_numbers_use_one_consistent_equation(self):
        day = self.day()
        with project.db() as con:
            product = con.execute("SELECT id, kcal FROM products ORDER BY id LIMIT 1").fetchone()
        response = self.client.post(
            f"/api/day/{day['day']['id']}/food",
            json={
                "product_id": product["id"],
                "quantity": 2,
                "quantity_mode": "serving",
                "meal_type": "Завтрак",
                "request_token": "two-servings",
            },
        )
        summary = response.get_json()["summary"]
        expected_intake = product["kcal"] * 2

        self.assertAlmostEqual(summary["intake"], expected_intake, places=1)
        self.assertAlmostEqual(summary["tdee"], 2345, places=1)
        self.assertAlmostEqual(summary["target"], 2024, places=1)
        self.assertAlmostEqual(summary["remaining_kcal"], 2024 - expected_intake, places=1)
        self.assertAlmostEqual(summary["delta"], expected_intake - 2345, places=1)
        self.assertAlmostEqual(summary["budget_delta"], expected_intake - 2024, places=1)

    def test_closed_day_global_balance_does_not_change_with_future_weight(self):
        day = self.day()
        day_id = day["day"]["id"]
        self.client.patch(f"/api/day/{day_id}", json={"steps": 10_000})
        closed = self.client.post(f"/api/day/{day_id}/close")
        self.assertEqual(closed.status_code, 200)
        balance_before = closed.get_json()["global_balance"]

        self.client.post(
            "/api/progress",
            json={"measured_on": "2035-07-26", "weight": 140},
        )
        balance_after = self.day()["global_balance"]
        self.assertAlmostEqual(balance_before, balance_after, places=1)

    def test_watch_active_calories_replace_step_formula(self):
        day = self.day()
        day_id = day["day"]["id"]
        formula = self.client.patch(
            f"/api/day/{day_id}", json={"steps": 10_000, "watch_active_kcal": ""}
        ).get_json()
        self.assertAlmostEqual(formula["summary"]["steps_kcal"], 259.0, places=1)
        self.assertEqual(formula["summary"]["steps_source"], "formula")
        watch = self.client.patch(
            f"/api/day/{day_id}", json={"steps": 10_000, "watch_active_kcal": 430}
        ).get_json()
        self.assertAlmostEqual(watch["summary"]["steps_kcal"], 430.0, places=1)
        self.assertEqual(watch["summary"]["steps_source"], "watch")
        self.assertAlmostEqual(
            watch["summary"]["tdee"], watch["day"]["base_tdee"] + 430, places=1
        )

    def test_fractional_portions_are_rejected(self):
        day = self.day()
        response = self.client.post(
            f"/api/day/{day['day']['id']}/food",
            json={
                "product_id": self.first_product_id(),
                "quantity": 0.1,
                "quantity_mode": "serving",
                "request_token": "fraction",
            },
        )
        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()
