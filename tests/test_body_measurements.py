import sqlite3
import tempfile
import unittest
from pathlib import Path

import app as application


class BodyMeasurementMigrationTests(unittest.TestCase):
    def test_legacy_migration_preserves_values_and_creates_backup(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            database_path = root / "legacy.db"
            backup_path = root / "backups"
            connection = sqlite3.connect(database_path)
            connection.executescript(
                """CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
                   CREATE TABLE measurements(
                       id INTEGER PRIMARY KEY,
                       measured_on TEXT NOT NULL,
                       weight REAL,
                       waist REAL,
                       belly REAL,
                       shoulders REAL,
                       biceps REAL,
                       chest REAL,
                       hips REAL,
                       thigh REAL,
                       note TEXT
                   );
                   INSERT INTO measurements(
                       measured_on, weight, waist, belly, shoulders, biceps, chest, hips, thigh, note
                   ) VALUES ('2030-01-01', 74.2, 81.1, 84.2, 112.3, 36.4, 101.5, 94.6, 57.7, 'legacy');
                   INSERT INTO measurements(measured_on, weight) VALUES ('2030-01-02', 74.0);"""
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
            application.BACKUP_DIR = backup_path
            try:
                application.init_db()
                with application.db() as migrated:
                    records = migrated.execute(
                        "SELECT id, record_type FROM measurements ORDER BY id"
                    ).fetchall()
                    values = migrated.execute(
                        """SELECT field.slug, value.value
                           FROM body_measurement_values value
                           JOIN body_measurement_fields field ON field.id=value.field_id
                           WHERE value.measurement_id=1 ORDER BY field.sort_order"""
                    ).fetchall()
                self.assertEqual([row["record_type"] for row in records], ["mixed", "weight"])
                self.assertEqual(
                    {row["slug"]: row["value"] for row in values},
                    {
                        "waist": 81.1,
                        "belly": 84.2,
                        "shoulders": 112.3,
                        "biceps": 36.4,
                        "chest": 101.5,
                        "hips": 94.6,
                        "thigh": 57.7,
                    },
                )
                self.assertEqual(
                    len(list(backup_path.glob("ceo_body_measurement-model-v1_*.db"))),
                    1,
                )

                application.init_db()
                self.assertEqual(
                    len(list(backup_path.glob("ceo_body_measurement-model-v1_*.db"))),
                    1,
                )
            finally:
                application.DB_PATH, application.UPLOAD_DIR, application.BACKUP_DIR = original_paths


class BodyMeasurementApiTests(unittest.TestCase):
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

    def tearDown(self):
        application.DB_PATH, application.UPLOAD_DIR, application.BACKUP_DIR = self.original_paths
        self.temp_dir.cleanup()

    def test_new_field_is_available_for_historical_measurement_without_empty_rows(self):
        created = self.client.post(
            "/api/measurements/tape",
            json={"measured_on": "2030-01-01", "values": {"waist": 81, "belly": 84}},
        ).get_json()
        field = self.client.post(
            "/api/measurement-fields", json={"name": "Шея", "sort_order": 15}
        ).get_json()

        progress = self.client.get("/api/progress").get_json()
        self.assertIn(field["slug"], [item["slug"] for item in progress["measurement_fields"]])
        self.assertNotIn(field["slug"], progress["measurements"][0]["values"])

        updated = self.client.patch(
            f"/api/measurements/tape/{created['id']}",
            json={"measured_on": "2030-01-01", "values": {field["slug"]: 39.5}},
        )
        self.assertEqual(updated.status_code, 200)
        values = updated.get_json()["values"]
        self.assertEqual(values["waist"], 81)
        self.assertEqual(values["belly"], 84)
        self.assertEqual(values[field["slug"]], 39.5)

    def test_archive_and_restore_preserve_history(self):
        field = self.client.post(
            "/api/measurement-fields", json={"name": "Голень"}
        ).get_json()
        measurement = self.client.post(
            "/api/measurements/tape",
            json={"measured_on": "2030-02-01", "values": {field["slug"]: 38}},
        ).get_json()

        archived = self.client.patch(
            f"/api/measurement-fields/{field['id']}", json={"active": False}
        )
        self.assertFalse(archived.get_json()["active"])
        active_slugs = {
            item["slug"]
            for item in self.client.get("/api/measurement-fields").get_json()["fields"]
        }
        self.assertNotIn(field["slug"], active_slugs)
        history = self.client.get("/api/measurements").get_json()["measurements"]
        self.assertEqual(history[0]["values"][field["slug"]], 38)

        restored = self.client.patch(
            f"/api/measurement-fields/{field['id']}",
            json={"active": True, "name": "Икра", "sort_order": 5},
        )
        self.assertTrue(restored.get_json()["active"])
        self.assertEqual(restored.get_json()["name"], "Икра")
        self.assertEqual(restored.get_json()["sort_order"], 5)
        self.assertEqual(history[0]["id"], measurement["id"])

    def test_weight_is_separate_and_repeated_saves_update(self):
        first = self.client.post(
            "/api/measurements/weight",
            json={"measured_on": "2030-03-01", "weight": 74.2},
        )
        second = self.client.post(
            "/api/measurements/weight",
            json={"measured_on": "2030-03-01", "weight": 74.1},
        )
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.get_json()["id"], second.get_json()["id"])
        self.assertEqual(second.get_json()["record_type"], "weight")
        self.assertEqual(second.get_json()["values"], {})
        first_tape = self.client.post(
            "/api/measurements/tape",
            json={"measured_on": "2030-03-02", "values": {"waist": 81}},
        ).get_json()
        second_tape = self.client.post(
            "/api/measurements/tape",
            json={"measured_on": "2030-03-02", "values": {"waist": 80.8}},
        ).get_json()
        self.assertEqual(first_tape["id"], second_tape["id"])
        self.assertEqual(second_tape["values"]["waist"], 80.8)
        with application.db() as connection:
            count = connection.execute(
                """SELECT COUNT(*) FROM measurements
                   WHERE measured_on='2030-03-01' AND record_type='weight'"""
            ).fetchone()[0]
        self.assertEqual(count, 1)

    def test_legacy_combined_save_creates_one_mixed_record(self):
        response = self.client.post(
            "/api/progress",
            json={"measured_on": "2030-03-03", "weight": 74, "waist": 80},
        )
        self.assertEqual(response.status_code, 200)
        measurements = [
            item
            for item in response.get_json()["measurements"]
            if item["measured_on"] == "2030-03-03"
        ]
        self.assertEqual(len(measurements), 1)
        self.assertEqual(measurements[0]["record_type"], "mixed")
        self.assertEqual(measurements[0]["weight"], 74)
        self.assertEqual(measurements[0]["values"]["waist"], 80)

    def test_conflicting_legacy_duplicates_are_not_merged(self):
        with application.db() as connection:
            connection.executemany(
                """INSERT INTO measurements(measured_on, record_type, note)
                   VALUES ('2030-04-01', 'tape', ?)""",
                [("first",), ("second",)],
            )
        response = self.client.post(
            "/api/measurements/tape",
            json={"measured_on": "2030-04-01", "values": {"waist": 80}},
        )
        self.assertEqual(response.status_code, 409)
        with application.db() as connection:
            self.assertEqual(
                connection.execute(
                    "SELECT COUNT(*) FROM measurements WHERE measured_on='2030-04-01'"
                ).fetchone()[0],
                2,
            )


if __name__ == "__main__":
    unittest.main()
