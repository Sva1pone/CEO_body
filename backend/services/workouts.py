from __future__ import annotations

import json
import sqlite3

from backend.database.sql_commands.workouts import WorkoutRepository
from backend.services.days import latest_weight, workout_session_kcal
from backend.services.runtime import db, parse_integer, parse_number


class WorkoutNotFoundError(Exception):
    pass


def validate_exercise_payload(payload: dict) -> dict:
    name = (payload.get("name") or "").strip()
    raw_template_ids = payload.get("template_ids", [])
    if not isinstance(raw_template_ids, list):
        raise ValueError("Тренировочные дни должны быть списком.")
    template_ids = [parse_integer(value, "тренировочный день") for value in raw_template_ids]
    if len(set(template_ids)) != len(template_ids):
        raise ValueError("Тренировочные дни не должны повторяться.")
    if not name or not template_ids:
        raise ValueError("Укажи название и хотя бы один тренировочный день.")
    effectiveness = parse_integer(payload.get("effectiveness_rating", 3), "эффективность")
    difficulty = parse_integer(payload.get("difficulty_rating", 3), "сложность")
    if not 1 <= effectiveness <= 5 or not 1 <= difficulty <= 5:
        raise ValueError("Эффективность и сложность должны быть от 1 до 5.")

    subgroup_ids = payload.get("subgroup_ids", {})
    if subgroup_ids is None:
        subgroup_ids = {}
    if not isinstance(subgroup_ids, dict):
        raise ValueError("Привязки подгрупп должны быть объектом.")
    muscle_profile = {
        "primary": normalize_muscle_list(payload.get("primary_muscles", []), "основные мышцы"),
        "secondary": normalize_muscle_list(payload.get("secondary_muscles", []), "вторичные мышцы"),
    }

    return {
        "name": name,
        "muscle_group": (payload.get("muscle_group") or "").strip(),
        "template_ids": template_ids,
        "subgroup_ids": subgroup_ids,
        "effectiveness": effectiveness,
        "difficulty": difficulty,
        "muscle_profile": muscle_profile,
        "note": (payload.get("note") or "").strip(),
    }


def normalize_muscle_list(value: object, field_name: str) -> list[str]:
    if not isinstance(value, list):
        raise ValueError(f"{field_name.capitalize()} должны быть списком.")
    muscles = []
    for item in value:
        if not isinstance(item, str) or not item.strip():
            raise ValueError(f"Проверь {field_name}.")
        muscle = item.strip()
        if muscle not in muscles:
            muscles.append(muscle)
    return muscles


def validate_workout_set_payload(payload: dict, require_exercise: bool = True) -> dict:
    exercise = (payload.get("exercise") or "").strip()
    allow_empty_set = bool(payload.get("blank"))
    weight = parse_number(payload.get("weight", 0), "вес")
    repetitions = parse_number(payload.get("reps", 0), "повторы")

    if require_exercise and not exercise:
        raise ValueError("Укажи упражнение.")
    if (
        weight < 0
        or repetitions < 0
        or (not allow_empty_set and repetitions <= 0)
        or not repetitions.is_integer()
    ):
        raise ValueError(
            "Вес не может быть отрицательным, а повторы должны быть целым числом."
        )
    if repetitions > 1000 or weight > 2000:
        raise ValueError("Проверь вес и количество повторов.")

    return {
        "exercise": exercise,
        "weight": weight,
        "repetitions": int(repetitions),
        "note": (payload.get("note") or "").strip(),
        "is_warmup": bool(payload.get("is_warmup")),
    }


def validate_exercise_block_payload(payload: dict) -> tuple[int | None, str, int]:
    raw_exercise_id = payload.get("exercise_id")
    exercise_id = None
    if raw_exercise_id not in (None, ""):
        try:
            exercise_id = int(raw_exercise_id)
        except (TypeError, ValueError):
            raise ValueError("Выбери упражнение из каталога.")
        if exercise_id <= 0:
            raise ValueError("Выбери упражнение из каталога.")

    exercise = (payload.get("exercise") or "").strip()
    set_count = parse_integer(payload.get("set_count"), "количество подходов")
    if (exercise_id is None and not exercise) or not 1 <= set_count <= 12:
        raise ValueError("Выбери упражнение и укажи от 1 до 12 подходов.")
    return exercise_id, exercise, set_count


