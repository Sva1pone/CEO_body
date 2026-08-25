from __future__ import annotations

import unittest
from pathlib import Path
from unittest.mock import patch

import app as application
from backend.config import PROJECT_ROOT, resolve_runtime_paths
from tests.e2e.test_server import configure_test_environment


class TestEnvironmentConfigurationTests(unittest.TestCase):
    def test_application_uses_a_non_default_secret_and_upload_limit(self) -> None:
        self.assertNotEqual(application.app.config["SECRET_KEY"], "local-ceo-body-app")
        self.assertEqual(application.app.config["MAX_CONTENT_LENGTH"], 10 * 1024 * 1024)

    def test_explicit_test_paths_replace_every_runtime_data_location(self) -> None:
        root = Path("C:/temporary/ceo-body-test")
        paths = resolve_runtime_paths(
            {
                "CEO_BODY_DATA_DIR": str(root / "data"),
                "CEO_BODY_DATABASE_PATH": str(root / "database" / "test.db"),
                "CEO_BODY_UPLOAD_DIR": str(root / "uploads"),
                "CEO_BODY_BACKUP_DIR": str(root / "backups"),
            }
        )

        self.assertEqual(paths["data_dir"], root / "data")
        self.assertEqual(paths["database_path"], root / "database" / "test.db")
        self.assertEqual(paths["upload_dir"], root / "uploads")
        self.assertEqual(paths["backup_dir"], root / "backups")
        self.assertNotEqual(paths["database_path"], PROJECT_ROOT / "data" / "ceo_body.db")

    def test_e2e_server_overrides_inherited_database_path(self) -> None:
        root = Path("C:/temporary/ceo-body-test")
        with patch.dict(
            "os.environ",
            {"CEO_BODY_DATABASE_PATH": str(PROJECT_ROOT / "data" / "ceo_body.db")},
            clear=True,
        ):
            configure_test_environment(root)
            paths = resolve_runtime_paths()

        self.assertEqual(paths["database_path"], root / "data" / "ceo_body_e2e.db")
        self.assertNotEqual(paths["database_path"], PROJECT_ROOT / "data" / "ceo_body.db")
