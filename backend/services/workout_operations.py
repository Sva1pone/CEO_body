from __future__ import annotations

import json
import sqlite3
from datetime import datetime

from werkzeug.datastructures import FileStorage

from backend.database.sql_commands import workout_commands
from backend.services.products import delete_uploaded_image, save_product_image
from backend.services.runtime import db
from backend.services.workouts import (
    get_exercise_catalog,
    get_workout_details,
    exercise_snapshot,
    next_exercise_sort_order,
    subgroup_for_template,
    validate_cardio_payload,
    validate_exercise_block_payload,
    validate_exercise_block_deletion,
    validate_exercise_move_payload,
    validate_exercise_name,
    validate_exercise_payload,
    validate_exercise_placement_payload,
    validate_subgroup_payload,
    validate_workout_metadata,
    validate_workout_set_payload,
    get_workout_template_list,
)


class WorkoutResourceNotFoundError(Exception):
    pass


class WorkoutConflictError(Exception):
    pass


def create_cardio_session(workout_id: int, payload: dict) -> dict:
    session, intervals = validate_cardio_payload(payload)

    with db() as connection:
        workout = workout_commands.find_workout_for_cardio(
            connection, (workout_id,)
        ).fetchone()
        if not workout:
            raise WorkoutResourceNotFoundError("Тренировка не найдена.")
        if workout["closed_at"]:
            raise WorkoutConflictError("День закрыт. Открой его для правок.")

        cursor = workout_commands.create_cardio_session_record(
            connection,
            (
                workout_id,
                session["activity_type"],
                session["duration_minutes"],
                session["watch_steps"],
                session["watch_kcal"],
                session["note"],
                datetime.now().isoformat(timespec="seconds"),
            ),
        )
        workout_commands.create_cardio_intervals(
            connection,
            [
                (
                    cursor.lastrowid,
                    row["start_minute"],
                    row["end_minute"],
                    row["incline_percent"],
                    row["speed_kmh"],
                    row["sort_order"],
                )
                for row in intervals
            ],
        )

    return get_workout_details(workout_id)


def update_cardio_session(session_id: int, payload: dict) -> dict:
    session, intervals = validate_cardio_payload(payload)

    with db() as connection:
        existing_session = workout_commands.find_cardio_session(
            connection,
            (session_id,),
        ).fetchone()
        if not existing_session:
            raise WorkoutResourceNotFoundError("Кардио-сессия не найдена.")
        if existing_session["closed_at"]:
            raise WorkoutConflictError("День закрыт. Открой его для правок.")

        workout_commands.update_cardio_session_record(
            connection,
            (
                session["activity_type"],
                session["duration_minutes"],
                session["watch_steps"],
                session["watch_kcal"],
                session["note"],
                session_id,
            ),
        )
        workout_commands.delete_cardio_intervals(connection, (session_id,))
        workout_commands.replace_cardio_intervals(
            connection,
            [
                (
                    session_id,
                    row["start_minute"],
                    row["end_minute"],
                    row["incline_percent"],
                    row["speed_kmh"],
                    row["sort_order"],
                )
                for row in intervals
            ],
        )

    return get_workout_details(existing_session["workout_id"])


def delete_cardio_session(session_id: int) -> dict:
    with db() as connection:
        cardio_session = workout_commands.find_cardio_session_for_deletion(
            connection,
            (session_id,),
        ).fetchone()
        if not cardio_session:
            raise WorkoutResourceNotFoundError("Кардио-сессия не найдена.")
        if cardio_session["closed_at"]:
            raise WorkoutConflictError("День закрыт. Открой его для правок.")

        workout_commands.delete_cardio_session_record(connection, (session_id,))

    return get_workout_details(cardio_session["workout_id"])


def get_workout_templates() -> dict:
    with db() as connection:
        exercises = workout_commands.list_active_exercise_names(connection).fetchall()

    return {
        "templates": get_workout_template_list(),
        "exercises": [row["name"] for row in exercises],
    }


def resolve_exercise_placements(connection, exercise_data: dict) -> dict[int, int]:
    valid_template_ids = {
        row["id"] for row in workout_commands.list_active_template_ids(connection)
    }
    unknown_template_ids = set(exercise_data["template_ids"]) - valid_template_ids
    if unknown_template_ids:
        raise ValueError("Выбери существующий тренировочный день.")
    placements = {}
    subgroup_ids = exercise_data["subgroup_ids"]

    for template_id in exercise_data["template_ids"]:
        if template_id in valid_template_ids:
            placements[template_id] = subgroup_for_template(
                connection,
                template_id,
                subgroup_ids.get(str(template_id), subgroup_ids.get(template_id)),
            )

    if not placements:
        raise ValueError("Выбери существующий тренировочный день и подгруппу.")
    return placements


