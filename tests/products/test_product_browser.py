from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import app as application  # noqa: E402
from tests.fixtures import create_test_data  # noqa: E402


class ProductBrowserApiTest(unittest.TestCase):
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
        application.init_db()
        self.client = application.app.test_client()

    def tearDown(self) -> None:
        application.DB_PATH = self.original_database
        application.UPLOAD_DIR = self.original_uploads
        application.BACKUP_DIR = self.original_backups
        self.temporary_directory.cleanup()

    def create_day(self, log_date: str = "2031-02-03") -> dict:
        response = self.client.post(f"/api/day?date={log_date}")
        self.assertEqual(response.status_code, 201)
        return response.get_json()

    def test_archiving_hides_product_without_changing_food_history_and_restore_returns_it(self) -> None:
        day = self.create_day()
        product = day["products"][0]
        add_response = self.client.post(
            f"/api/day/{day['day']['id']}/food",
            json={
                "product_id": product["id"],
                "quantity": 1,
                "quantity_mode": "serving",
                "meal_type": "Завтрак",
                "request_token": "archive-history",
            },
        )
        self.assertEqual(add_response.status_code, 200)

        archive_response = self.client.delete(f"/api/registry/{product['id']}")

        self.assertEqual(archive_response.status_code, 200)
        active_ids = {item["id"] for item in self.client.get("/api/registry").get_json()["products"]}
        archived_ids = {item["id"] for item in self.client.get("/api/registry/archive").get_json()["products"]}
        self.assertNotIn(product["id"], active_ids)
        self.assertIn(product["id"], archived_ids)
        with application.db() as connection:
            historical_entry = connection.execute(
                "SELECT product_id, product_name, kcal FROM food_entries WHERE request_token=?",
                ("archive-history",),
            ).fetchone()
        self.assertEqual(historical_entry["product_id"], product["id"])
        self.assertEqual(historical_entry["product_name"], product["name"])
        self.assertGreater(historical_entry["kcal"], 0)

        restore_response = self.client.post(f"/api/registry/{product['id']}/restore")

        self.assertEqual(restore_response.status_code, 200)
        restored_ids = {item["id"] for item in self.client.get("/api/registry").get_json()["products"]}
        self.assertIn(product["id"], restored_ids)

    def test_temp_product_is_added_to_day_and_can_be_promoted(self) -> None:
        day = self.create_day("2031-02-04")

        temp_response = self.client.post(
            f"/api/day/{day['day']['id']}/temp-food",
            json={
                "name": "Разовый десерт",
                "nutrition_basis": "per_100g",
                "quantity": 150,
                "kcal_basis": 200,
                "protein_basis": 10,
                "meal_type": "Перекус",
            },
        )

        self.assertEqual(temp_response.status_code, 201)
        temp_product_id = temp_response.get_json()["temp_product_id"]
        temp_products = self.client.get("/api/temp-products").get_json()["products"]
        self.assertEqual([item["id"] for item in temp_products], [temp_product_id])
        with application.db() as connection:
            entry = connection.execute(
                "SELECT product_id, quantity, kcal, protein FROM food_entries WHERE id=?",
                (temp_response.get_json()["entry_id"],),
            ).fetchone()
        self.assertIsNone(entry["product_id"])
        self.assertEqual(entry["quantity"], 150)
        self.assertEqual(entry["kcal"], 300)
        self.assertEqual(entry["protein"], 15)

        regular_product_id = day["products"][0]["id"]
        promote_response = self.client.post(
            f"/api/temp-products/{temp_product_id}/promote",
            json={"product_id": regular_product_id},
        )

        self.assertEqual(promote_response.status_code, 200)
        self.assertEqual(self.client.get("/api/temp-products").get_json()["products"], [])
        with application.db() as connection:
            status = connection.execute(
                "SELECT status, promoted_product_id FROM temp_products WHERE id=?",
                (temp_product_id,),
            ).fetchone()
        self.assertEqual(status["status"], "promoted")
        self.assertEqual(status["promoted_product_id"], regular_product_id)

    def test_first_subcategory_collects_existing_products_and_unassigned_hides_when_empty(self) -> None:
        registry = self.client.get("/api/registry").get_json()
        category = registry["categories"][0]
        product_ids = {
            product["id"]
            for product in registry["products"]
            if product["category"] == category["name"]
        }

        create_response = self.client.post(
            f"/api/categories/{category['id']}/subcategories",
            json={"name": "Протеиновые снеки"},
        )

        self.assertEqual(create_response.status_code, 201)
        subcategories = create_response.get_json()["subcategories"]
        target = next(item for item in subcategories if item["name"] == "Протеиновые снеки")
        unassigned = next(item for item in subcategories if item["system_key"] == "unassigned")
        with application.db() as connection:
            assigned_ids = {
                row["id"]
                for row in connection.execute(
                    "SELECT id FROM products WHERE subcategory_id=?",
                    (unassigned["id"],),
                ).fetchall()
            }
        self.assertEqual(assigned_ids, product_ids)

        for product_id in product_ids:
            move_response = self.client.patch(
                f"/api/registry/{product_id}/subcategory",
                json={"subcategory_id": target["id"]},
            )
            self.assertEqual(move_response.status_code, 200)

        remaining = self.client.get(
            f"/api/categories/{category['id']}/subcategories"
        ).get_json()["subcategories"]
        self.assertNotIn("Неразмечено", {item["name"] for item in remaining})


if __name__ == "__main__":
    unittest.main()
