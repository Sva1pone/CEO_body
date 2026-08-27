from __future__ import annotations

import json
import sqlite3
from datetime import date, timedelta

from backend.database.sql_commands.analytics import AnalyticsRepository
from backend.services.days import (
    day_summary,
    global_balance,
    setting_number,
    settings,
    workout_session_kcal,
)
from backend.services.runtime import db, serialize_sleep
from backend.services.body_measurements import (
    get_body_measurement_fields,
    get_measurements,
    save_legacy_measurement,
    serialize_measurement,
)
from backend.services.strategy import validate_date_range
from backend.services.workouts import cardio_interval_kcal


KCAL_PER_KG_ENERGY_EQUIVALENT = 7500
MINIMUM_WEIGHT_TREND_DAYS = 14
WEIGHT_TREND_TOLERANCE_KG = 0.6


def group_food_entries_by_day(food_entries) -> dict[int, list[dict]]:
    food_entries_by_day: dict[int, list[dict]] = {}
    for row in food_entries:
        entry = dict(row)
        entry["image_url"] = (
            f"/static/{row['image_path']}" if row["image_path"] else None
        )
        entry["category_icon"] = row["category_icon"] or "utensils"
        entry["category_color"] = row["category_color"] or "#6d5dfc"
        food_entries_by_day.setdefault(row["day_id"], []).append(entry)

    return food_entries_by_day


def group_workouts_by_day(
    workouts, workout_sets, cardio_sessions, cardio_intervals
) -> dict[int, list[dict]]:
    workout_sets_by_workout: dict[int, list[dict]] = {}
    for row in workout_sets:
        workout_sets_by_workout.setdefault(row["workout_id"], []).append(dict(row))

    cardio_intervals_by_session: dict[int, list[dict]] = {}
    for row in cardio_intervals:
        cardio_intervals_by_session.setdefault(row["session_id"], []).append(dict(row))

    cardio_by_workout: dict[int, list[dict]] = {}
    for row in cardio_sessions:
        cardio = dict(row)
        cardio["intervals"] = cardio_intervals_by_session.get(row["id"], [])
        cardio["included_in_tdee"] = False
        cardio_by_workout.setdefault(row["workout_id"], []).append(cardio)

    workouts_by_day: dict[int, list[dict]] = {}
    for row in workouts:
        workout = dict(row)
        workout["sets"] = workout_sets_by_workout.get(row["id"], [])
        workout["cardio"] = cardio_by_workout.get(row["id"], [])
        workouts_by_day.setdefault(row["day_id"], []).append(workout)

    return workouts_by_day


def build_report_days(
    days, food_entries_by_day, workouts_by_day, connection: sqlite3.Connection
) -> tuple[list[dict], list[tuple[sqlite3.Row, dict]]]:
    report_days = []
    period_summaries: list[tuple[sqlite3.Row, dict]] = []
    for row in days:
        summary = day_summary(row, connection)
        period_summaries.append((row, summary))
        day_workouts = workouts_by_day.get(row["id"], [])

        for workout in day_workouts:
            workout["estimated_kcal"] = round(
                workout_session_kcal(workout, summary["weight"]),
                1,
            )
            for cardio in workout["cardio"]:
                cardio["estimated_kcal"] = round(
                    sum(
                        cardio_interval_kcal(interval, summary["weight"])
                        for interval in cardio["intervals"]
                    ),
                    1,
                )

        report_days.append(
            {
                "day": dict(row),
                "sleep": serialize_sleep(row),
                "summary": {
                    key: round(summary[key], 1)
                    for key in (
                        "intake",
                        "protein",
                        "fat",
                        "carbs",
                        "steps_kcal",
                        "workout_kcal",
                        "tdee",
                        "delta",
                        "deficit",
                        "target",
                        "budget_delta",
                    )
                },
                "entries": food_entries_by_day.get(row["id"], []),
                "workouts": day_workouts,
            }
        )

    return report_days, period_summaries


