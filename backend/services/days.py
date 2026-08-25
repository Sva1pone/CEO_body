from __future__ import annotations

import sqlite3
from datetime import date, datetime
from itertools import combinations_with_replacement

from backend.config import DEFAULT_STEP_LENGTH_METERS
from backend.database.sql_commands.days import DayRepository
from backend.database.sql_commands.products import ProductRepository
from backend.services.day_validation import (
    MEAL_TYPES,
    validate_day_update_payload,
    validate_food_batch_payload,
    validate_food_quantity,
    validate_meal_type,
    validate_request_token,
    validate_sleep_payload,
)
from backend.services.products import serialize_product, serialize_product_categories
from backend.services.runtime import (
    DEFAULTS,
    as_float,
    create_database_backup,
    db,
    serialize_sleep,
)


class DayResourceNotFoundError(Exception):
    pass


class DayConflictError(Exception):
    pass


class StrategyNotConfiguredError(Exception):
    pass


def food_request_matches(
    existing_entry: sqlite3.Row | None,
    day_id: int,
    product_id: int,
    quantity: float,
    quantity_mode: str,
) -> bool:
    return bool(
        existing_entry
        and existing_entry["day_id"] == day_id
        and existing_entry["product_id"] == product_id
        and existing_entry["quantity_mode"] == quantity_mode
        and abs(existing_entry["quantity"] - quantity) < 1e-9
    )


def food_quantity_factor(product: sqlite3.Row, quantity: float, mode: str) -> float:
    if mode == "grams":
        if not product["serving_grams"]:
            raise ValueError("У позиции не задан вес порции.")
        return quantity / product["serving_grams"]
    if mode == "units":
        return quantity / max(product["serving_units"] or 1, 1)
    return quantity


def setup_day(day_id: int, payload: dict) -> dict:
    with db() as connection:
        days = DayRepository(connection)
        day = days.find(day_id)
        if not day:
            raise DayResourceNotFoundError("День не найден.")
        if day["closed_at"]:
            raise DayConflictError("День закрыт. Открой его для правок.")

        training_planned = bool(payload.get("training_planned"))
        day_type = payload.get("day_type", "Отдых") if training_planned else "Отдых"
        days.setup(day_id, training_planned, day_type)

    return get_day_details(day["log_date"])


def move_to_meal(day_id: int, payload: dict) -> dict:
    meal = validate_meal_type(payload.get("current_meal"))

    with db() as connection:
        days = DayRepository(connection)
        day = days.find(day_id)
        if not day:
            raise DayResourceNotFoundError("День не найден.")
        if day["closed_at"]:
            raise DayConflictError("День закрыт. Открой его для правок.")

        days.set_current_meal(day_id, meal)

    return get_day_details(day["log_date"])


def add_food_entry(day_id: int, payload: dict) -> dict:
    quantity, quantity_mode = validate_food_quantity(
        payload,
        integer_error="Порции и штуки добавляются целыми значениями.",
    )
    request_token = validate_request_token(payload)
    duplicate = False

    with db() as connection:
        days = DayRepository(connection)
        day = days.find(day_id)
        if not day:
            raise DayResourceNotFoundError("День не найден.")
        if day["closed_at"]:
            raise DayConflictError("День уже закрыт. Сначала открой его для правок.")

        products = ProductRepository(connection)
        active_product = products.find_active(payload.get("product_id"))
        product = products.find_record(active_product["id"]) if active_product else None
        if not product:
            raise DayResourceNotFoundError("Продукт не найден.")

        existing_entry = (
            days.find_food_request(request_token) if request_token else None
        )
        if existing_entry:
            same_action = food_request_matches(
                existing_entry,
                day_id,
                product["id"],
                quantity,
                quantity_mode,
            )
            if not same_action:
                raise DayConflictError(
                    "Этот идентификатор уже использован для другой записи."
                )
            duplicate = True

        factor = food_quantity_factor(product, quantity, quantity_mode)

        meal = payload.get("meal_type", day["current_meal"])
        if meal not in MEAL_TYPES:
            meal = day["current_meal"]

        if not duplicate:
            try:
                days.add_food(
                    {
                        "day_id": day_id,
                        "product_id": product["id"],
                        "product_name": product["name"],
                        "quantity": quantity,
                        "quantity_mode": quantity_mode,
                        "kcal": product["kcal"] * factor,
                        "protein": product["protein"] * factor,
                        "fat": (product["fat"] or 0) * factor,
                        "carbs": (product["carbs"] or 0) * factor,
                        "meal_type": meal,
                        "request_token": request_token,
                        "created_at": datetime.now().isoformat(timespec="seconds"),
                    }
                )
            except sqlite3.IntegrityError:
                existing_entry = days.find_food_request(request_token)
                same_action = food_request_matches(
                    existing_entry,
                    day_id,
                    product["id"],
                    quantity,
                    quantity_mode,
                )
                if not same_action:
                    raise
                duplicate = True

    result = get_day_details(day["log_date"])
    result["food_write"] = "duplicate_ignored" if duplicate else "created"
    return result


