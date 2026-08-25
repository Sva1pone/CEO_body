from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import app as application  # noqa: E402
from tests.fixtures import create_test_data  # noqa: E402


class WeightTrendApiTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.original_database = application.DB_PATH
        self.original_uploads = application.UPLOAD_DIR
        self.original_backups = application.BACKUP_DIR
        application.DB_PATH = Path(self.temporary_directory.name) / "test.db"
        application.UPLOAD_DIR = Path(self.temporary_directory.name) / "uploads"
        application.BACKUP_DIR = Path(self.temporary_directory.name) / "backups"
        application.app.config.update(TESTING=True)
        application.init_db()
        create_test_data(application.db)
        self.client = application.app.test_client()

    def tearDown(self) -> None:
        application.DB_PATH = self.original_database
        application.UPLOAD_DIR = self.original_uploads
        application.BACKUP_DIR = self.original_backups
        self.temporary_directory.cleanup()

    def close_day_with_food(self, log_date: str, request_token: str) -> None:
        day = self.client.post(f"/api/day?date={log_date}").get_json()
        product_id = next(
            product["id"]
            for product in day["products"]
            if product["name"] == "Тестовый продукт"
        )
        self.client.post(
            f"/api/day/{day['day']['id']}/food",
            json={
                "product_id": product_id,
                "quantity": 1,
                "quantity_mode": "serving",
                "meal_type": "Завтрак",
                "request_token": request_token,
            },
        )
        closed = self.client.post(f"/api/day/{day['day']['id']}/close")
        self.assertEqual(closed.status_code, 200)

    def test_weight_trend_reads_history_without_writing_to_database(self) -> None:
        self.close_day_with_food("2030-01-02", "weight-trend-1")
        self.close_day_with_food("2030-01-09", "weight-trend-2")
        self.close_day_with_food("2030-01-18", "weight-trend-3")
        self.client.post("/api/progress", json={"measured_on": "2030-01-09", "weight": 137.8})
        self.client.post("/api/progress", json={"measured_on": "2030-01-18", "weight": 137.5})

        with application.db() as connection:
            before = {
                table: connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
                for table in ("measurements", "days", "food_entries")
            }

        response = self.client.get("/api/weight-trend?start=2030-01-01&end=2030-01-31")

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(len(payload["points"]), 3)
        self.assertEqual(payload["comparison"]["status"], "aligned")
        self.assertLess(payload["comparison"]["expected_change"], 0)
        self.assertIsNone(payload["points"][0]["expected_weight"])
        expected_weight = round(
            payload["points"][0]["weight"]
            + payload["points"][1]["energy_delta"]
            / payload["kcal_per_kg_energy_equivalent"],
            2,
        )
        self.assertEqual(payload["points"][1]["expected_weight"], expected_weight)
        self.assertEqual(payload["points"][2]["closed_days_count"], 2)

        with application.db() as connection:
            after = {
                table: connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
                for table in before
            }
        self.assertEqual(after, before)