def build_report_aggregate(
    start_date: date,
    end: str,
    period_summaries: list[tuple[sqlite3.Row, dict]],
    connection: sqlite3.Connection,
) -> tuple[dict, float]:
    closed_delta = sum(
        summary["delta"] for row, summary in period_summaries if row["closed_at"]
    )
    open_delta = sum(
        summary["delta"] for row, summary in period_summaries if not row["closed_at"]
    )
    global_balance_at_end = global_balance(end, connection)
    day_before_period = (
        (start_date - timedelta(days=1)).isoformat() if start_date > date.min else None
    )
    global_balance_before_period = (
        global_balance(day_before_period, connection)
        if day_before_period
        else setting_number(settings(connection), "global_balance")
    )
    aggregate = {
        "days_count": len(period_summaries),
        "closed_days": sum(1 for row, _ in period_summaries if row["closed_at"]),
        "open_days": sum(1 for row, _ in period_summaries if not row["closed_at"]),
        "intake": round(sum(summary["intake"] for _, summary in period_summaries), 1),
        "protein": round(sum(summary["protein"] for _, summary in period_summaries), 1),
        "tdee": round(sum(summary["tdee"] for _, summary in period_summaries), 1),
        "steps_kcal": round(
            sum(summary["steps_kcal"] for _, summary in period_summaries), 1
        ),
        "workout_kcal": round(
            sum(summary["workout_kcal"] for _, summary in period_summaries), 1
        ),
        "closed_delta": round(closed_delta, 1),
        "open_projected_delta": round(open_delta, 1),
        "all_days_delta": round(closed_delta + open_delta, 1),
        "global_balance_before_period": round(global_balance_before_period, 1),
        "global_balance_closed_through_end": round(global_balance_at_end, 1),
        "projected_global_balance_through_end": round(
            global_balance_at_end + open_delta, 1
        ),
    }

    return aggregate, global_balance_at_end


def get_report(start: str, end: str) -> dict:
    start_date, _ = validate_date_range(start, end)

    with db() as connection:
        connection.execute("BEGIN")
        (
            days,
            food_entries,
            cardio_sessions,
            cardio_intervals,
            latest_tape_measurement,
            latest_weight_measurement,
            workouts,
            workout_sets,
        ) = AnalyticsRepository(connection).report_data(start, end)
        food_entries_by_day = group_food_entries_by_day(food_entries)
        workouts_by_day = group_workouts_by_day(
            workouts,
            workout_sets,
            cardio_sessions,
            cardio_intervals,
        )
        report_days, period_summaries = build_report_days(
            days,
            food_entries_by_day,
            workouts_by_day,
            connection,
        )
        aggregate, global_balance_at_end = build_report_aggregate(
            start_date,
            end,
            period_summaries,
            connection,
        )
        latest_measurement = serialize_measurement(connection, latest_tape_measurement)
        latest_weight = serialize_measurement(connection, latest_weight_measurement)
        if latest_measurement is None:
            latest_measurement = latest_weight
        if latest_measurement is not None:
            latest_measurement["tape_measured_on"] = (
                latest_tape_measurement["measured_on"]
                if latest_tape_measurement
                else None
            )
            latest_measurement["weight"] = (
                latest_weight["weight"] if latest_weight else None
            )
            latest_measurement["weight_measured_on"] = (
                latest_weight_measurement["measured_on"]
                if latest_weight_measurement
                else None
            )
        return {
            "start": start,
            "end": end,
            "days": report_days,
            "aggregate": aggregate,
            "latest_measurement": latest_measurement,
            "global_balance": round(global_balance_at_end, 1),
        }