def validate_subgroup_payload(
    payload: dict,
    current_name: str = "",
    current_collapsed: bool = False,
    require_template: bool = False,
) -> tuple[int | None, str, int]:
    template_id = payload.get("template_id")
    name = (payload.get("name") or current_name).strip()
    if not name:
        raise ValueError("Название подгруппы не может быть пустым.")
    if require_template and template_id is None:
        raise ValueError("Укажи тренировочный день и название подгруппы.")
    if template_id is not None:
        try:
            template_id = int(template_id)
        except (TypeError, ValueError) as error:
            raise ValueError("Укажи корректный тренировочный день.") from error
    collapsed = 1 if payload.get("collapsed", current_collapsed) else 0
    return template_id, name, collapsed


def validate_exercise_placement_payload(payload: dict) -> tuple[int, int]:
    subgroup_id = payload.get("subgroup_id")
    if subgroup_id is None:
        raise ValueError("Выбери подгруппу назначения.")
    try:
        return parse_integer(subgroup_id, "подгруппу"), max(0, parse_integer(payload.get("target_index", 0), "позицию"))
    except (TypeError, ValueError) as error:
        raise ValueError("Некорректная позиция упражнения.") from error


def validate_exercise_move_payload(payload: dict) -> tuple[int, str]:
    subgroup_id = payload.get("subgroup_id")
    direction = payload.get("direction")
    if subgroup_id is None or direction not in {"up", "down"}:
        raise ValueError("Укажи подгруппу и направление перемещения.")
    try:
        return int(subgroup_id), str(direction)
    except (TypeError, ValueError) as error:
        raise ValueError("Укажи корректную подгруппу.") from error


def validate_exercise_name(payload: dict) -> str:
    exercise = (payload.get("exercise") or "").strip()
    if not exercise:
        raise ValueError("Не указано упражнение.")
    return exercise


def validate_exercise_block_deletion(payload: dict) -> tuple[int | None, str]:
    exercise = (payload.get("exercise") or "").strip()
    raw_catalog_id = payload.get("exercise_catalog_id")

    if raw_catalog_id in (None, ""):
        if not exercise:
            raise ValueError("Не указано упражнение.")
        return None, exercise

    catalog_id = parse_integer(raw_catalog_id, "упражнение")
    if catalog_id <= 0:
        raise ValueError("Укажи корректное упражнение.")
    return catalog_id, exercise


def validate_workout_metadata(
    payload: dict, current: dict | sqlite3.Row | None = None
) -> dict:
    current = dict(current) if current is not None else {}
    title = (payload.get("title", current.get("title", "")) or "").strip()
    duration = parse_number(payload.get("duration_minutes", current.get("duration_minutes", 75)), "длительность")
    intensity = parse_number(payload.get("intensity_met", current.get("intensity_met", 3.5)), "интенсивность MET")

    if not title:
        raise ValueError("Название тренировки не может быть пустым.")
    if not 0 < duration <= 1440:
        raise ValueError("Длительность должна быть от 1 до 1440 минут.")
    if not 1 <= intensity <= 15:
        raise ValueError("Интенсивность MET должна быть от 1 до 15.")

    return {
        "title": title,
        "duration": duration,
        "intensity": intensity,
        "note": (payload.get("note", current.get("note", "")) or "").strip(),
    }


def exercise_snapshot(
    connection: sqlite3.Connection, exercise: str
) -> tuple[int | None, str]:
    """Return a stable muscle-profile snapshot for a newly created set."""
    row = WorkoutRepository(connection).find_exercise_snapshot(exercise)
    if not row:
        return None, json.dumps({"primary": [], "secondary": []}, ensure_ascii=False)
    return row["id"], row["muscle_profile"] or json.dumps(
        {"primary": [], "secondary": []}, ensure_ascii=False
    )


def get_workout_template_list() -> list[dict]:
    with db() as connection:
        workouts = WorkoutRepository(connection)
        templates = workouts.list_templates()
        exercises = workouts.list_template_exercises()
    by_template: dict[int, list[str]] = {}
    for row in exercises:
        by_template.setdefault(row["template_id"], []).append(row["exercise_name"])
    return [
        {**dict(row), "exercises": by_template.get(row["id"], [])} for row in templates
    ]


