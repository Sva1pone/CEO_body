from __future__ import annotations

import io
import json
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / ".venv" / "Lib" / "site-packages"))
sys.path.insert(0, str(ROOT))

from werkzeug.datastructures import FileStorage  # noqa: E402

import app as application  # noqa: E402
from backend.services.exercise_packs import (  # noqa: E402
    ExercisePackError,
    build_exercise_pack,
    import_exercise_pack,
    inspect_exercise_pack,
)
from tests.fixtures import create_test_data  # noqa: E402


def upload(content: bytes, name: str = "catalog.ceopack.zip") -> FileStorage:
    return FileStorage(stream=io.BytesIO(content), filename=name, content_type="application/zip")


def rewrite_pack(content: bytes, changes: dict[str, bytes], extra: dict[str, bytes] | None = None) -> bytes:
    output = io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(content)) as source, zipfile.ZipFile(output, "w") as target:
        for info in source.infolist():
            target.writestr(info.filename, changes.get(info.filename, source.read(info)))
        for name, value in (extra or {}).items():
            target.writestr(name, value)
    return output.getvalue()


class ExercisePackTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_db = application.DB_PATH
        self.original_upload = application.UPLOAD_DIR
        self.original_backup = application.BACKUP_DIR
        application.DB_PATH = Path(self.temp_dir.name) / "source.db"
        application.UPLOAD_DIR = Path(self.temp_dir.name) / "uploads"
        application.BACKUP_DIR = Path(self.temp_dir.name) / "backups"
        application.app.config.update(TESTING=True)
        application.init_db()
        create_test_data(application.db)
        application.init_db()

    def tearDown(self) -> None:
        application.DB_PATH = self.original_db
        application.UPLOAD_DIR = self.original_upload
        application.BACKUP_DIR = self.original_backup
        self.temp_dir.cleanup()

    def catalog(self, content: bytes) -> dict:
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            return json.loads(archive.read("catalog.json"))

    def test_export_all_is_ordered_and_contains_no_history(self) -> None:
        with application.db() as connection:
            template = connection.execute("SELECT id FROM workout_templates ORDER BY id LIMIT 1").fetchone()
            subgroup = connection.execute("SELECT id FROM exercise_subgroups WHERE template_id=?", (template["id"],)).fetchone()
            exercise = connection.execute("SELECT name FROM exercise_catalog ORDER BY id LIMIT 1").fetchone()
            other_template = connection.execute("SELECT id FROM workout_templates WHERE id!=? ORDER BY id LIMIT 1", (template["id"],)).fetchone()
            other_subgroup = connection.execute("SELECT id FROM exercise_subgroups WHERE template_id=?", (other_template["id"],)).fetchone()
            connection.execute(
                "INSERT INTO workout_template_exercises(template_id, exercise_name, subgroup_id, sort_order) VALUES (?, ?, ?, ?)",
                (other_template["id"], exercise["name"], other_subgroup["id"], 99),
            )
        first, _ = build_exercise_pack({"all": True}, False)
        second, _ = build_exercise_pack({"all": True}, False)
        first_catalog = self.catalog(first)
        second_catalog = self.catalog(second)
        self.assertEqual(first_catalog, second_catalog)
        self.assertEqual(first_catalog["placements"], second_catalog["placements"])
        self.assertEqual(sum(row["exercise_key"] == "exercise-1" for row in first_catalog["placements"]), 2)
        serialized = json.dumps(first_catalog)
        self.assertNotIn("workout_sets", serialized)
        self.assertNotIn("created_at", serialized)
        self.assertNotIn("record", serialized)

    def test_export_one_subgroup_and_without_images(self) -> None:
        with application.db() as connection:
            subgroup = connection.execute("SELECT id FROM exercise_subgroups ORDER BY id LIMIT 1").fetchone()
            exercise = connection.execute(
                """SELECT ec.id FROM exercise_catalog ec JOIN workout_template_exercises wte
                   ON wte.exercise_name=ec.name WHERE wte.subgroup_id=?""",
                (subgroup["id"],),
            ).fetchone()
            application.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
            (application.UPLOAD_DIR / "photo.png").write_bytes(b"\x89PNG\r\n\x1a\ncontent")
            connection.execute("UPDATE exercise_catalog SET image_path='uploads/photo.png' WHERE id=?", (exercise["id"],))
        content, summary = build_exercise_pack({"subgroup_ids": [subgroup["id"]]}, False)
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            self.assertEqual(archive.namelist(), ["manifest.json", "catalog.json"])
        self.assertEqual(summary["subgroups"], 1)
        self.assertEqual(summary["exercises"], 1)
        self.assertEqual(summary["image_bytes"], 0)

    def test_export_one_leaf_keeps_only_its_selected_placement(self) -> None:
        with application.db() as connection:
            mapping = connection.execute(
                """SELECT wte.subgroup_id, ec.id AS exercise_id
                   FROM workout_template_exercises wte
                   JOIN exercise_catalog ec ON ec.name=wte.exercise_name
                   WHERE wte.subgroup_id IS NOT NULL ORDER BY wte.id LIMIT 1"""
            ).fetchone()
        content, summary = build_exercise_pack(
            {
                "placements": [
                    {
                        "subgroup_id": mapping["subgroup_id"],
                        "exercise_id": mapping["exercise_id"],
                    }
                ]
            },
            False,
        )
        catalog = self.catalog(content)
        self.assertEqual(summary["exercises"], 1)
        self.assertEqual(len(catalog["placements"]), 1)

    def test_conflict_policies_skip_replace_and_copy(self) -> None:
        content, _ = build_exercise_pack({"all": True}, False)
        with application.db() as connection:
            placement = connection.execute(
                "SELECT id, subgroup_id, sort_order FROM workout_template_exercises ORDER BY id LIMIT 1"
            ).fetchone()
            connection.execute(
                "UPDATE workout_template_exercises SET sort_order=777 WHERE id=?",
                (placement["id"],),
            )
        skipped = import_exercise_pack(upload(content), "skip")
        self.assertGreater(skipped["skipped"], 0)
        with application.db() as connection:
            skipped_placement = connection.execute(
                "SELECT subgroup_id, sort_order FROM workout_template_exercises WHERE id=?",
                (placement["id"],),
            ).fetchone()
            exercise = connection.execute("SELECT id, name, note FROM exercise_catalog ORDER BY id LIMIT 1").fetchone()
            connection.execute("UPDATE exercise_catalog SET note='изменено локально' WHERE id=?", (exercise["id"],))
        self.assertEqual(skipped_placement["subgroup_id"], placement["subgroup_id"])
        self.assertEqual(skipped_placement["sort_order"], 777)
        replaced = import_exercise_pack(upload(content), "replace")
        self.assertGreater(replaced["updated"], 0)
        with application.db() as connection:
            restored = connection.execute("SELECT note FROM exercise_catalog WHERE id=?", (exercise["id"],)).fetchone()[0]
        self.assertNotEqual(restored, "изменено локально")
        copied = import_exercise_pack(upload(content), "copy")
        self.assertGreater(copied["created"], 0)
        with application.db() as connection:
            copy_count = connection.execute("SELECT COUNT(*) FROM exercise_catalog WHERE name LIKE '%(копия 2)'").fetchone()[0]
        self.assertGreater(copy_count, 0)

    def test_corrupt_future_and_traversal_packs_do_not_change_database(self) -> None:
        content, _ = build_exercise_pack({"all": True}, False)
        with application.db() as connection:
            before = connection.execute("SELECT COUNT(*) FROM exercise_catalog").fetchone()[0]
        with self.assertRaises(ExercisePackError):
            import_exercise_pack(upload(b"not a zip"), "replace")
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            manifest = json.loads(archive.read("manifest.json"))
        manifest["format_version"] = 999
        future = rewrite_pack(content, {"manifest.json": json.dumps(manifest).encode()})
        with self.assertRaisesRegex(ExercisePackError, "более новой"):
            import_exercise_pack(upload(future), "replace")
        traversal = rewrite_pack(content, {}, {"../escape.png": b"\x89PNG\r\n\x1a\n"})
        with self.assertRaisesRegex(ExercisePackError, "небезопасный путь"):
            import_exercise_pack(upload(traversal), "replace")
        with application.db() as connection:
            after = connection.execute("SELECT COUNT(*) FROM exercise_catalog").fetchone()[0]
        self.assertEqual(after, before)
        self.assertFalse((Path(self.temp_dir.name) / "escape.png").exists())

    def test_export_to_clean_database_recreates_selected_structure(self) -> None:
        content, source_summary = build_exercise_pack({"all": True}, False)
        application.DB_PATH = Path(self.temp_dir.name) / "target.db"
        application.UPLOAD_DIR = Path(self.temp_dir.name) / "target-uploads"
        application.init_db()
        result = import_exercise_pack(upload(content), "skip")
        target_content, target_summary = build_exercise_pack({"all": True}, False)
        self.assertEqual(result["summary"]["placements"], len(self.catalog(content)["placements"]))
        self.assertEqual(source_summary, target_summary)
        self.assertEqual(self.catalog(content), self.catalog(target_content))

    def test_image_extension_must_match_content(self) -> None:
        content, _ = build_exercise_pack({"all": True}, False)
        catalog = self.catalog(content)
        catalog["exercises"][0]["image"] = "images/fake.jpg"
        invalid = rewrite_pack(
            content,
            {"catalog.json": json.dumps(catalog).encode("utf-8")},
            {"images/fake.jpg": b"\x89PNG\r\n\x1a\ncontent"},
        )
        with self.assertRaisesRegex(ExercisePackError, "не соответствует"):
            inspect_exercise_pack(upload(invalid))

    def test_export_never_creates_a_pack_over_the_import_limit(self) -> None:
        with patch("backend.services.exercise_packs.MAX_ARCHIVE_BYTES", 100):
            with self.assertRaisesRegex(ExercisePackError, "не должен превышать"):
                build_exercise_pack({"all": True}, False)

    def test_conflict_names_are_normalized_before_lookup(self) -> None:
        content, _ = build_exercise_pack({"all": True}, False)
        catalog = self.catalog(content)
        catalog["exercises"][0]["name"] = f"  {catalog['exercises'][0]['name']}  "
        normalized = rewrite_pack(
            content,
            {"catalog.json": json.dumps(catalog, ensure_ascii=False).encode("utf-8")},
        )

        result = import_exercise_pack(upload(normalized), "skip")

        self.assertGreater(result["skipped"], 0)


if __name__ == "__main__":
    unittest.main()
