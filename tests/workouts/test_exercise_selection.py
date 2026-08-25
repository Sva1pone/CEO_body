from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / ".venv" / "Lib" / "site-packages"))
sys.path.insert(0, str(ROOT))

import app as application  # noqa: E402
from tests.fixtures import create_test_data  # noqa: E402


class WorkoutExerciseSelectionTests(unittest.TestCase):
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

    def test_workout_uses_one_active_catalog_exercise_by_id(self) -> None:
        templates = self.client.get("/api/workout/templates").get_json()["templates"]
        legs_template = next(item for item in templates if item["name"] == "Тестовый шаблон C")

        with application.db() as connection:
            catalog = connection.execute(
                "INSERT INTO exercise_catalog(name, muscle_group, created_at) VALUES (?, ?, ?)",
                ("Синтетическое упражнение X", "Тестовая группа", "2030-01-01T00:00:00"),
            )
            connection.executemany(
                "INSERT INTO workout_template_exercises(template_id, exercise_name, sort_order) VALUES (?, ?, ?)",
                [
                    (legs_template["id"], "Синтетическое упражнение без каталога", 20),
                    (legs_template["id"], "Синтетическое упражнение X", 30),
                ],
            )

        day = self.client.post("/api/day?date=2030-06-01").get_json()["day"]
        workout = self.client.post(
            f"/api/day/{day['id']}/workout",
            json={"template_id": legs_template["id"]},
        ).get_json()["workout"]
        details = self.client.get(f"/api/workout/{workout['id']}").get_json()

        matching = [
            item
            for item in details["available_exercises"]
            if "Синтетическое упражнение" in item["name"]
        ]
        available_names = {
            item["name"] for item in details["available_exercises"]
        }
        self.assertEqual(
            matching,
            [{"id": catalog.lastrowid, "name": "Синтетическое упражнение X"}],
        )
        self.assertNotIn("Тестовое упражнение A", available_names)
        self.assertNotIn("Тестовое упражнение B", available_names)

        created = self.client.post(
            f"/api/workout/{workout['id']}/exercise",
            json={"exercise_id": catalog.lastrowid, "set_count": 3},
        )
        duplicate = self.client.post(
            f"/api/workout/{workout['id']}/exercise",
            json={"exercise_id": catalog.lastrowid, "set_count": 3},
        )

        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.get_json()["sets"][0]["exercise"], "Синтетическое упражнение X")
        self.assertEqual(duplicate.status_code, 409)
        self.assertEqual(duplicate.get_json()["error"], "Это упражнение уже добавлено в тренировку.")

        with application.db() as connection:
            stale_catalog_count = connection.execute(
                "SELECT COUNT(*) FROM exercise_catalog WHERE name=?",
                ("Синтетическое упражнение без каталога",),
            ).fetchone()[0]
        self.assertEqual(stale_catalog_count, 0)


if __name__ == "__main__":
    unittest.main()