def create_exercise(payload: dict) -> dict:
    exercise_data = validate_exercise_payload(payload)
    exercise_name = exercise_data["name"]

    with db() as connection:
        placements = resolve_exercise_placements(connection, exercise_data)

        try:
            workout_commands.create_exercise_record(
                connection,
                (
                    exercise_name,
                    exercise_data["muscle_group"] or None,
                    exercise_data["note"],
                    exercise_data["effectiveness"],
                    exercise_data["difficulty"],
                    json.dumps(exercise_data["muscle_profile"], ensure_ascii=False),
                    datetime.now().isoformat(timespec="seconds"),
                ),
            )
        except sqlite3.IntegrityError as error:
            raise WorkoutConflictError(
                "Такое упражнение уже есть в каталоге."
            ) from error

        for template_id, subgroup_id in placements.items():
            workout_commands.create_template_exercise_mapping(
                connection,
                (
                    template_id,
                    exercise_name,
                    next_exercise_sort_order(connection, subgroup_id),
                ),
            )
            workout_commands.assign_exercise_subgroup(
                connection,
                (subgroup_id, template_id, exercise_name),
            )

    return get_exercise_catalog()


def replace_exercise_image(exercise_id: int, image: FileStorage | None) -> dict:
    with db() as connection:
        exercise = workout_commands.find_active_exercise_for_image(
            connection,
            (exercise_id,),
        ).fetchone()
    if not exercise:
        raise WorkoutResourceNotFoundError("Упражнение не найдено.")

    image_path = save_product_image(image)
    if not image_path:
        raise ValueError("Выбери файл изображения.")

    try:
        with db() as connection:
            workout_commands.update_exercise_image_path(
                connection,
                (image_path, exercise_id),
            )
    except Exception:
        delete_uploaded_image(image_path)
        raise

    delete_uploaded_image(exercise["image_path"])

    return get_exercise_catalog()


def update_exercise(exercise_id: int, payload: dict) -> dict:
    exercise_data = validate_exercise_payload(payload)
    exercise_name = exercise_data["name"]

    with db() as connection:
        placements = resolve_exercise_placements(connection, exercise_data)
        existing_exercise = workout_commands.find_active_exercise_for_update(
            connection,
            (exercise_id,),
        ).fetchone()
        if not existing_exercise:
            raise WorkoutResourceNotFoundError("Упражнение не найдено.")

        duplicate = workout_commands.find_duplicate_exercise_name(
            connection,
            (exercise_name, exercise_id),
        ).fetchone()
        if duplicate:
            raise WorkoutConflictError("Упражнение с таким названием уже есть.")

        previous_name = existing_exercise["name"]
        workout_commands.update_exercise_record(
            connection,
            (
                exercise_name,
                exercise_data["muscle_group"] or None,
                exercise_data["note"],
                exercise_data["effectiveness"],
                exercise_data["difficulty"],
                json.dumps(exercise_data["muscle_profile"], ensure_ascii=False),
                exercise_id,
            ),
        )
        if exercise_name != previous_name:
            workout_commands.rename_template_exercise_mappings(
                connection,
                (exercise_name, previous_name),
            )

        workout_commands.delete_template_exercise_mappings(
            connection,
            (exercise_name,),
        )
        for template_id, subgroup_id in placements.items():
            workout_commands.recreate_template_exercise_mapping(
                connection,
                (
                    template_id,
                    exercise_name,
                    next_exercise_sort_order(connection, subgroup_id),
                    subgroup_id,
                ),
            )

    return get_exercise_catalog()


def create_exercise_subgroup(payload: dict) -> dict:
    template_id, subgroup_name, _ = validate_subgroup_payload(
        payload, require_template=True
    )

    with db() as connection:
        template = workout_commands.find_active_template(
            connection,
            (template_id,),
        ).fetchone()
        if not template:
            raise WorkoutResourceNotFoundError("Тренировочный день не найден.")

        sort_order = workout_commands.find_next_subgroup_sort_order(
            connection,
            (template_id,),
        ).fetchone()["value"]
        archived_subgroup = workout_commands.find_archived_exercise_subgroup(
            connection,
            (template_id, subgroup_name),
        ).fetchone()
        if archived_subgroup:
            workout_commands.restore_exercise_subgroup_record(
                connection,
                (sort_order, archived_subgroup["id"]),
            )
        else:
            try:
                workout_commands.create_exercise_subgroup_record(
                    connection,
                    (template_id, subgroup_name, sort_order),
                )
            except sqlite3.IntegrityError as error:
                raise WorkoutConflictError(
                    "Подгруппа с таким названием уже существует."
                ) from error

    return get_exercise_catalog()