def group_protein_by_period(
    daily: list[dict], period: str, default_protein_minimum: float
) -> list[dict]:
    groups: dict[str, dict] = {}

    for day in daily:
        current_date = date.fromisoformat(day["date"])
        if period == "week":
            period_start = current_date - timedelta(days=current_date.weekday())
            key = period_start.isoformat()
            label = f"{period_start.strftime('%d.%m')}–{(period_start + timedelta(days=6)).strftime('%d.%m')}"
            expected_days = 7
        else:
            key = current_date.strftime("%Y-%m")
            label = current_date.strftime("%m.%Y")
            next_month = (current_date.replace(day=28) + timedelta(days=4)).replace(
                day=1
            )
            expected_days = (next_month - current_date.replace(day=1)).days

        group = groups.setdefault(
            key,
            {
                "key": key,
                "label": label,
                "logged_days": 0,
                "expected_days": expected_days,
                "total_protein": 0.0,
                "days_met": 0,
            },
        )
        group["logged_days"] += 1
        group["total_protein"] += day["protein"]
        group["target_total"] = group.get("target_total", 0.0) + day["protein_min"]
        group["days_met"] += int(day["protein"] >= day["protein_min"])

    result = []
    for group in groups.values():
        logged_days = group["logged_days"]
        average_protein = group["total_protein"] / logged_days if logged_days else 0
        target_average = (
            group["target_total"] / logged_days
            if logged_days
            else default_protein_minimum
        )
        result.append(
            {
                **group,
                "total_protein": round(group["total_protein"], 1),
                "average_protein": round(average_protein, 1),
                "target_for_logged_days": round(group["target_total"], 1),
                "target_average": round(target_average, 1),
                "compensated": group["total_protein"] >= group["target_total"],
                "coverage_percent": round(logged_days / group["expected_days"] * 100),
            }
        )

    return result


def build_daily_statistics(days, protein_minimum: float) -> list[dict]:
    daily = []
    for row in days:
        summary = day_summary(row)
        daily.append(
            {
                "date": row["log_date"],
                "closed": bool(row["closed_at"]),
                "protein": round(summary["protein"], 1),
                "protein_min": round(
                    (
                        row["protein_min"]
                        if row["protein_min"] is not None
                        else protein_minimum
                    ),
                    1,
                ),
                "intake": round(summary["intake"], 1),
                "tdee": round(summary["tdee"], 1),
                "delta": round(summary["delta"], 1),
            }
        )
    return daily


def build_global_balance_curve(
    start: str,
    start_date: date,
    closed_days,
    configured_settings: dict,
) -> list[dict]:

    day_before_period = (
        (start_date - timedelta(days=1)).isoformat() if start_date > date.min else None
    )
    running_balance = (
        global_balance(day_before_period)
        if day_before_period
        else setting_number(configured_settings, "global_balance")
    )
    global_curve = [
        {"date": start, "balance": round(running_balance, 1), "baseline": True}
    ]
    for row in closed_days:
        running_balance += day_summary(row)["delta"]
        global_curve.append(
            {
                "date": row["log_date"],
                "balance": round(running_balance, 1),
                "baseline": False,
            }
        )
    return global_curve


def get_statistics(start: str, end: str) -> dict:
    start_date, _ = validate_date_range(start, end)
    configured_settings = settings()
    protein_minimum = setting_number(configured_settings, "protein_min")
    protein_maximum = setting_number(configured_settings, "protein_max")

    with db() as connection:
        days, closed_days, product_rows, workout_rows, strength_rows, cardio_rows = (
            AnalyticsRepository(connection).statistics_data(start, end)
        )

    daily = build_daily_statistics(days, protein_minimum)
    global_curve = build_global_balance_curve(
        start,
        start_date,
        closed_days,
        configured_settings,
    )

    products = build_product_statistics(product_rows)
    training = build_training_statistics(workout_rows, strength_rows, cardio_rows)
    current_balance = global_balance(end)
    protein_total = sum(day["protein"] for day in daily)

    return {
        "start": start,
        "end": end,
        "targets": {
            "protein_min": protein_minimum,
            "protein_max": protein_maximum,
            "kcal_per_kg_fat": 7500,
        },
        "summary": {
            "logged_days": len(daily),
            "closed_days": len(closed_days),
            "average_protein": round(protein_total / len(daily), 1) if daily else 0,
            "protein_days_met": sum(
                day["protein"] >= day["protein_min"] for day in daily
            ),
            "current_global_balance": round(current_balance, 1),
            "estimated_fat_kg": round(max(0, -current_balance) / 7500, 3),
        },
        "daily": daily,
        "weekly": group_protein_by_period(daily, "week", protein_minimum),
        "monthly": group_protein_by_period(daily, "month", protein_minimum),
        "global_curve": global_curve,
        "products": products,
        "training": training,
    }


def trailing_median(values: list[float]) -> float:
    ordered = sorted(values)
    middle = len(ordered) // 2
    if len(ordered) % 2:
        return ordered[middle]
    return (ordered[middle - 1] + ordered[middle]) / 2


