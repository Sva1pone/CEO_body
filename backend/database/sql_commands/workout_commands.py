def find_workout_for_cardio(connection, parameters):
    return connection.execute(
        """SELECT w.id, d.closed_at FROM workouts w
               JOIN days d ON d.id=w.day_id WHERE w.id=?""",
        parameters,
    )


def create_cardio_session_record(connection, parameters):
    return connection.execute(
        """INSERT INTO cardio_sessions(workout_id, activity_type, duration_minutes, watch_steps, watch_kcal, note, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
        parameters,
    )


def create_cardio_intervals(connection, parameters):
    return connection.executemany(
        """INSERT INTO cardio_intervals(session_id, start_minute, end_minute, incline_percent, speed_kmh, sort_order)
               VALUES (?, ?, ?, ?, ?, ?)""",
        parameters,
    )


def find_cardio_session(connection, parameters):
    return connection.execute(
        """SELECT cs.workout_id, d.closed_at FROM cardio_sessions cs
               JOIN workouts w ON w.id=cs.workout_id JOIN days d ON d.id=w.day_id WHERE cs.id=?""",
        parameters,
    )


def update_cardio_session_record(connection, parameters):
    return connection.execute(
        """UPDATE cardio_sessions SET activity_type=?, duration_minutes=?, watch_steps=?, watch_kcal=?, note=? WHERE id=?""",
        parameters,
    )


def delete_cardio_intervals(connection, parameters):
    return connection.execute(
        "DELETE FROM cardio_intervals WHERE session_id=?",
        parameters,
    )


def replace_cardio_intervals(connection, parameters):
    return connection.executemany(
        """INSERT INTO cardio_intervals(session_id, start_minute, end_minute, incline_percent, speed_kmh, sort_order)
               VALUES (?, ?, ?, ?, ?, ?)""",
        parameters,
    )


def find_cardio_session_for_deletion(connection, parameters):
    return connection.execute(
        """SELECT cs.workout_id, d.closed_at FROM cardio_sessions cs
               JOIN workouts w ON w.id=cs.workout_id JOIN days d ON d.id=w.day_id WHERE cs.id=?""",
        parameters,
    )


def delete_cardio_session_record(connection, parameters):
    return connection.execute(
        "DELETE FROM cardio_sessions WHERE id=?",
        parameters,
    )


def list_active_exercise_names(connection):
    return connection.execute(
        "SELECT name FROM exercise_catalog WHERE active=1 ORDER BY name COLLATE NOCASE"
    )


def list_active_template_ids(connection):
    return connection.execute("SELECT id FROM workout_templates WHERE active=1")


def create_exercise_record(connection, parameters):
    return connection.execute(
        """INSERT INTO exercise_catalog(name, muscle_group, note, effectiveness_rating, difficulty_rating, muscle_profile, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
        parameters,
    )


def create_template_exercise_mapping(connection, parameters):
    return connection.execute(
        """INSERT OR IGNORE INTO workout_template_exercises(template_id, exercise_name, sort_order)
                   VALUES (?, ?, ?)""",
        parameters,
    )


def assign_exercise_subgroup(connection, parameters):
    return connection.execute(
        """UPDATE workout_template_exercises SET subgroup_id=?
                   WHERE template_id=? AND exercise_name=?""",
        parameters,
    )


def find_active_exercise_for_image(connection, parameters):
    return connection.execute(
        "SELECT id FROM exercise_catalog WHERE id=? AND active=1",
        parameters,
    )


def update_exercise_image_path(connection, parameters):
    return connection.execute(
        "UPDATE exercise_catalog SET image_path=? WHERE id=?",
        parameters,
    )


def find_active_exercise_for_update(connection, parameters):
    return connection.execute(
        "SELECT name FROM exercise_catalog WHERE id=? AND active=1",
        parameters,
    )


def find_duplicate_exercise_name(connection, parameters):
    return connection.execute(
        "SELECT id FROM exercise_catalog WHERE name=? AND id!=?",
        parameters,
    )


def update_exercise_record(connection, parameters):
    return connection.execute(
        """UPDATE exercise_catalog SET name=?, muscle_group=?, note=?, effectiveness_rating=?, difficulty_rating=?, muscle_profile=? WHERE id=?""",
        parameters,
    )


def rename_template_exercise_mappings(connection, parameters):
    return connection.execute(
        "UPDATE workout_template_exercises SET exercise_name=? WHERE exercise_name=?",
        parameters,
    )


def rename_historical_workout_sets(connection, parameters):
    return connection.execute(
        "UPDATE workout_sets SET exercise=? WHERE exercise=?",
        parameters,
    )


def delete_template_exercise_mappings(connection, parameters):
    return connection.execute(
        "DELETE FROM workout_template_exercises WHERE exercise_name=?",
        parameters,
    )


def recreate_template_exercise_mapping(connection, parameters):
    return connection.execute(
        """INSERT INTO workout_template_exercises(
                       template_id, exercise_name, sort_order, subgroup_id
                   ) VALUES (?, ?, ?, ?)""",
        parameters,
    )


def find_active_template(connection, parameters):
    return connection.execute(
        "SELECT id FROM workout_templates WHERE id=? AND active=1",
        parameters,
    )


def find_next_subgroup_sort_order(connection, parameters):
    return connection.execute(
        """SELECT COALESCE(MAX(sort_order), 0) + 10 AS value
               FROM exercise_subgroups WHERE template_id=?""",
        parameters,
    )


def create_exercise_subgroup_record(connection, parameters):
    return connection.execute(
        """INSERT INTO exercise_subgroups(template_id, name, sort_order)
                   VALUES (?, ?, ?)""",
        parameters,
    )


def find_archived_exercise_subgroup(connection, parameters):
    return connection.execute(
        "SELECT id FROM exercise_subgroups WHERE template_id=? AND name=? AND active=0",
        parameters,
    )


def restore_exercise_subgroup_record(connection, parameters):
    return connection.execute(
        "UPDATE exercise_subgroups SET active=1, collapsed=0, sort_order=? WHERE id=?",
        parameters,
    )


def find_active_subgroup_for_update(connection, parameters):
    return connection.execute(
        "SELECT * FROM exercise_subgroups WHERE id=? AND active=1",
        parameters,
    )


def update_exercise_subgroup_record(connection, parameters):
    return connection.execute(
        "UPDATE exercise_subgroups SET name=?, collapsed=? WHERE id=?",
        parameters,
    )


def find_active_subgroup_for_deletion(connection, parameters):
    return connection.execute(
        "SELECT * FROM exercise_subgroups WHERE id=? AND active=1",
        parameters,
    )


def count_subgroup_exercises(connection, parameters):
    return connection.execute(
        """SELECT COUNT(*) AS value
               FROM workout_template_exercises mapping
               JOIN exercise_catalog exercise ON exercise.name=mapping.exercise_name
               WHERE mapping.subgroup_id=? AND exercise.active=1""",
        parameters,
    )


def find_subgroup_transfer_destination(connection, parameters):
    return connection.execute(
        """SELECT id FROM exercise_subgroups
                   WHERE id=? AND template_id=? AND active=1 AND id!=?""",
        parameters,
    )


def list_subgroup_exercise_mappings(connection, parameters):
    return connection.execute(
        """SELECT id FROM workout_template_exercises
                   WHERE subgroup_id=? ORDER BY sort_order, id""",
        parameters,
    )


def move_exercise_mapping_to_subgroup(connection, parameters):
    return connection.execute(
        """UPDATE workout_template_exercises
                       SET subgroup_id=?, sort_order=? WHERE id=?""",
        parameters,
    )


def delete_subgroup_exercise_mappings(connection, parameters):
    return connection.execute(
        "DELETE FROM workout_template_exercises WHERE subgroup_id=?",
        parameters,
    )


def archive_exercise_subgroup_record(connection, parameters):
    return connection.execute(
        "UPDATE exercise_subgroups SET active=0 WHERE id=?",
        parameters,
    )


def find_exercise_name_for_placement(connection, parameters):
    return connection.execute(
        "SELECT name FROM exercise_catalog WHERE id=? AND active=1",
        parameters,
    )


def find_target_exercise_subgroup(connection, parameters):
    return connection.execute(
        "SELECT id, template_id FROM exercise_subgroups WHERE id=? AND active=1",
        parameters,
    )


def find_template_exercise_mapping(connection, parameters):
    return connection.execute(
        """SELECT id FROM workout_template_exercises
               WHERE template_id=? AND exercise_name=?""",
        parameters,
    )


def list_template_exercise_mappings_for_placement(connection, parameters):
    return connection.execute(
        """SELECT id FROM workout_template_exercises
               WHERE subgroup_id=? AND id!=? ORDER BY sort_order, id""",
        parameters,
    )


def place_template_exercise_mapping(connection, parameters):
    return connection.execute(
        """UPDATE workout_template_exercises
                   SET subgroup_id=?, sort_order=? WHERE id=?""",
        parameters,
    )


def find_exercise_name_for_move(connection, parameters):
    return connection.execute(
        "SELECT name FROM exercise_catalog WHERE id=? AND active=1",
        parameters,
    )


def list_subgroup_mappings_for_move(connection, parameters):
    return connection.execute(
        """SELECT id, exercise_name, sort_order FROM workout_template_exercises
               WHERE subgroup_id=? ORDER BY sort_order, id""",
        parameters,
    )


def reserve_mapping_sort_order(connection, parameters):
    return connection.execute(
        "UPDATE workout_template_exercises SET sort_order=? WHERE id=?",
        parameters,
    )


def move_mapping_after_target(connection, parameters):
    return connection.execute(
        "UPDATE workout_template_exercises SET sort_order=? WHERE id=?",
        parameters,
    )


def normalize_mapping_sort_order(connection, parameters):
    return connection.execute(
        "UPDATE workout_template_exercises SET sort_order=? WHERE id=?",
        parameters,
    )


def find_active_exercise_for_archive(connection, parameters):
    return connection.execute(
        "SELECT id, name FROM exercise_catalog WHERE id=? AND active=1",
        parameters,
    )


def archive_exercise_record(connection, parameters):
    return connection.execute(
        "UPDATE exercise_catalog SET active=0 WHERE id=?",
        parameters,
    )


def delete_archived_exercise_mappings(connection, parameters):
    return connection.execute(
        "DELETE FROM workout_template_exercises WHERE exercise_name=?",
        parameters,
    )


def find_day_for_workout_creation(connection, parameters):
    return connection.execute(
        "SELECT * FROM days WHERE id=?",
        parameters,
    )


def find_template_for_workout_creation(connection, parameters):
    return connection.execute(
        "SELECT * FROM workout_templates WHERE id=? AND active=1",
        parameters,
    )


def create_workout_record(connection, parameters):
    return connection.execute(
        """INSERT INTO workouts(day_id, template_id, title, duration_minutes, intensity_met, note, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
        parameters,
    )


def list_template_exercises_for_workout(connection, parameters):
    return connection.execute(
        "SELECT exercise_name FROM workout_template_exercises WHERE template_id=?",
        parameters,
    )


def ensure_workout_exercise_exists(connection, parameters):
    return connection.execute(
        "INSERT OR IGNORE INTO exercise_catalog(name, created_at) VALUES (?, ?)",
        parameters,
    )


def find_workout_for_new_set(connection, parameters):
    return connection.execute(
        """SELECT w.id, d.closed_at FROM workouts w
               JOIN days d ON d.id=w.day_id WHERE w.id=?""",
        parameters,
    )


def find_last_exercise_set_number(connection, parameters):
    return connection.execute(
        """SELECT COALESCE(MAX(set_number), 0) AS last_number
               FROM workout_sets WHERE workout_id=? AND exercise=?""",
        parameters,
    )


def create_workout_set_record(connection, parameters):
    return connection.execute(
        """INSERT INTO workout_sets(
                   workout_id, exercise, set_number, weight, reps, note, is_warmup,
                   exercise_catalog_id, muscle_profile_snapshot
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        parameters,
    )


def find_workout_for_exercise_block(connection, parameters):
    return connection.execute(
        """SELECT w.id, w.template_id, d.closed_at FROM workouts w
               JOIN days d ON d.id=w.day_id WHERE w.id=?""",
        parameters,
    )


def find_allowed_template_exercise(connection, parameters):
    return connection.execute(
        """SELECT 1 FROM workout_template_exercises
                   WHERE template_id=? AND exercise_name=?""",
        parameters,
    )


def find_available_catalog_exercise_for_workout(connection, parameters):
    return connection.execute(
        """SELECT ec.id, ec.name, ec.muscle_profile
           FROM workouts w
           JOIN exercise_catalog ec ON ec.id=? AND ec.active=1
           WHERE w.id=? AND (
               w.template_id IS NULL OR EXISTS (
                   SELECT 1 FROM workout_template_exercises wte
                   WHERE wte.template_id=w.template_id
                     AND wte.exercise_name=ec.name
               )
           )""",
        parameters,
    )


def count_existing_exercise_sets(connection, parameters):
    return connection.execute(
        "SELECT COUNT(*) FROM workout_sets WHERE workout_id=? AND exercise=?",
        parameters,
    )


def create_empty_exercise_sets(connection, parameters):
    return connection.executemany(
        """INSERT INTO workout_sets(
                   workout_id, exercise, set_number, weight, reps, note, is_warmup,
                   exercise_catalog_id, muscle_profile_snapshot
               ) VALUES (?, ?, ?, 0, 0, '', 0, ?, ?)""",
        parameters,
    )


def find_workout_set_for_update(connection, parameters):
    return connection.execute(
        """SELECT ws.workout_id, d.closed_at FROM workout_sets ws
               JOIN workouts w ON w.id=ws.workout_id JOIN days d ON d.id=w.day_id WHERE ws.id=?""",
        parameters,
    )


def update_workout_set_record(connection, parameters):
    return connection.execute(
        "UPDATE workout_sets SET weight=?, reps=?, note=?, is_warmup=? WHERE id=?",
        parameters,
    )


def find_workout_set_for_deletion(connection, parameters):
    return connection.execute(
        """SELECT ws.workout_id, d.closed_at
               FROM workout_sets ws JOIN workouts w ON w.id=ws.workout_id
               JOIN days d ON d.id=w.day_id WHERE ws.id=?""",
        parameters,
    )


def delete_workout_set_record(connection, parameters):
    return connection.execute(
        "DELETE FROM workout_sets WHERE id=?",
        parameters,
    )


def find_workout_for_exercise_deletion(connection, parameters):
    return connection.execute(
        """SELECT w.id, d.closed_at FROM workouts w JOIN days d ON d.id=w.day_id WHERE w.id=?""",
        parameters,
    )


def delete_exercise_workout_sets(connection, parameters):
    return connection.execute(
        "DELETE FROM workout_sets WHERE workout_id=? AND exercise=?",
        parameters,
    )


def delete_exercise_workout_sets_by_catalog_id(connection, parameters):
    return connection.execute(
        "DELETE FROM workout_sets WHERE workout_id=? AND exercise_catalog_id=?",
        parameters,
    )


def find_workout_for_update(connection, parameters):
    return connection.execute(
        """SELECT w.*, d.closed_at FROM workouts w
               JOIN days d ON d.id=w.day_id WHERE w.id=?""",
        parameters,
    )


def update_workout_record(connection, parameters):
    return connection.execute(
        """UPDATE workouts SET title=?, duration_minutes=?, intensity_met=?, note=?
               WHERE id=?""",
        parameters,
    )
