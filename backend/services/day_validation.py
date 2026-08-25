from __future__ import annotations

import sqlite3
from datetime import datetime

from backend.services.runtime import parse_integer, parse_number

MEAL_TYPES = {"Завтрак", "Обед", "Ужин", "Перекус"}
QUANTITY_MODES = {"serving", "grams", "units"}


def validate_meal_type(meal: object) -> str:
    if meal not in MEAL_TYPES:
        raise ValueError("Неизвестный приём пищи.")
    return str(meal)


def validate_food_quantity(
    payload: dict,
    default_quantity: float = 1,
    integer_error: str = "Порции и штуки указываются целыми значениями.",
) -> tuple[float, str]:
    quantity = parse_number(payload.get("quantity", default_quantity), "количество")
    quantity_mode = payload.get("quantity_mode", "serving")

    if quantity <= 0 or quantity_mode not in QUANTITY_MODES:
        raise ValueError("Проверь количество и единицу измерения.")
    if quantity_mode in {"serving", "units"} and not quantity.is_integer():
        raise ValueError(integer_error)

    return quantity, quantity_mode


def validate_request_token(payload: dict, maximum_length: int = 128) -> str | None:
    request_token = (payload.get("request_token") or "").strip() or None
    if request_token and len(request_token) > maximum_length:
        raise ValueError("Некорректный идентификатор запроса.")
    return request_token


def validate_food_batch_payload(payload: dict) -> tuple[dict[int, float], str, object]:
    raw_items = payload.get("items") or []
    if not isinstance(raw_items, list) or not 1 <= len(raw_items) <= 6:
        raise ValueError("В наборе должно быть от 1 до 6 строк.")

    batch_token = validate_request_token(payload, maximum_length=96)
    if not batch_token:
        raise ValueError("Для набора нужен корректный идентификатор запроса.")

    combined: dict[int, float] = {}
    for item in raw_items:
        try:
            product_id = parse_integer(item.get("product_id"), "идентификатор продукта")
            quantity = parse_number(item.get("quantity", 1), "количество")
        except (TypeError, ValueError, AttributeError) as error:
            raise ValueError("Некорректная строка набора.") from error

        if quantity <= 0 or not quantity.is_integer():
            raise ValueError("Финишер добавляет только целые стандартные порции.")
        combined[product_id] = combined.get(product_id, 0) + quantity

    if sum(combined.values()) > 6:
        raise ValueError("В одном наборе допускается не больше 6 порций.")

    return combined, batch_token, payload.get("meal_type")


def validate_day_update_payload(payload: dict, current: sqlite3.Row) -> dict:
    watch_value = payload.get("watch_active_kcal", current["watch_active_kcal"])
    watch_value = parse_number(watch_value, "активные калории с часов", optional=True)
    if watch_value is not None:
        watch_value = max(0.0, watch_value)

    return {
        "day_type": payload.get("day_type", current["day_type"]),
        "base_tdee": parse_number(payload.get("base_tdee", current["base_tdee"]), "базовый TDEE"),
        "goal_delta": parse_number(payload.get("goal_delta", current["goal_delta"]), "целевую дельту"),
        "steps": parse_integer(payload.get("steps", current["steps"]), "шаги"),
        "step_cadence": parse_number(payload.get("step_cadence", current["step_cadence"]), "каденс"),
        "watch_active_kcal": watch_value,
        "cardio_kcal": parse_number(payload.get("cardio_kcal", current["cardio_kcal"]), "калории кардио"),
        "manual_adjustment": parse_number(payload.get("manual_adjustment", current["manual_adjustment"]), "ручную поправку"),
        "note": payload.get("note", current["note"] or ""),
    }


def validate_sleep_payload(payload: dict) -> dict:
    start = (payload.get("start") or "").strip() or None
    end = (payload.get("end") or "").strip() or None
    if bool(start) != bool(end):
        raise ValueError("Укажи и время засыпания, и время подъёма.")

    try:
        if start:
            datetime.strptime(start, "%H:%M")
            datetime.strptime(end, "%H:%M")
        deep_percent = parse_optional_percentage(payload.get("deep_percent"))
        rem_percent = parse_optional_percentage(payload.get("rem_percent"))
    except (TypeError, ValueError) as error:
        raise ValueError("Проверь время и проценты фаз сна.") from error

    if any(
        value is not None and not 0 <= value <= 100
        for value in (deep_percent, rem_percent)
    ):
        raise ValueError("Процент сна должен быть от 0 до 100.")

    return {
        "start": start,
        "end": end,
        "deep_percent": deep_percent,
        "rem_percent": rem_percent,
    }


def parse_optional_percentage(value: object) -> float | None:
    return parse_number(value, "процент", optional=True)