def update_exercise_subgroup(subgroup_id: int, payload: dict) -> dict:
    with db() as connection:
        subgroup = workout_commands.find_active_subgroup_for_update(
            connection,
            (subgroup_id,),
        ).fetchone()
        if not subgroup:
            raise WorkoutResourceNotFoundError("Подгруппа не найдена.")

        _, subgroup_name, collapsed = validate_subgroup_payload(
            payload,
            current_name=subgroup["name"],
            current_collapsed=bool(subgroup["collapsed"]),
        )
        try:
            workout_commands.update_exercise_subgroup_record(
                connection,
                (subgroup_name, collapsed, subgroup_id),
            )
        except sqlite3.IntegrityError as error:
            raise WorkoutConflictError(
                "Подгруппа с таким названием уже существует."
            ) from error

    return get_exercise_catalog()


def delete_exercise_subgroup(subgroup_id: int, payload: dict) -> dict:
    with db() as connection:
        subgroup = workout_commands.find_active_subgroup_for_deletion(
            connection,
            (subgroup_id,),
        ).fetchone()
        if not subgroup:
            raise WorkoutResourceNotFoundError("Подгруппа не найдена.")

        exercise_count = workout_commands.count_subgroup_exercises(
            connection,
            (subgroup_id,),
        ).fetchone()["value"]
        if exercise_count:
            destination_id = payload.get("destination_id")
            if not str(destination_id).isdigit():
                raise WorkoutConflictError(
                    "Выбери подгруппу, куда перенести упражнения."
                )

            destination = workout_commands.find_subgroup_transfer_destination(
                connection,
                (int(destination_id), subgroup["template_id"], subgroup_id),
            ).fetchone()
            if not destination:
                raise ValueError("Подгруппа для переноса не найдена.")

            start_order = next_exercise_sort_order(connection, destination["id"])
            moving_exercises = workout_commands.list_subgroup_exercise_mappings(
                connection,
                (subgroup_id,),
            ).fetchall()
            for index, exercise in enumerate(moving_exercises):
                workout_commands.move_exercise_mapping_to_subgroup(
                    connection,
                    (destination["id"], start_order + index * 10, exercise["id"]),
                )
        else:
            workout_commands.delete_subgroup_exercise_mappings(
                connection,
                (subgroup_id,),
            )

        workout_commands.archive_exercise_subgroup_record(
            connection,
            (subgroup_id,),
        )

    return get_exercise_catalog()


def place_exercise(exercise_id: int, payload: dict) -> dict:
    subgroup_id, target_index = validate_exercise_placement_payload(payload)

    with db() as connection:
        exercise = workout_commands.find_exercise_name_for_placement(
            connection,
            (exercise_id,),
        ).fetchone()
        target_subgroup = workout_commands.find_target_exercise_subgroup(
            connection,
            (subgroup_id,),
        ).fetchone()
        if not exercise or not target_subgroup:
            raise WorkoutResourceNotFoundError("Упражнение или подгруппа не найдены.")

        mapping = workout_commands.find_template_exercise_mapping(
            connection,
            (target_subgroup["template_id"], exercise["name"]),
        ).fetchone()
        if not mapping:
            raise ValueError("Упражнение недоступно в этом тренировочном дне.")

        ordered_mappings = (
            workout_commands.list_template_exercise_mappings_for_placement(
                connection,
                (target_subgroup["id"], mapping["id"]),
            ).fetchall()
        )
        target_index = min(target_index, len(ordered_mappings))
        ordered_ids = [row["id"] for row in ordered_mappings]
        ordered_ids.insert(target_index, mapping["id"])

        for index, mapping_id in enumerate(ordered_ids, start=1):
            workout_commands.place_template_exercise_mapping(
                connection,
                (target_subgroup["id"], index * 10, mapping_id),
            )

    return get_exercise_catalog()