def build_weight_trend_points(measurements, closed_days, connection) -> list[dict]:
    if not measurements:
        return []

    first_date = date.fromisoformat(measurements[0]["measured_on"])
    baseline_weight = float(measurements[0]["weight"])
    closed_day_deltas = [
        (day["log_date"], day_summary(day, connection)["delta"])
        for day in closed_days
        if day["log_date"] > first_date.isoformat()
    ]
    recent_weights: list[float] = []
    running_delta = 0.0
    closed_index = 0
    points = []

    for measurement in measurements:
        measured_on = measurement["measured_on"]
        while (
            closed_index < len(closed_day_deltas)
            and closed_day_deltas[closed_index][0] < measured_on
        ):
            running_delta += closed_day_deltas[closed_index][1]
            closed_index += 1

        measured_weight = float(measurement["weight"])
        recent_weights.append(measured_weight)
        has_energy_data = closed_index > 0
        expected_change = running_delta / KCAL_PER_KG_ENERGY_EQUIVALENT
        points.append(
            {
                "date": measured_on,
                "weight": round(measured_weight, 2),
                "trend_weight": round(trailing_median(recent_weights[-3:]), 2),
                "expected_weight": (
                    round(baseline_weight + expected_change, 2)
                    if has_energy_data
                    else None
                ),
                "energy_delta": round(running_delta, 1),
                "closed_days_count": closed_index,
            }
        )

    return points


def weight_trend_comparison(points: list[dict]) -> dict:
    if len(points) < 3:
        return {
            "status": "insufficient",
            "message": "Нужно минимум три измерения, чтобы отделить единичный скачок от тренда.",
        }

    if points[-1]["expected_weight"] is None:
        return {
            "status": "insufficient",
            "message": "Для расчётной кривой нужны хотя бы один закрытый день и последующий замер веса.",
        }

    start_date = date.fromisoformat(points[0]["date"])
    end_date = date.fromisoformat(points[-1]["date"])
    observed_change = points[-1]["trend_weight"] - points[0]["trend_weight"]
    expected_change = points[-1]["expected_weight"] - points[0]["trend_weight"]
    residual = observed_change - expected_change
    observed_days = (end_date - start_date).days
    comparison = {
        "observed_days": observed_days,
        "observed_change": round(observed_change, 2),
        "expected_change": round(expected_change, 2),
        "residual": round(residual, 2),
    }
    if observed_days < MINIMUM_WEIGHT_TREND_DAYS:
        return {
            **comparison,
            "status": "insufficient",
            "message": "Интервал короче 14 дней: вес пока слишком чувствителен к воде, гликогену и содержимому ЖКТ.",
        }
    if abs(residual) <= WEIGHT_TREND_TOLERANCE_KG:
        return {
            **comparison,
            "status": "aligned",
            "message": "Сглаженный вес укладывается в энергетический расчёт. Дефицит выглядит согласованным с журналом.",
        }
    if expected_change < 0 and observed_change > 0:
        return {
            **comparison,
            "status": "masked",
            "message": "Журнал показывает дефицит, но вес пока его не отражает. Сначала добери несколько сопоставимых замеров, затем проверь воду, соль, углеводы и полноту дневника.",
        }
    return {
        **comparison,
        "status": "diverged",
        "message": "Тренд веса заметно расходится с расчётом. Это сигнал сверить закрытые дни, порции и оценку расхода, а не вывод о составе тела.",
    }


def get_weight_trend(start: str, end: str) -> dict:
    validate_date_range(start, end)
    with db() as connection:
        measurements, closed_days = AnalyticsRepository(connection).weight_trend_data(
            start, end
        )
        points = build_weight_trend_points(measurements, closed_days, connection)

    return {
        "start": start,
        "end": end,
        "kcal_per_kg_energy_equivalent": KCAL_PER_KG_ENERGY_EQUIVALENT,
        "points": points,
        "comparison": weight_trend_comparison(points),
    }