def add_food_batch(day_id: int, payload: dict) -> dict:
    combined, batch_token, meal = validate_food_batch_payload(payload)
    created_entry_count = 0

    with db() as connection:
        days = DayRepository(connection)
        day = days.find(day_id)
        if not day:
            raise DayResourceNotFoundError("День не найден.")
        if day["closed_at"]:
            raise DayConflictError("День уже закрыт. Сначала открой его для правок.")

        if meal not in MEAL_TYPES:
            meal = day["current_meal"]

        product_ids = list(combined)
        products_by_id = {
            row["id"]: row for row in days.list_active_products(product_ids)
        }
        if len(products_by_id) != len(product_ids):
            raise DayConflictError(
                "Одна из позиций набора больше недоступна в реестре."
            )

        prepared_entries = []
        for index, product_id in enumerate(product_ids):
            product = products_by_id[product_id]
            quantity = combined[product_id]
            request_token = f"{batch_token}:{index}"
            existing_entry = days.find_food_request(request_token)
            same_action = existing_entry and (
                existing_entry["day_id"] == day_id
                and existing_entry["product_id"] == product_id
                and existing_entry["quantity_mode"] == "serving"
                and abs(existing_entry["quantity"] - quantity) < 1e-9
            )
            if existing_entry and not same_action:
                raise DayConflictError("Этот набор уже использован для другой записи.")
            prepared_entries.append((product, quantity, request_token, existing_entry))

        created_at = datetime.now().isoformat(timespec="seconds")
        for product, quantity, request_token, existing_entry in prepared_entries:
            if existing_entry:
                continue

            days.add_food(
                {
                    "day_id": day_id,
                    "product_id": product["id"],
                    "product_name": product["name"],
                    "quantity": quantity,
                    "quantity_mode": "serving",
                    "kcal": product["kcal"] * quantity,
                    "protein": product["protein"] * quantity,
                    "fat": (product["fat"] or 0) * quantity,
                    "carbs": (product["carbs"] or 0) * quantity,
                    "meal_type": meal,
                    "request_token": request_token,
                    "created_at": created_at,
                }
            )
            created_entry_count += 1

    result = get_day_details(day["log_date"])
    result["food_write"] = (
        "batch_created" if created_entry_count else "batch_duplicate_ignored"
    )
    result["batch_entries_created"] = created_entry_count
    return result


def delete_food_entry(entry_id: int) -> dict:
    with db() as connection:
        days = DayRepository(connection)
        food_entry = days.find_food_for_deletion(entry_id)
        if not food_entry:
            raise DayResourceNotFoundError("Запись рациона не найдена.")
        if food_entry["closed_at"]:
            raise DayConflictError("День закрыт. Открой его для правок.")

        days.delete_food(entry_id)

    return get_day_details(food_entry["log_date"])


