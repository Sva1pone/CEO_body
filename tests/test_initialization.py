"""Database schema initialization contracts."""

import os
import tempfile
import unittest
from datetime import datetime
from pathlib import Path

import app as application
from backend.database.backups import (
    ManualBackupLimitError,
    list_backups,
    validate_manual_backup_creation,
)


class FreshDatabaseInitializationTests(unittest.TestCase):
    def test_manual_backup_limit_preserves_existing_files(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            backup_directory = Path(directory)
            existing = backup_directory / "ceo_body_manual_20260801_120000_000000.db"
            existing.write_bytes(b"backup")

            with self.assertRaises(ManualBackupLimitError):
                validate_manual_backup_creation(backup_directory, 30, 100)

            self.assertTrue(existing.exists())

    def test_manual_backup_count_limit_preserves_existing_files(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            backup_directory = Path(directory)
            existing = backup_directory / "ceo_body_manual_20250101_120000_000000.db"
            existing.write_bytes(b"backup")
            old_time = datetime(2025, 1, 1).timestamp()
            os.utime(existing, (old_time, old_time))

            with self.assertRaises(ManualBackupLimitError):
                validate_manual_backup_creation(backup_directory, 30, 1)

            self.assertTrue(existing.exists())

    def test_missing_backup_returns_json_404(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            original_backup = application.BACKUP_DIR
            application.BACKUP_DIR = Path(directory)
            try:
                response = application.app.test_client().get(
                    "/api/backups/ceo_body_missing.db/download"
                )
            finally:
                application.BACKUP_DIR = original_backup

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.get_json()["error"], "Резервная копия не найдена.")

    def test_partial_backup_is_not_listed(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            backup_directory = Path(directory)
            (backup_directory / ".ceo_body_partial.db.partial").write_bytes(b"partial")
            self.assertEqual(list_backups(backup_directory), [])

    def test_connection_enables_wal_and_busy_timeout(self) -> None:
        original_path = application.DB_PATH
        with tempfile.TemporaryDirectory() as directory:
            application.DB_PATH = Path(directory) / "connection.db"
            try:
                with application.db() as connection:
                    self.assertEqual(connection.execute("PRAGMA journal_mode").fetchone()[0], "wal")
                    self.assertEqual(connection.execute("PRAGMA busy_timeout").fetchone()[0], 5000)
            finally:
                application.DB_PATH = original_path

    def test_new_database_contains_schema_without_personal_catalogs(self) -> None:
        original_paths = (
            application.DB_PATH,
            application.UPLOAD_DIR,
            application.BACKUP_DIR,
        )
        with tempfile.TemporaryDirectory() as directory:
            base_path = Path(directory)
            application.DB_PATH = base_path / "empty.db"
            application.UPLOAD_DIR = base_path / "uploads"
            application.BACKUP_DIR = base_path / "backups"
            try:
                application.init_db()
                with application.db() as connection:
                    for table in (
                        "products",
                        "product_categories",
                        "workout_templates",
                        "exercise_catalog",
                        "strategy_versions",
                    ):
                        count = connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
                        self.assertEqual(count, 0, table)
                    markers = {
                        row["key"]
                        for row in connection.execute("SELECT key FROM settings")
                    }
                    self.assertEqual(markers, set())
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

                response = application.app.test_client().get("/api/day?date=2030-01-01")
                self.assertEqual(response.status_code, 409)
                self.assertEqual(response.get_json()["error"], "Сначала создай стратегию питания.")

                client = application.app.test_client()
                for page_path in (
                    "/",
                    "/exercises",
                    "/progress",
                    "/statistics",
                    "/weight-trend",
                    "/settings",
                    "/report",
                ):
                    self.assertEqual(client.get(page_path).status_code, 200, page_path)
                for api_path in (
                    "/api/exercises",
                    "/api/progress",
                    "/api/statistics?start=2030-01-01&end=2030-01-31",
                    "/api/weight-trend?start=2030-01-01&end=2030-01-31",
                    "/api/strategy",
                    "/api/report?start=2030-01-01&end=2030-01-31",
                    "/api/registry",
                ):
                    self.assertEqual(client.get(api_path).status_code, 200, api_path)
            finally:
                application.DB_PATH, application.UPLOAD_DIR, application.BACKUP_DIR = original_paths
