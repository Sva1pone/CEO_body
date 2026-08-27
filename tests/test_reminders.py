import sqlite3
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path

import app as application
from backend.services.reminders import get_reminders


class ReminderMigrationTests(unittest.TestCase):
    def test_existing_strategies_receive_default_interval(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            database_path = root / "legacy.db"
            connection = sqlite3.connect(database_path)
            connection.executescript(
                """CREATE TABLE strategy_versions(
                       id INTEGER PRIMARY KEY,
                       effective_from TEXT NOT NULL UNIQUE,
                       phase TEXT NOT NULL,
                       base_tdee REAL NOT NULL,
                       protein_min REAL NOT NULL,
                       protein_max REAL NOT NULL,
                       goal_delta REAL NOT NULL,
                       note TEXT,
                       created_at TEXT NOT NULL
                   );
                   INSERT INTO strategy_versions(
                       effective_from, phase, base_tdee, protein_min,
                       protein_max, goal_delta, note, created_at
                   ) VALUES ('2030-01-01', 'Legacy', 2200, 120, 150, -400, '', '2030-01-01T00:00:00');"""
            )
            connection.commit()
            connection.close()

            original_paths = (
                application.DB_PATH,
                application.UPLOAD_DIR,
                application.BACKUP_DIR,
            )
            application.DB_PATH = database_path
            application.UPLOAD_DIR = root / "uploads"
            application.BACKUP_DIR = root / "backups"
            try:
                application.init_db()
                with application.db() as migrated:
                    interval = migrated.execute(
                        "SELECT measurement_reminder_days FROM strategy_versions"
                    ).fetchone()["measurement_reminder_days"]
                self.assertEqual(interval, 14)
            finally:
                application.DB_PATH, application.UPLOAD_DIR, application.BACKUP_DIR = original_paths


class ReminderApiTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        root = Path(self.temp_dir.name)
        self.original_paths = (
            application.DB_PATH,
            application.UPLOAD_DIR,
            application.BACKUP_DIR,
        )
        application.DB_PATH = root / "test.db"
        application.UPLOAD_DIR = root / "uploads"
        application.BACKUP_DIR = root / "backups"
        application.init_db()
        application.app.config.update(TESTING=True)
        self.client = application.app.test_client()
        self.add_strategy("2030-01-01", 3)

    def tearDown(self):
        application.DB_PATH, application.UPLOAD_DIR, application.BACKUP_DIR = self.original_paths
        self.temp_dir.cleanup()

    def add_strategy(self, effective_from: str, interval: int):
        with application.db() as connection:
            connection.execute(
                """INSERT INTO strategy_versions(
                       effective_from, phase, base_tdee, protein_min, protein_max,
                       goal_delta, measurement_reminder_days, note, created_at
                   ) VALUES (?, 'Test', 2200, 120, 150, -400, ?, '', ?)""",
                (effective_from, interval, f"{effective_from}T00:00:00"),
            )

    def add_day(self, log_date: str, **values):
        columns = ["log_date", "day_type", "phase", "base_tdee", "goal_delta"]
        parameters = [log_date, "Отдых", "Test", 2200, -400]
        columns.extend(values)
        parameters.extend(values.values())
        placeholders = ", ".join("?" for _ in parameters)
        with application.db() as connection:
            cursor = connection.execute(
                f"INSERT INTO days({', '.join(columns)}) VALUES ({placeholders})",
                parameters,
            )
            return cursor.lastrowid

    def test_only_meaningful_past_open_days_are_returned(self):
        empty_id = self.add_day("2030-01-01")
        meaningful_id = self.add_day("2030-01-02", setup_done=1)
        self.add_day("2030-01-03", note="filled", closed_at="2030-01-04T00:00:00")
        self.add_day("2030-01-05", setup_done=1)
        self.add_day("2030-01-06", setup_done=1)

        reminders = get_reminders(date(2030, 1, 5))

        self.assertEqual(
            reminders["unclosed_days"],
            {"count": 1, "items": [{"id": meaningful_id, "log_date": "2030-01-02"}]},
        )
        self.assertNotEqual(empty_id, meaningful_id)

    def test_food_workout_activity_sleep_and_note_make_a_day_meaningful(self):
        day_ids = [
            self.add_day("2030-01-02", steps=1),
            self.add_day("2030-01-03", watch_active_kcal=0),
            self.add_day("2030-01-04", manual_adjustment=1),
            self.add_day("2030-01-05", sleep_start="23:00"),
            self.add_day("2030-01-06", note="note"),
            self.add_day("2030-01-07"),
            self.add_day("2030-01-08"),
        ]
        with application.db() as connection:
            connection.execute(
                """INSERT INTO food_entries(
                       day_id, product_name, quantity, kcal, protein, created_at
                   ) VALUES (?, 'Food', 1, 100, 10, '2030-01-07T00:00:00')""",
                (day_ids[-2],),
            )
            connection.execute(
                """INSERT INTO workouts(
                       day_id, title, duration_minutes, intensity_met, created_at
                   ) VALUES (?, 'Workout', 30, 3.5, '2030-01-08T00:00:00')""",
                (day_ids[-1],),
            )

        reminders = get_reminders(date(2030, 1, 10))

        self.assertEqual(
            [item["id"] for item in reminders["unclosed_days"]["items"]],
            day_ids,
        )

    def test_endpoint_is_read_only(self):
        with application.db() as connection:
            before = connection.execute("SELECT COUNT(*) FROM days").fetchone()[0]

        response = self.client.get("/api/reminders")

        with application.db() as connection:
            after = connection.execute("SELECT COUNT(*) FROM days").fetchone()[0]
        self.assertEqual(response.status_code, 200)
        self.assertEqual(after, before)

    def test_weight_does_not_reset_tape_deadline_and_active_strategy_sets_interval(self):
        self.client.post(
            "/api/measurements/weight",
            json={"measured_on": "2030-01-03", "weight": 74},
        )
        self.add_strategy("2030-01-04", 7)

        reminders = get_reminders(date(2030, 1, 11))

        self.assertIsNone(reminders["measurement"]["last_tape_date"])
        self.assertEqual(reminders["measurement"]["interval_days"], 7)
        self.assertEqual(reminders["measurement"]["next_due_date"], "2030-01-11")
        self.assertTrue(reminders["measurement"]["overdue"])

    def test_new_tape_measurement_starts_a_full_countdown(self):
        overdue = get_reminders(date(2030, 1, 4))
        self.assertTrue(overdue["measurement"]["overdue"])

        self.client.post(
            "/api/measurements/tape",
            json={"measured_on": "2030-01-04", "values": {"waist": 80}},
        )
        refreshed = get_reminders(date(2030, 1, 4))

        self.assertFalse(refreshed["measurement"]["overdue"])
        self.assertEqual(refreshed["measurement"]["next_due_date"], "2030-01-07")

    def test_editing_old_tape_and_adding_weight_do_not_reset_countdown(self):
        tape = self.client.post(
            "/api/measurements/tape",
            json={"measured_on": "2030-01-02", "values": {"waist": 81}},
        ).get_json()
        self.client.patch(
            f"/api/measurements/tape/{tape['id']}",
            json={"measured_on": "2030-01-02", "values": {"waist": 80.5}},
        )
        self.client.post(
            "/api/measurements/weight",
            json={"measured_on": "2030-01-06", "weight": 73.8},
        )

        reminders = get_reminders(date(2030, 1, 6))

        self.assertEqual(reminders["measurement"]["last_tape_date"], "2030-01-02")
        self.assertEqual(reminders["measurement"]["next_due_date"], "2030-01-05")
        self.assertTrue(reminders["measurement"]["overdue"])

    def test_strategy_rejects_interval_below_one(self):
        response = self.client.post(
            "/api/strategy",
            json={
                "effective_from": (date.today() + timedelta(days=1)).isoformat(),
                "phase": "Invalid interval",
                "base_tdee": 2200,
                "protein_min": 120,
                "protein_max": 150,
                "goal_delta": -400,
                "measurement_reminder_days": 0,
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("не меньше 1 дня", response.get_json()["error"])


if __name__ == "__main__":
    unittest.main()