def update_food_entry(entry_id: int, payload: dict) -> dict:
    quantity, quantity_mode = validate_food_quantity(
        payload,
        default_quantity=0,
        integer_error="Порции и штуки меняются целыми значениями.",
    )

    with db() as connection:
        days = DayRepository(connection)
        food_entry = days.find_food_for_update(entry_id)
        if not food_entry:
            raise DayResourceNotFoundError("Запись рациона не найдена.")
        if food_entry["closed_at"]:
            raise DayConflictError("День закрыт. Открой его для правок.")

        factor = quantity
        if quantity_mode == "grams":
            if not food_entry["serving_grams"]:
                raise ValueError("У позиции не задан вес порции.")
            factor = quantity / food_entry["serving_grams"]
        elif quantity_mode == "units":
            factor = quantity / max(food_entry["serving_units"] or 1, 1)

        meal = payload.get("meal_type", food_entry["meal_type"])
        if meal not in MEAL_TYPES:
            meal = food_entry["meal_type"]

        days.update_food(
            entry_id,
            {
                "quantity": quantity,
                "quantity_mode": quantity_mode,
                "kcal": food_entry["product_kcal"] * factor,
                "protein": food_entry["product_protein"] * factor,
                "fat": (food_entry["product_fat"] or 0) * factor,
                "carbs": (food_entry["product_carbs"] or 0) * factor,
                "meal_type": meal,
            },
        )

    return get_day_details(food_entry["log_date"])


def update_day(day_id: int, payload: dict) -> dict:
    with db() as connection:
        days = DayRepository(connection)
        day = days.find(day_id)
        if not day:
            raise DayResourceNotFoundError("День не найден.")
        if day["closed_at"]:
            raise DayConflictError("День закрыт. Открой его для правок.")

        days.update(day_id, validate_day_update_payload(payload, day))

    return get_day_details(day["log_date"])


def update_day_sleep(day_id: int, payload: dict) -> dict:
    sleep_values = validate_sleep_payload(payload)

    with db() as connection:
        days = DayRepository(connection)
        day = days.find(day_id)
        if not day:
            raise DayResourceNotFoundError("День не найден.")
        if day["closed_at"]:
            raise DayConflictError("День закрыт. Открой его для правок.")

        days.update_sleep(day_id, sleep_values)

    return get_day_details(day["log_date"])


def close_day(day_id: int) -> dict:
    with db() as connection:
        connection.execute("BEGIN IMMEDIATE")
        days = DayRepository(connection)
        day = days.find(day_id)
        if not day:
            raise DayResourceNotFoundError("День не найден.")

        if not day["closed_at"]:
            summary = day_summary(day, connection)
            days.close(
                day_id,
                summary,
                datetime.now().isoformat(timespec="seconds"),
            )

    return get_day_details(day["log_date"])


def reopen_day(day_id: int) -> dict:
    with db() as connection:
        days = DayRepository(connection)
        day = days.find(day_id)
        if not day:
            raise DayResourceNotFoundError("День не найден.")

        days.reopen(day_id)

    return get_day_details(day["log_date"])


def delete_day(day_id: int, payload: dict) -> dict:
    with db() as connection:
        day = DayRepository(connection).find(day_id)
    if not day:
        raise DayResourceNotFoundError("День не найден.")

    if (payload.get("confirm_date") or "").strip() != day["log_date"]:
        raise ValueError("Для удаления введи дату дня полностью.")

    backup = create_database_backup(f"before-delete-{day['log_date']}")
    with db() as connection:
        DayRepository(connection).delete_with_related_data(day_id)

    return {"deleted": True, "date": day["log_date"], "backup": backup}


def settings(connection: sqlite3.Connection | None = None) -> dict[str, str]:
    if connection is None:
        with db() as new_connection:
            return settings(new_connection)
    days = DayRepository(connection)
    values = {row["key"]: row["value"] for row in days.list_settings()}
    active = days.find_strategy(date.today().isoformat())
    if active:
        for key in ("phase", "base_tdee", "protein_min", "protein_max", "goal_delta"):
            values[key] = str(active[key])
    return values


def strategy_for_date(log_date: str) -> sqlite3.Row:
    with db() as connection:
        days = DayRepository(connection)
        row = days.find_strategy(log_date)
        if row:
            return row
        return days.find_first_strategy()


def setting_number(values: dict[str, str], key: str) -> float:
    return as_float(values.get(key), as_float(DEFAULTS.get(key, "0")))


def latest_weight(connection: sqlite3.Connection | None = None) -> float | None:
    if connection is None:
        with db() as new_connection:
            row = DayRepository(new_connection).latest_weight()
    else:
        row = DayRepository(connection).latest_weight()
    return row["weight"] if row else None