def move_exercise(exercise_id: int, payload: dict) -> dict:
    subgroup_id, direction = validate_exercise_move_payload(payload)

    with db() as connection:
        exercise = workout_commands.find_exercise_name_for_move(
            connection,
            (exercise_id,),
        ).fetchone()
        if not exercise:
            raise WorkoutResourceNotFoundError("Упражнение не найдено.")

        mappings = workout_commands.list_subgroup_mappings_for_move(
            connection,
            (subgroup_id,),
        ).fetchall()
        current_index = next(
            (
                index
                for index, mapping in enumerate(mappings)
                if mapping["exercise_name"] == exercise["name"]
            ),
            None,
        )
        if current_index is None:
            raise WorkoutResourceNotFoundError(
                "Упражнение не найдено в выбранной подгруппе."
            )

        target_index = current_index - 1 if direction == "up" else current_index + 1
        if 0 <= target_index < len(mappings):
            current_mapping = mappings[current_index]
            target_mapping = mappings[target_index]
            current_order = current_mapping["sort_order"]
            target_order = target_mapping["sort_order"]

            if current_order == target_order:
                for index, mapping in enumerate(mappings, start=1):
                    workout_commands.reserve_mapping_sort_order(
                        connection,
                        (index * 10, mapping["id"]),
                    )
                current_order = current_index * 10 + 10
                target_order = target_index * 10 + 10

            workout_commands.move_mapping_after_target(
                connection,
                (target_order, current_mapping["id"]),
            )
            workout_commands.normalize_mapping_sort_order(
                connection,
                (current_order, target_mapping["id"]),
            )

    return get_exercise_catalog()


def archive_exercise(exercise_id: int) -> dict:
    with db() as connection:
        exercise = workout_commands.find_active_exercise_for_archive(
            connection,
            (exercise_id,),
        ).fetchone()
        if not exercise:
            raise WorkoutResourceNotFoundError("Упражнение не найдено.")

        workout_commands.archive_exercise_record(connection, (exercise_id,))
        workout_commands.delete_archived_exercise_mappings(
            connection,
            (exercise["name"],),
        )

    return {"archived": True, "id": exercise_id, "name": exercise["name"]}


def create_workout(day_id: int, payload: dict) -> dict:
    template_id = payload.get("template_id")

    with db() as connection:
        day = workout_commands.find_day_for_workout_creation(
            connection, (day_id,)
        ).fetchone()
        if not day:
            raise WorkoutResourceNotFoundError("День не найден.")
        if day["closed_at"]:
            raise WorkoutConflictError("День закрыт. Открой его для правок.")

        template = None
        if template_id:
            template = workout_commands.find_template_for_workout_creation(
                connection,
                (template_id,),
            ).fetchone()
            if not template:
                raise WorkoutResourceNotFoundError("Шаблон тренировки не найден.")

        defaults = {
            "title": (template["name"] if template else day["day_type"])
            or "Тренировка",
            "duration_minutes": (
                template["default_duration_minutes"] if template else 75
            ),
            "intensity_met": template["default_intensity_met"] if template else 3.5,
            "note": "",
        }
        workout_data = validate_workout_metadata(payload, defaults)
        created_at = datetime.now().isoformat(timespec="seconds")
        cursor = workout_commands.create_workout_record(
            connection,
            (
                day_id,
                template["id"] if template else None,
                workout_data["title"],
                workout_data["duration"],
                workout_data["intensity"],
                workout_data["note"],
                created_at,
            ),
        )

    return {"workout": get_workout_details(cursor.lastrowid)["workout"]}


def add_workout_set(workout_id: int, payload: dict) -> dict:
    set_data = validate_workout_set_payload(payload)
    exercise_name = set_data["exercise"]

    with db() as connection:
        workout = workout_commands.find_workout_for_new_set(
            connection,
            (workout_id,),
        ).fetchone()
        if not workout:
            raise WorkoutResourceNotFoundError("Тренировка не найдена.")
        if workout["closed_at"]:
            raise WorkoutConflictError("День закрыт. Открой его для правок.")

        catalog_id, profile_snapshot = exercise_snapshot(connection, exercise_name)
        if catalog_id is None:
            raise WorkoutResourceNotFoundError("Упражнение не найдено в каталоге.")
        previous_set = workout_commands.find_last_exercise_set_number(
            connection,
            (workout_id, exercise_name),
        ).fetchone()
        workout_commands.create_workout_set_record(
            connection,
            (
                workout_id,
                exercise_name,
                previous_set["last_number"] + 1,
                set_data["weight"],
                set_data["repetitions"],
                set_data["note"],
                1 if set_data["is_warmup"] else 0,
                catalog_id,
                profile_snapshot,
            ),
        )

    return get_workout_details(workout_id)