def build_product_statistics(product_rows) -> list[dict]:
    products = []

    for row in product_rows:
        serving_grams = row["serving_grams"] or 0
        kcal_per_100_grams = row["kcal_100"]
        protein_per_100_grams = row["protein_100"]
        if kcal_per_100_grams is None and serving_grams > 0:
            kcal_per_100_grams = row["kcal"] / serving_grams * 100
        if protein_per_100_grams is None and serving_grams > 0:
            protein_per_100_grams = row["protein"] / serving_grams * 100

        protein_per_100_kcal = (
            protein_per_100_grams / kcal_per_100_grams * 100
            if kcal_per_100_grams and protein_per_100_grams is not None
            else None
        )
        grams_per_100_kcal = 10000 / kcal_per_100_grams if kcal_per_100_grams else None
        if protein_per_100_kcal is None or grams_per_100_kcal is None:
            value_score = None
            value_label = "недостаточно данных"
        else:
            protein_score = min(1.0, protein_per_100_kcal / 25)
            volume_score = min(1.0, grams_per_100_kcal / 400)
            value_score = round((protein_score * 0.65 + volume_score * 0.35) * 100)
            if value_score >= 70:
                value_label = "очень выгодно"
            elif value_score >= 45:
                value_label = "выгодно"
            elif value_score >= 25:
                value_label = "нейтрально"
            else:
                value_label = "дорого по бюджету"

        products.append(
            {
                "id": row["id"],
                "name": row["name"],
                "category": row["category"],
                "active": bool(row["active"]),
                "uses": row["uses"],
                "consumed_kcal": round(row["consumed_kcal"], 1),
                "consumed_protein": round(row["consumed_protein"], 1),
                "kcal_100": (
                    round(kcal_per_100_grams, 1)
                    if kcal_per_100_grams is not None
                    else None
                ),
                "protein_100": (
                    round(protein_per_100_grams, 1)
                    if protein_per_100_grams is not None
                    else None
                ),
                "protein_per_100_kcal": (
                    round(protein_per_100_kcal, 1)
                    if protein_per_100_kcal is not None
                    else None
                ),
                "grams_per_100_kcal": (
                    round(grams_per_100_kcal, 1)
                    if grams_per_100_kcal is not None
                    else None
                ),
                "value_score": value_score,
                "value_label": value_label,
            }
        )

    return products


def collect_strength_totals(strength_rows) -> dict:
    totals = {
        "exercises": {},
        "muscles": {},
        "weeks": {},
        "working_sets": 0,
        "warmup_sets": 0,
        "repetitions": 0,
        "volume": 0.0,
        "unclassified_sets": 0,
    }
    for row in strength_rows:
        if row["reps"] <= 0:
            continue
        if row["is_warmup"]:
            totals["warmup_sets"] += 1
            continue

        totals["working_sets"] += 1
        repetitions = int(row["reps"])
        volume = max(0.0, row["weight"]) * repetitions
        estimated_one_rep_max = max(0.0, row["weight"]) * (1 + repetitions / 30.0)
        totals["repetitions"] += repetitions
        totals["volume"] += volume

        exercise = totals["exercises"].setdefault(
            row["exercise"],
            {
                "exercise": row["exercise"],
                "sets": 0,
                "reps": 0,
                "volume": 0.0,
                "max_weight": 0.0,
                "estimated_1rm": 0.0,
                "workout_ids": set(),
            },
        )
        exercise["sets"] += 1
        exercise["reps"] += repetitions
        exercise["volume"] += volume
        exercise["max_weight"] = max(exercise["max_weight"], row["weight"])
        exercise["estimated_1rm"] = max(
            exercise["estimated_1rm"], estimated_one_rep_max
        )
        exercise["workout_ids"].add(row["workout_id"])

        current_date = date.fromisoformat(row["log_date"])
        week_start = current_date - timedelta(days=current_date.weekday())
        week = totals["weeks"].setdefault(
            week_start.isoformat(),
            {
                "key": week_start.isoformat(),
                "label": f"{week_start.strftime('%d.%m')}–{(week_start + timedelta(days=6)).strftime('%d.%m')}",
                "sets": 0,
                "reps": 0,
                "volume": 0.0,
                "workout_ids": set(),
            },
        )
        week["sets"] += 1
        week["reps"] += repetitions
        week["volume"] += volume
        week["workout_ids"].add(row["workout_id"])

        primary_muscles, secondary_muscles = read_muscle_profile(row)
        if not primary_muscles and not secondary_muscles:
            totals["unclassified_sets"] += 1

        add_muscle_load(totals["muscles"], primary_muscles, "primary", 1.0, volume)
        add_muscle_load(totals["muscles"], secondary_muscles, "secondary", 0.5, volume)

    return totals