def get_or_create_day(log_date: str) -> sqlite3.Row:
    strategy = strategy_for_date(log_date)
    if not strategy:
        raise StrategyNotConfiguredError("Сначала создай стратегию питания.")
    values = settings()
    with db() as connection:
        days = DayRepository(connection)
        days.create_if_missing(
            {
                "log_date": log_date,
                "phase": strategy["phase"],
                "base_tdee": strategy["base_tdee"],
                "goal_delta": strategy["goal_delta"],
                "step_cadence": setting_number(values, "step_cadence"),
                "protein_min": strategy["protein_min"],
                "protein_max": strategy["protein_max"],
                "strategy_version_id": strategy["id"],
            }
        )
        return days.find_by_date(log_date)


def step_kcal(day: sqlite3.Row, weight: float) -> float:
    """Net energy of level walking, above resting expenditure already inside base TDEE.

    ACSM's level-walking equation gives 0.5 kcal/kg/km above rest. A daily
    step count has no actual distance, so the default 0.70 m step length is an
    explicit, conservative estimate rather than a false exact 'kcal per step'.
    """
    watch_kcal = day["watch_active_kcal"]
    if watch_kcal is not None:
        return max(0.0, watch_kcal)
    distance_km = max(0, day["steps"]) * DEFAULT_STEP_LENGTH_METERS / 1000
    return max(0.0, 0.5 * weight * distance_km)


def workout_kcal(
    day_id: int,
    weight: float,
    connection: sqlite3.Connection | None = None,
) -> float:
    if connection is None:
        with db() as new_connection:
            sessions = DayRepository(new_connection).list_workout_energy(day_id)
    else:
        sessions = DayRepository(connection).list_workout_energy(day_id)
    return sum(workout_session_kcal(s, weight) for s in sessions)


def workout_session_kcal(workout: sqlite3.Row, weight: float) -> float:
    """Чистый расход тренировки сверх покоя по формуле MET."""
    return max(
        0.0,
        (workout["intensity_met"] - 1)
        * 3.5
        * weight
        / 200
        * workout["duration_minutes"],
    )


def day_summary(
    day: sqlite3.Row,
    connection: sqlite3.Connection | None = None,
) -> dict:
    if connection is None:
        with db() as new_connection:
            entries = DayRepository(new_connection).list_food_entries(day["id"])
    else:
        entries = DayRepository(connection).list_food_entries(day["id"])
    intake = sum(row["kcal"] for row in entries)
    protein = sum(row["protein"] for row in entries)
    fat = sum(row["fat"] or 0 for row in entries)
    carbs = sum(row["carbs"] or 0 for row in entries)
    is_frozen = bool(day["closed_at"] and day["closed_tdee"] is not None)
    weight = (
        day["closed_weight"]
        if is_frozen and day["closed_weight"] is not None
        else latest_weight(connection)
    )
    steps = day["closed_steps_kcal"] if is_frozen else step_kcal(day, weight or 0)
    workout = (
        day["closed_workout_kcal"]
        if is_frozen
        else workout_kcal(day["id"], weight or 0, connection)
    )
    tdee = (
        day["closed_tdee"]
        if is_frozen
        else (
            day["base_tdee"]
            + steps
            + workout
            + day["cardio_kcal"]
            + day["manual_adjustment"]
        )
    )
    target = tdee + day["goal_delta"]
    return {
        "entries": entries,
        "intake": intake,
        "protein": protein,
        "fat": fat,
        "carbs": carbs,
        "weight": weight,
        "steps_kcal": steps,
        "steps_source": "watch" if day["watch_active_kcal"] is not None else "formula",
        "workout_kcal": workout,
        "tdee": tdee,
        "delta": intake - tdee,
        "target": target,
        "budget_delta": intake - target,
        "deficit": tdee - intake,
    }


def global_balance(
    until: str | None = None,
    connection: sqlite3.Connection | None = None,
) -> float:
    if connection is None:
        with db() as new_connection:
            return global_balance(until, new_connection)
    values = settings(connection)
    rows = DayRepository(connection).list_closed(until)
    return setting_number(values, "global_balance") + sum(
        day_summary(row, connection)["delta"] for row in rows
    )