def cardio_interval_kcal(interval: sqlite3.Row | dict, weight: float) -> float:
    """Informational ACSM treadmill estimate; never added to TDEE automatically."""
    duration = max(0.0, float(interval["end_minute"]) - float(interval["start_minute"]))
    speed_kmh = max(0.0, float(interval["speed_kmh"]))
    grade = max(0.0, float(interval["incline_percent"])) / 100.0
    speed_m_min = speed_kmh * 1000.0 / 60.0
    if speed_kmh >= 8.0:
        vo2 = 0.2 * speed_m_min + 0.9 * speed_m_min * grade + 3.5
    else:
        vo2 = 0.1 * speed_m_min + 1.8 * speed_m_min * grade + 3.5
    return max(0.0, (vo2 - 3.5) * weight / 200.0 * duration)


def serialize_cardio_sessions(
    connection: sqlite3.Connection,
    workout_id: int,
    weight: float,
) -> list[dict]:
    workouts = WorkoutRepository(connection)
    sessions = workouts.list_cardio_sessions(workout_id)
    result = []
    for session in sessions:
        intervals = workouts.list_cardio_intervals(session["id"])
        item = dict(session)
        item["intervals"] = [dict(row) for row in intervals]
        item["estimated_kcal"] = round(
            sum(cardio_interval_kcal(row, weight) for row in intervals), 1
        )
        item["included_in_tdee"] = False
        result.append(item)
    return result


def validate_cardio_payload(payload: dict) -> tuple[dict, list[dict]]:
    duration = parse_number(payload.get("duration_minutes"), "длительность кардио")
    if duration <= 0 or duration > 360:
        raise ValueError("Длительность кардио должна быть от 1 до 360 минут.")
    intervals = payload.get("intervals") or []
    if not isinstance(intervals, list) or not 1 <= len(intervals) <= 6:
        raise ValueError("Раздели кардио на 1–6 интервалов.")
    normalized = []
    previous_end = 0.0
    for index, raw in enumerate(intervals, start=1):
        if not isinstance(raw, dict):
            raise ValueError("Проверь интервалы кардио.")
        start = parse_number(raw.get("start_minute", previous_end), "начало интервала")
        end = parse_number(raw.get("end_minute"), "конец интервала")
        incline = parse_number(raw.get("incline_percent", 0), "наклон")
        speed = parse_number(raw.get("speed_kmh", 0), "скорость")
        if abs(start - previous_end) > 0.05 or end <= start or end > duration + 0.05:
            raise ValueError("Интервалы должны идти подряд без разрывов и перекрытий.")
        if not 0 <= incline <= 30 or not 0 <= speed <= 30:
            raise ValueError("Проверь наклон (0–30%) и скорость (0–30 км/ч).")
        normalized.append(
            {
                "start_minute": round(start, 2),
                "end_minute": round(end, 2),
                "incline_percent": round(incline, 1),
                "speed_kmh": round(speed, 1),
                "sort_order": index,
            }
        )
        previous_end = end
    if abs(previous_end - duration) > 0.05:
        raise ValueError("Последний интервал должен заканчиваться в конце кардио.")
    watch_steps = payload.get("watch_steps")
    watch_kcal = payload.get("watch_kcal")
    watch_steps = parse_integer(watch_steps, "шаги с часов", optional=True)
    watch_kcal = parse_number(watch_kcal, "калории с часов", optional=True)
    if watch_steps is not None:
        watch_steps = max(0, watch_steps)
    if watch_kcal is not None:
        watch_kcal = max(0.0, watch_kcal)
    session = {
        "activity_type": (payload.get("activity_type") or "Беговая дорожка").strip(),
        "duration_minutes": duration,
        "watch_steps": watch_steps,
        "watch_kcal": watch_kcal,
        "note": (payload.get("note") or "").strip(),
    }
    return session, normalized


