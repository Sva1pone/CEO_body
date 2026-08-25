from backend.database.initialization import initialize_database
from backend.database.migrations.data_backfills import (
    backfill_closed_day_energy,
    backfill_product_per_100_values,
    backfill_workout_set_profiles,
    migrate_exercise_subgroups,
)
from backend.database.migrations.schema_updates import apply_schema_updates
from backend.services import runtime
from backend.services.runtime import db


def init_db() -> None:
    initialize_database(runtime.DATA_DIR, runtime.UPLOAD_DIR, db)
    apply_schema_updates(db)
    backfill_product_per_100_values()
    migrate_exercise_subgroups()
    backfill_workout_set_profiles()
    backfill_closed_day_energy()