def finisher_options(day: sqlite3.Row, products: list[sqlite3.Row]) -> list[dict]:
    summary = day_summary(day)
    target = summary["tdee"] + day["goal_delta"]
    remaining_kcal = target - summary["intake"]
    protein_min = (
        day["protein_min"]
        if day["protein_min"] is not None
        else setting_number(settings(), "protein_min")
    )
    remaining_protein = max(0, protein_min - summary["protein"])
    usable_products = [
        product for product in products if product["kcal"] > 0 or product["protein"] > 0
    ]

    def seed_score(product: sqlite3.Row) -> float:
        protein_gap = max(0, remaining_protein - product["protein"])
        overshoot = max(0, product["kcal"] - remaining_kcal)
        return (
            protein_gap * 25
            + overshoot * 6
            + abs(product["kcal"] - remaining_kcal) * 0.15
        )

    # Полный реестр может расти бесконечно. Сначала оставляем 24 наиболее
    # подходящие одиночные позиции, затем перебираем их сочетания до трёх порций.
    candidate_products = sorted(usable_products, key=seed_score)[:24]
    options = []
    for size in (1, 2, 3):
        for combo in combinations_with_replacement(candidate_products, size):
            kcal = sum(x["kcal"] for x in combo)
            protein = sum(x["protein"] for x in combo)
            if kcal <= 0 and protein <= 0:
                continue
            # Белок первичен, но огромный выход за бюджет получает сильный штраф.
            protein_gap_after = max(0, remaining_protein - protein)
            overshoot = max(0, kcal - remaining_kcal)
            score = (
                protein_gap_after * 25
                + overshoot * 6
                + abs(kcal - remaining_kcal) * 0.15
                + size * 3
            )
            line_counts: dict[int, dict] = {}
            for product in combo:
                line = line_counts.setdefault(
                    product["id"], {"product": product, "quantity": 0}
                )
                line["quantity"] += 1
            projected_intake = summary["intake"] + kcal
            projected_protein = summary["protein"] + protein
            options.append(
                {
                    "items": combo,
                    "lines": list(line_counts.values()),
                    "kcal": kcal,
                    "protein": protein,
                    "score": score,
                    "projected_intake": projected_intake,
                    "projected_protein": projected_protein,
                    "projected_remaining_kcal": target - projected_intake,
                    "projected_delta": projected_intake - summary["tdee"],
                    "protein_gap_after": max(0, protein_min - projected_protein),
                    "protein_met": projected_protein >= protein_min,
                    "within_budget": projected_intake <= target,
                }
            )
    options.sort(key=lambda item: item["score"])
    selected, signatures = [], set()
    for option in options:
        signature = tuple(x["id"] for x in option["items"])
        if signature not in signatures:
            selected.append(option)
            signatures.add(signature)
        if len(selected) == 3:
            break
    return selected


def format_food_entries(entries: list[sqlite3.Row]) -> list[dict]:
    formatted_entries = []
    for row in entries:
        item = dict(row)
        item["image_url"] = (
            f"/static/{row['image_path']}" if row["image_path"] else None
        )
        item["category_icon"] = row["category_icon"] or "utensils"
        item["category_color"] = row["category_color"] or "#6d5dfc"
        item["benefit_tag"] = row["benefit_tag"] or "обычный выбор"
        item["benefit_color"] = row["benefit_color"] or item["category_color"]
        formatted_entries.append(item)

    return formatted_entries


def format_finisher_options(options: list[dict]) -> list[dict]:
    return [
        {
            "lines": [
                {
                    "product": serialize_product(line["product"]),
                    "quantity": line["quantity"],
                }
                for line in option["lines"]
            ],
            "kcal": round(option["kcal"], 1),
            "protein": round(option["protein"], 1),
            "projected_intake": round(option["projected_intake"], 1),
            "projected_protein": round(option["projected_protein"], 1),
            "projected_remaining_kcal": round(option["projected_remaining_kcal"], 1),
            "projected_delta": round(option["projected_delta"], 1),
            "protein_gap_after": round(option["protein_gap_after"], 1),
            "protein_met": option["protein_met"],
            "within_budget": option["within_budget"],
        }
        for option in options
    ]