def get_workout_details(workout_id: int) -> dict:
    with db() as connection:
        workouts = WorkoutRepository(connection)
        workout = workouts.find_with_day(workout_id)
        if not workout:
            raise WorkoutNotFoundError("Тренировка не найдена.")
        sets = workouts.list_sets(workout_id)
        previous_rows = workouts.list_previous_records(workout_id)
        previous_reps_rows = workouts.list_previous_repetition_records(workout_id)
        exercise_rows = workouts.list_active_exercise_metadata()
        available_exercise_rows = workouts.list_available_exercises(
            workout["template_id"]
        )
    weight = (
        workout["day_closed_weight"]
        if workout["day_closed_at"] and workout["day_closed_weight"] is not None
        else latest_weight()
    )
    with db() as cardio_connection:
        cardio = serialize_cardio_sessions(cardio_connection, workout_id, weight or 0)
    workout_data = dict(workout)
    workout_data.pop("day_closed_weight", None)
    set_payloads = []
    for row in sets:
        item = dict(row)
        item["estimated_1rm"] = round(row["weight"] * (1 + row["reps"] / 30.0), 1)
        set_payloads.append(item)
    previous = {
        row["exercise"]: {**dict(row), "reps_by_weight": []} for row in previous_rows
    }
    for row in previous_reps_rows:
        previous.setdefault(
            row["exercise"],
            {"best_weight": None, "best_1rm": None, "reps_by_weight": []},
        )["reps_by_weight"].append(
            {"weight": row["weight"], "best_reps": row["best_reps"]}
        )
    exercise_meta = {}
    for row in exercise_rows:
        try:
            muscle_profile = json.loads(row["muscle_profile"] or "{}")
        except json.JSONDecodeError:
            muscle_profile = {}
        exercise_meta[row["name"]] = {
            "id": row["id"],
            "muscle_group": row["muscle_group"],
            "note": row["note"],
            "image_url": f"/static/{row['image_path']}" if row["image_path"] else None,
            "effectiveness_rating": row["effectiveness_rating"] or 3,
            "difficulty_rating": row["difficulty_rating"] or 3,
            "muscle_profile": muscle_profile,
        }
    return {
        "workout": workout_data,
        "sets": set_payloads,
        "previous": previous,
        "exercises": [row["name"] for row in exercise_rows],
        "available_exercises": [dict(row) for row in available_exercise_rows],
        "exercise_meta": exercise_meta,
        "templates": get_workout_template_list(),
        "cardio": cardio,
        "estimated_kcal": round(workout_session_kcal(workout, weight or 0), 1),
        "weight": round(weight, 1) if weight is not None else None,
    }


def get_exercise_catalog() -> dict:
    """Configurable exercise registry; existing workout sets stay immutable history."""
    with db() as connection:
        workouts = WorkoutRepository(connection)
        exercises = workouts.list_catalog()
        mappings = workouts.list_mappings()
        subgroups = workouts.list_subgroups()
    template_ids_by_name: dict[str, list[int]] = {}
    placements_by_name: dict[str, list[dict]] = {}
    for row in mappings:
        template_ids_by_name.setdefault(row["exercise_name"], []).append(
            row["template_id"]
        )
        placements_by_name.setdefault(row["exercise_name"], []).append(
            {
                "template_id": row["template_id"],
                "subgroup_id": row["subgroup_id"],
                "sort_order": row["sort_order"],
            }
        )
    payload = []
    for row in exercises:
        item = dict(row)
        try:
            item["muscle_profile"] = json.loads(item["muscle_profile"] or "{}")
        except json.JSONDecodeError:
            item["muscle_profile"] = {}
        item["template_ids"] = template_ids_by_name.get(row["name"], [])
        item["placements"] = placements_by_name.get(row["name"], [])
        item["image_url"] = (
            f"/static/{row['image_path']}" if row["image_path"] else None
        )
        payload.append(item)
    return {
        "templates": get_workout_template_list(),
        "subgroups": [dict(row) for row in subgroups],
        "exercises": payload,
    }


def subgroup_for_template(
    connection: sqlite3.Connection, template_id: int, requested_id: object = None
) -> int:
    if requested_id is not None and str(requested_id).isdigit():
        requested = WorkoutRepository(connection).find_subgroup(
            template_id, int(requested_id)
        )
        if requested:
            return requested["id"]
    fallback = WorkoutRepository(connection).find_first_subgroup(template_id)
    if not fallback:
        raise ValueError("Сначала создай подгруппу для выбранного тренировочного дня.")
    return fallback["id"]


def next_exercise_sort_order(connection: sqlite3.Connection, subgroup_id: int) -> int:
    return WorkoutRepository(connection).next_exercise_sort_order(subgroup_id)
