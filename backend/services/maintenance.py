import sqlite3

from backend.database.initialization import initialize_database
from backend.database.migrations.data_backfills import (
    backfill_body_measurements,
    backfill_closed_day_energy,
    backfill_product_per_100_values,
    backfill_workout_set_profiles,
    migrate_exercise_subgroups,
)
from backend.database.migrations.schema_updates import apply_schema_updates
from backend.services import runtime
from backend.services.runtime import db


def init_db() -> None:
    _backup_legacy_measurements()
    initialize_database(runtime.DATA_DIR, runtime.UPLOAD_DIR, db)
    apply_schema_updates(db)
    backfill_body_measurements()
    backfill_product_per_100_values()
    migrate_exercise_subgroups()
    backfill_workout_set_profiles()
    backfill_closed_day_energy()


def _backup_legacy_measurements() -> None:
    if not runtime.DB_PATH.is_file():
        return
    connection = sqlite3.connect(runtime.DB_PATH)
    try:
        has_measurements = connection.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='measurements'"
        ).fetchone()
        if not has_measurements:
            return
        columns = {
            row[1] for row in connection.execute("PRAGMA table_info(measurements)")
        }
        has_marker = connection.execute(
            """SELECT 1 FROM sqlite_master WHERE type='table' AND name='settings'"""
        ).fetchone() and connection.execute(
            "SELECT 1 FROM settings WHERE key='body_measurements_v1'"
        ).fetchone()
        if "record_type" not in columns or not has_marker:
            runtime.create_database_backup("measurement-model-v1")
    finally:
        connection.close()