def format_day_summary(summary: dict, target: float, protein_minimum: float) -> dict:
    return {
        "intake": round(summary["intake"], 1),
        "protein": round(summary["protein"], 1),
        "fat": round(summary["fat"], 1),
        "carbs": round(summary["carbs"], 1),
        "steps_kcal": round(summary["steps_kcal"], 1),
        "steps_source": summary["steps_source"],
        "workout_kcal": round(summary["workout_kcal"], 1),
        "tdee": round(summary["tdee"], 1),
        "delta": round(summary["delta"], 1),
        "deficit": round(summary["deficit"], 1),
        "budget_delta": round(summary["budget_delta"], 1),
        "target": round(target, 1),
        "remaining_kcal": round(target - summary["intake"], 1),
        "remaining_protein": round(max(0, protein_minimum - summary["protein"]), 1),
    }


def virtual_day(log_date: str) -> dict:
    strategy = strategy_for_date(log_date)
    if not strategy:
        raise StrategyNotConfiguredError("Сначала создай стратегию питания.")
    configured_settings = settings()
    return {
        "id": None,
        "log_date": log_date,
        "day_type": "Отдых",
        "phase": strategy["phase"],
        "base_tdee": strategy["base_tdee"],
        "goal_delta": strategy["goal_delta"],
        "steps": 0,
        "step_cadence": setting_number(configured_settings, "step_cadence"),
        "manual_adjustment": 0,
        "cardio_kcal": 0,
        "note": None,
        "closed_at": None,
        "setup_done": 0,
        "current_meal": "Завтрак",
        "training_planned": None,
        "closed_weight": None,
        "closed_steps_kcal": None,
        "closed_workout_kcal": None,
        "closed_tdee": None,
        "sleep_start": None,
        "sleep_end": None,
        "sleep_deep_percent": None,
        "sleep_rem_percent": None,
        "watch_active_kcal": None,
        "protein_min": strategy["protein_min"],
        "protein_max": strategy["protein_max"],
        "strategy_version_id": strategy["id"],
    }


def find_day(log_date: str) -> sqlite3.Row | None:
    with db() as connection:
        return DayRepository(connection).find_by_date(log_date)


def get_day_details(log_date: str, create: bool = False) -> dict:
    day = get_or_create_day(log_date) if create else find_day(log_date)
    if day is None:
        day = virtual_day(log_date)
    summary = day_summary(day)
    configured_settings = settings()

    with db() as connection:
        days = DayRepository(connection)
        products = ProductRepository(connection)
        product_rows = products.list()
        food_entries = days.list_detailed_food_entries(day["id"]) if day["id"] else []
        workouts = days.list_workouts(day["id"]) if day["id"] else []
        popular_products = products.list_popular()

    target = summary["target"]
    protein_minimum = (
        day["protein_min"]
        if day["protein_min"] is not None
        else setting_number(configured_settings, "protein_min")
    )
    finisher_active = bool(
        not day["closed_at"] and target > 0 and summary["intake"] >= target * 0.70
    )
    finisher_complete = bool(
        finisher_active
        and summary["protein"] >= protein_minimum
        and summary["intake"] >= target
    )
    finisher_choices = (
        finisher_options(day, product_rows)
        if finisher_active and not finisher_complete
        else []
    )

    closed_global_balance = global_balance()
    projected_global_balance = (
        closed_global_balance
        if day["closed_at"]
        else closed_global_balance + summary["delta"]
    )

    return {
        "day": dict(day),
        "sleep": serialize_sleep(day),
        "summary": format_day_summary(summary, target, protein_minimum),
        "settings": configured_settings,
        "entries": format_food_entries(food_entries),
        "products": [serialize_product(row) for row in product_rows],
        "popular": [serialize_product(row) for row in popular_products],
        "categories": serialize_product_categories(),
        "workouts": [dict(row) for row in workouts],
        "finishers": format_finisher_options(finisher_choices),
        "finisher_active": finisher_active,
        "finisher_complete": finisher_complete,
        "finisher_threshold": round(target * 0.70, 1),
        "finisher_progress": round(summary["intake"] / max(target, 1) * 100, 1),
        "finisher_product_ids": sorted(
            {
                line["product"]["id"]
                for option in finisher_choices
                for line in option["lines"]
            }
        ),
        # global_balance включает исключительно зафиксированные закрытые дни.
        # projected_global_balance дополнительно включает выбранный открытый день один раз.
        "global_balance": round(closed_global_balance, 1),
        "projected_global_balance": round(projected_global_balance, 1),
        "projection_includes_open_day": not bool(day["closed_at"]),
        "meals": ["Завтрак", "Обед", "Ужин", "Перекус"],
    }
