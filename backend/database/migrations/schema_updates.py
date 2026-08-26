MISSING_COLUMNS = {
    "measurements": {
        "record_type": "TEXT NOT NULL DEFAULT 'mixed' CHECK(record_type IN ('weight', 'tape', 'mixed'))",
    },
    "food_entries": {
        "meal_type": "TEXT NOT NULL DEFAULT 'Завтрак'",
        "request_token": "TEXT",
    },
    "days": {
        "setup_done": "INTEGER NOT NULL DEFAULT 0",
        "current_meal": "TEXT NOT NULL DEFAULT 'Завтрак'",
        "training_planned": "INTEGER",
        "closed_weight": "REAL",
        "closed_steps_kcal": "REAL",
        "closed_workout_kcal": "REAL",
        "closed_tdee": "REAL",
        "sleep_start": "TEXT",
        "sleep_end": "TEXT",
        "sleep_deep_percent": "REAL",
        "sleep_rem_percent": "REAL",
        "watch_active_kcal": "REAL",
        "protein_min": "REAL",
        "protein_max": "REAL",
        "strategy_version_id": "INTEGER REFERENCES strategy_versions(id)",
    },
    "products": {
        "benefit_tag": "TEXT",
        "benefit_color": "TEXT",
        "package_units": "REAL",
        "kcal_100": "REAL",
        "protein_100": "REAL",
        "fat_100": "REAL",
        "carbs_100": "REAL",
        "subcategory_id": "INTEGER REFERENCES product_subcategories(id)",
        "image_position_x": "REAL NOT NULL DEFAULT 50",
        "image_position_y": "REAL NOT NULL DEFAULT 50",
        "image_scale": "REAL NOT NULL DEFAULT 1",
    },
    "workouts": {
        "template_id": "INTEGER REFERENCES workout_templates(id)",
    },
    "exercise_catalog": {
        "muscle_group": "TEXT",
        "note": "TEXT",
        "image_path": "TEXT",
        "effectiveness_rating": "INTEGER NOT NULL DEFAULT 3",
        "difficulty_rating": "INTEGER NOT NULL DEFAULT 3",
        "muscle_profile": "TEXT",
    },
    "workout_template_exercises": {
        "subgroup_id": "INTEGER REFERENCES exercise_subgroups(id)",
    },
    "workout_sets": {
        "is_warmup": "INTEGER NOT NULL DEFAULT 0",
        "exercise_catalog_id": "INTEGER REFERENCES exercise_catalog(id)",
        "muscle_profile_snapshot": "TEXT",
    },
}


def apply_schema_updates(connect) -> None:
    with connect() as connection:
        for table, columns in MISSING_COLUMNS.items():
            existing_columns = {
                row["name"] for row in connection.execute(f"PRAGMA table_info({table})")
            }
            for column, definition in columns.items():
                if column not in existing_columns:
                    connection.execute(
                        f"ALTER TABLE {table} ADD COLUMN {column} {definition}"
                    )

        connection.execute(
            """CREATE UNIQUE INDEX IF NOT EXISTS idx_food_entries_request_token
               ON food_entries(request_token)
               WHERE request_token IS NOT NULL"""
        )
        connection.execute(
            """CREATE INDEX IF NOT EXISTS idx_body_measurement_fields_active_order
               ON body_measurement_fields(active, sort_order, id)"""
        )
        connection.execute(
            """CREATE INDEX IF NOT EXISTS idx_body_measurement_values_field
               ON body_measurement_values(field_id, measurement_id)"""
        )
        _normalize_workout_set_numbers(connection)
        connection.execute(
            """CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_sets_exercise_number
               ON workout_sets(workout_id, exercise, set_number)"""
        )


def _normalize_workout_set_numbers(connection) -> None:
    rows = connection.execute(
        """SELECT id, workout_id, exercise
           FROM workout_sets
           ORDER BY workout_id, exercise, set_number, id"""
    ).fetchall()
    current_group = None
    set_number = 0
    for row in rows:
        group = (row["workout_id"], row["exercise"])
        if group != current_group:
            current_group = group
            set_number = 0
        set_number += 1
        connection.execute(
            "UPDATE workout_sets SET set_number=? WHERE id=?",
            (set_number, row["id"]),
        )