def add_exercise_block(workout_id: int, payload: dict) -> dict:
    exercise_id, exercise_name, set_count = validate_exercise_block_payload(payload)

    with db() as connection:
        workout = workout_commands.find_workout_for_exercise_block(
            connection,
            (workout_id,),
        ).fetchone()
        if not workout:
            raise WorkoutResourceNotFoundError("Тренировка не найдена.")
        if workout["closed_at"]:
            raise WorkoutConflictError("День закрыт. Открой его для правок.")

        catalog_id = None
        profile_snapshot = json.dumps(
            {"primary": [], "secondary": []}, ensure_ascii=False
        )

        if exercise_id is not None:
            catalog_exercise = (
                workout_commands.find_available_catalog_exercise_for_workout(
                    connection,
                    (exercise_id, workout_id),
                ).fetchone()
            )
            if not catalog_exercise:
                raise ValueError(
                    "Это упражнение не привязано к выбранному тренировочному дню."
                )
            exercise_name = catalog_exercise["name"]
            catalog_id = catalog_exercise["id"]
            profile_snapshot = catalog_exercise["muscle_profile"] or profile_snapshot
        elif workout["template_id"]:
            allowed_exercise = workout_commands.find_allowed_template_exercise(
                connection,
                (workout["template_id"], exercise_name),
            ).fetchone()
            if not allowed_exercise:
                raise ValueError(
                    "Это упражнение не привязано к выбранному тренировочному дню."
                )

        existing_set_count = workout_commands.count_existing_exercise_sets(
            connection,
            (workout_id, exercise_name),
        ).fetchone()[0]
        if existing_set_count:
            raise WorkoutConflictError("Это упражнение уже добавлено в тренировку.")

        if catalog_id is None:
            catalog_id, profile_snapshot = exercise_snapshot(connection, exercise_name)
        workout_commands.create_empty_exercise_sets(
            connection,
            [
                (workout_id, exercise_name, number, catalog_id, profile_snapshot)
                for number in range(1, set_count + 1)
            ],
        )

    return get_workout_details(workout_id)


def update_workout_set(set_id: int, payload: dict) -> dict:
    set_data = validate_workout_set_payload(payload, require_exercise=False)

    with db() as connection:
        workout_set = workout_commands.find_workout_set_for_update(
            connection,
            (set_id,),
        ).fetchone()
        if not workout_set:
            raise WorkoutResourceNotFoundError("Подход не найден.")
        if workout_set["closed_at"]:
            raise WorkoutConflictError("День закрыт. Открой его для правок.")

        workout_commands.update_workout_set_record(
            connection,
            (
                set_data["weight"],
                set_data["repetitions"],
                set_data["note"],
                1 if set_data["is_warmup"] else 0,
                set_id,
            ),
        )

    return get_workout_details(workout_set["workout_id"])


def delete_workout_set(set_id: int) -> dict:
    with db() as connection:
        workout_set = workout_commands.find_workout_set_for_deletion(
            connection,
            (set_id,),
        ).fetchone()
        if not workout_set:
            raise WorkoutResourceNotFoundError("Подход не найден.")
        if workout_set["closed_at"]:
            raise WorkoutConflictError("День закрыт. Открой его для правок.")

        workout_commands.delete_workout_set_record(connection, (set_id,))

    return get_workout_details(workout_set["workout_id"])


def delete_exercise_block(workout_id: int, payload: dict) -> dict:
    exercise_catalog_id, exercise_name = validate_exercise_block_deletion(payload)

    with db() as connection:
        workout = workout_commands.find_workout_for_exercise_deletion(
            connection,
            (workout_id,),
        ).fetchone()
        if not workout:
            raise WorkoutResourceNotFoundError("Тренировка не найдена.")
        if workout["closed_at"]:
            raise WorkoutConflictError("День закрыт. Открой его для правок.")

        if exercise_catalog_id is not None:
            workout_commands.delete_exercise_workout_sets_by_catalog_id(
                connection,
                (workout_id, exercise_catalog_id),
            )
        else:
            workout_commands.delete_exercise_workout_sets(
                connection,
                (workout_id, exercise_name),
            )

    return get_workout_details(workout_id)


def update_workout(workout_id: int, payload: dict) -> dict:
    with db() as connection:
        workout = workout_commands.find_workout_for_update(
            connection,
            (workout_id,),
        ).fetchone()
        if not workout:
            raise WorkoutResourceNotFoundError("Тренировка не найдена.")
        if workout["closed_at"]:
            raise WorkoutConflictError("День закрыт. Открой его для правок.")

        workout_data = validate_workout_metadata(payload, workout)
        workout_commands.update_workout_record(
            connection,
            (
                workout_data["title"],
                workout_data["duration"],
                workout_data["intensity"],
                workout_data["note"],
                workout_id,
            ),
        )

    return get_workout_details(workout_id)