def read_muscle_profile(row) -> tuple[list[str], list[str]]:
    try:
        muscle_profile = json.loads(row["muscle_profile_snapshot"] or "{}")
    except json.JSONDecodeError:
        muscle_profile = {}

    primary_muscles = [
        str(name).strip()
        for name in muscle_profile.get("primary", [])
        if str(name).strip()
    ]
    secondary_muscles = [
        str(name).strip()
        for name in muscle_profile.get("secondary", [])
        if str(name).strip()
    ]
    return primary_muscles, secondary_muscles


def add_muscle_load(
    muscle_totals: dict[str, dict],
    muscle_names: list[str],
    role: str,
    load_factor: float,
    volume: float,
) -> None:
    for muscle_name in muscle_names:
        muscle = muscle_totals.setdefault(
            muscle_name,
            {
                "muscle": muscle_name,
                "set_equivalents": 0.0,
                "primary_sets": 0,
                "secondary_sets": 0,
                "volume_share": 0.0,
            },
        )
        muscle["set_equivalents"] += load_factor
        muscle[f"{role}_sets"] += 1
        muscle["volume_share"] += volume * load_factor


def format_exercise_statistics(exercise_totals: dict[str, dict]) -> list[dict]:
    statistics = [
        {
            **{key: value for key, value in exercise.items() if key != "workout_ids"},
            "sessions": len(exercise["workout_ids"]),
            "volume": round(exercise["volume"], 1),
            "max_weight": round(exercise["max_weight"], 1),
            "estimated_1rm": round(exercise["estimated_1rm"], 1),
        }
        for exercise in exercise_totals.values()
    ]
    statistics.sort(
        key=lambda exercise: (
            -exercise["volume"],
            -exercise["sets"],
            exercise["exercise"].lower(),
        )
    )
    return statistics


def format_muscle_statistics(muscle_totals: dict[str, dict]) -> list[dict]:
    statistics = [
        {
            **muscle,
            "set_equivalents": round(muscle["set_equivalents"], 1),
            "volume_share": round(muscle["volume_share"], 1),
        }
        for muscle in muscle_totals.values()
    ]
    statistics.sort(
        key=lambda muscle: (-muscle["set_equivalents"], muscle["muscle"].lower())
    )
    return statistics


def format_weekly_strength(weekly_totals: dict[str, dict]) -> list[dict]:
    return [
        {
            **{key: value for key, value in week.items() if key != "workout_ids"},
            "sessions": len(week["workout_ids"]),
            "volume": round(week["volume"], 1),
        }
        for week in weekly_totals.values()
    ]


def build_training_statistics(workout_rows, strength_rows, cardio_rows) -> dict:
    totals = collect_strength_totals(strength_rows)

    return {
        "summary": {
            "sessions": len(workout_rows),
            "duration_minutes": round(
                sum(row["duration_minutes"] for row in workout_rows), 1
            ),
            "working_sets": totals["working_sets"],
            "warmup_sets": totals["warmup_sets"],
            "reps": totals["repetitions"],
            "volume": round(totals["volume"], 1),
            "unclassified_sets": totals["unclassified_sets"],
            "cardio_sessions": len(cardio_rows),
            "cardio_minutes": round(
                sum(row["duration_minutes"] for row in cardio_rows), 1
            ),
        },
        "weekly": format_weekly_strength(totals["weeks"]),
        "exercises": format_exercise_statistics(totals["exercises"]),
        "muscles": format_muscle_statistics(totals["muscles"]),
        "method": {
            "volume": "вес × повторения; разминочные подходы исключены",
            "muscle_load": "1.0 за основную мышцу и 0.5 за вторичную в каждом рабочем подходе",
        },
    }


def get_progress() -> dict:
    return {
        "measurements": get_measurements(),
        "measurement_fields": get_body_measurement_fields(),
    }


def add_measurement(payload: dict) -> dict:
    save_legacy_measurement(payload)
    return get_progress()
