from __future__ import annotations

import sqlite3
from datetime import date, datetime

from backend.database.sql_commands.analytics import AnalyticsRepository
from backend.services.runtime import db, parse_number


class StrategyVersionAlreadyExistsError(Exception):
    pass


def validate_strategy_payload(payload: dict) -> dict:
    effective_from = str(
        payload.get("effective_from") or date.today().isoformat()
    ).strip()
    try:
        date.fromisoformat(effective_from)
    except ValueError as error:
        raise ValueError("Дата начала должна быть в формате ГГГГ-ММ-ДД.") from error

    phase = str(payload.get("phase") or "").strip()
    base_tdee = parse_number(payload.get("base_tdee"), "базовый TDEE")
    protein_min = parse_number(payload.get("protein_min"), "минимум белка")
    protein_max = parse_number(payload.get("protein_max"), "максимум белка")
    goal_delta = parse_number(payload.get("goal_delta"), "целевую дельту")
    if not phase:
        raise ValueError("Укажи название фазы.")
    if not 1200 <= base_tdee <= 4000:
        raise ValueError("Базовый TDEE должен быть от 1200 до 4000 ккал.")
    if not 50 <= protein_min <= 300 or not protein_min <= protein_max <= 350:
        raise ValueError(
            "Проверь белковый коридор: минимум 50 г, максимум не ниже минимума."
        )
    if not -1500 <= goal_delta <= 1000:
        raise ValueError("Целевая дельта должна быть от −1500 до +1000 ккал.")

    return {
        "effective_from": effective_from,
        "phase": phase,
        "base_tdee": base_tdee,
        "protein_min": protein_min,
        "protein_max": protein_max,
        "goal_delta": goal_delta,
        "note": str(payload.get("note") or "").strip(),
    }


def create_strategy_version(payload: dict) -> None:
    validated_strategy = validate_strategy_payload(payload)

    try:
        with db() as connection:
            AnalyticsRepository(connection).create_strategy_version(
                validated_strategy,
                datetime.now().isoformat(timespec="seconds"),
            )
    except sqlite3.IntegrityError as error:
        raise StrategyVersionAlreadyExistsError from error


def validate_date_range(start: str, end: str) -> tuple[date, date]:
    try:
        start_date = date.fromisoformat(start)
        end_date = date.fromisoformat(end)
    except ValueError as error:
        raise ValueError("Даты должны быть в формате ГГГГ-ММ-ДД.") from error
    if start_date > end_date:
        raise ValueError("Начальная дата не может быть позже конечной.")
    return start_date, end_date


def measurement_values_from_payload(
    payload: dict,
) -> tuple[str, list[str], list[float | None], str]:
    measured_on = payload.get("measured_on") or date.today().isoformat()
    try:
        date.fromisoformat(measured_on)
    except (TypeError, ValueError) as error:
        raise ValueError("Дата замера должна быть в формате ГГГГ-ММ-ДД.") from error

    fields = [
        "weight",
        "waist",
        "belly",
        "shoulders",
        "biceps",
        "chest",
        "hips",
        "thigh",
    ]
    values = [parse_number(payload.get(field), field, optional=True) for field in fields]
    if not any(value is not None for value in values):
        raise ValueError("Укажи хотя бы один замер.")
    if any(value is not None and value < 0 for value in values):
        raise ValueError("Значения замеров не могут быть отрицательными.")
    return measured_on, fields, values, str(payload.get("note") or "").strip()


def get_strategy_overview() -> dict:
    today = date.today().isoformat()

    with db() as connection:
        versions, active, existing_days = AnalyticsRepository(
            connection
        ).get_strategy_overview(today)

    return {
        "today": today,
        "active": dict(active) if active else None,
        "versions": [dict(row) for row in versions],
        "existing_days_from_today": existing_days,
    }
