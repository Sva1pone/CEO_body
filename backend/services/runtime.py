from __future__ import annotations

import sqlite3
from math import isfinite
from datetime import datetime

from backend.config import BACKUP_DIR, DATABASE_PATH, DATA_DIR, MANUAL_BACKUP_COOLDOWN_SECONDS, MANUAL_BACKUP_MAX_FILES, PROJECT_ROOT, UPLOAD_DIR
from backend.database.backups import create_backup, list_backups, validate_manual_backup_creation
from backend.database.connection import connect

ROOT = PROJECT_ROOT
DB_PATH = DATABASE_PATH
DEFAULTS = {}


def db():
    return connect(DB_PATH)


def create_database_backup(reason: str = "manual") -> dict:
    return create_backup(DB_PATH, BACKUP_DIR, reason)


def create_manual_database_backup() -> dict:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    validate_manual_backup_creation(
        BACKUP_DIR,
        MANUAL_BACKUP_COOLDOWN_SECONDS,
        MANUAL_BACKUP_MAX_FILES,
    )
    return create_backup(DB_PATH, BACKUP_DIR, "manual")


def serialize_backups() -> list[dict]:
    return list_backups(BACKUP_DIR)


def as_float(value: str | None, fallback: float = 0.0) -> float:
    try:
        return float((value or "").replace(",", "."))
    except ValueError:
        return fallback


def parse_number(value: object, field_name: str, *, optional: bool = False) -> float | None:
    if value in (None, ""):
        if optional:
            return None
        raise ValueError(f"Укажи {field_name}.")
    if isinstance(value, bool):
        raise ValueError(f"Проверь {field_name}.")
    try:
        number = float(str(value).strip().replace(",", "."))
    except (TypeError, ValueError) as error:
        raise ValueError(f"Проверь {field_name}.") from error
    if not isfinite(number):
        raise ValueError(f"Проверь {field_name}.")
    return number


def parse_integer(value: object, field_name: str, *, optional: bool = False) -> int | None:
    number = parse_number(value, field_name, optional=optional)
    if number is None:
        return None
    if not number.is_integer():
        raise ValueError(f"{field_name.capitalize()} должно быть целым числом.")
    return int(number)


def serialize_sleep(day: sqlite3.Row | dict) -> dict:
    start = day["sleep_start"]
    end = day["sleep_end"]
    duration_minutes = None
    if start and end:
        start_time = datetime.strptime(start, "%H:%M")
        end_time = datetime.strptime(end, "%H:%M")
        duration_minutes = int((end_time - start_time).total_seconds() // 60)
        if duration_minutes <= 0:
            duration_minutes += 24 * 60
    return {
        "start": start,
        "end": end,
        "deep_percent": day["sleep_deep_percent"],
        "rem_percent": day["sleep_rem_percent"],
        "duration_minutes": duration_minutes,
        "has_data": any(
            (
                start,
                end,
                day["sleep_deep_percent"] is not None,
                day["sleep_rem_percent"] is not None,
            )
        ),
    }
