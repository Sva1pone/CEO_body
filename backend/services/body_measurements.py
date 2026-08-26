from __future__ import annotations

import re
from datetime import date, datetime

from backend.database.sql_commands.body_measurements import BodyMeasurementRepository
from backend.services.runtime import db, parse_integer, parse_number


class MeasurementConflictError(Exception):
    pass


def get_body_measurement_fields(include_archived: bool = False) -> list[dict]:
    with db() as connection:
        fields = BodyMeasurementRepository(connection).fields(include_archived)
    return [_serialize_field(field) for field in fields]


def create_body_measurement_field(payload: dict) -> dict:
    name = _field_name(payload.get("name"))
    sort_order = parse_integer(payload.get("sort_order", 100), "порядок поля")
    with db() as connection:
        connection.execute("BEGIN IMMEDIATE")
        repository = BodyMeasurementRepository(connection)
        slug = _available_slug(repository, name)
        field = repository.create_field(
            name, slug, sort_order, datetime.now().isoformat(timespec="seconds")
        )
    return _serialize_field(field)


def update_body_measurement_field(field_id: int, payload: dict) -> dict:
    with db() as connection:
        connection.execute("BEGIN IMMEDIATE")
        repository = BodyMeasurementRepository(connection)
        existing = repository.field_by_id(field_id)
        if not existing:
            raise LookupError("Часть тела не найдена.")
        name = _field_name(payload.get("name", existing["name"]))
        sort_order = parse_integer(
            payload.get("sort_order", existing["sort_order"]), "порядок поля"
        )
        active = _parse_active(payload.get("active", existing["active"]))
        field = repository.update_field(field_id, name, sort_order, active)
    return _serialize_field(field)


def get_measurements() -> list[dict]:
    with db() as connection:
        repository = BodyMeasurementRepository(connection)
        rows = repository.measurements()
        return _serialize_measurements(repository, rows)


def serialize_measurement(connection, row) -> dict | None:
    if not row:
        return None
    repository = BodyMeasurementRepository(connection)
    return _serialize_measurements(repository, [row])[0]


def save_tape_measurement(payload: dict, measurement_id: int | None = None) -> dict:
    with db() as connection:
        repository = BodyMeasurementRepository(connection)
        existing = repository.measurement_by_id(measurement_id) if measurement_id else None
        if measurement_id is not None and not existing:
            raise LookupError("Замер не найден.")
        measured_on = _measurement_date(
            payload, existing["measured_on"] if existing else None
        )
        note = str(
            payload.get("note", existing["note"] if existing else "") or ""
        ).strip()
        values = _tape_values(repository, payload)
        if measurement_id is None and not any(value is not None for value in values.values()):
            raise ValueError("Укажи хотя бы один сантиметровый замер.")
        target = _resolve_target(
            repository, measured_on, ("tape", "mixed"), measurement_id
        )
        if target:
            record_type = "mixed" if target["weight"] is not None else "tape"
            repository.update_measurement(
                target["id"], measured_on, record_type, target["weight"], note
            )
            target_id = target["id"]
        else:
            target_id = repository.create_measurement(measured_on, "tape", None, note)
        repository.set_values(target_id, values)
        row = repository.measurement_by_id(target_id)
        return _serialize_measurements(repository, [row])[0]


def save_weight_measurement(payload: dict, measurement_id: int | None = None) -> dict:
    with db() as connection:
        repository = BodyMeasurementRepository(connection)
        existing = repository.measurement_by_id(measurement_id) if measurement_id else None
        if measurement_id is not None and not existing:
            raise LookupError("Замер не найден.")
        measured_on = _measurement_date(
            payload, existing["measured_on"] if existing else None
        )
        weight = parse_number(
            payload.get("weight", existing["weight"] if existing else None), "вес"
        )
        if weight <= 0:
            raise ValueError("Вес должен быть больше нуля.")
        note = str(
            payload.get("note", existing["note"] if existing else "") or ""
        ).strip()
        target = _resolve_target(
            repository, measured_on, ("weight", "mixed"), measurement_id
        )
        if target:
            has_tape_values = bool(repository.values_for_measurements([target["id"]]))
            record_type = "mixed" if has_tape_values else "weight"
            repository.update_measurement(
                target["id"], measured_on, record_type, weight, note
            )
            target_id = target["id"]
        else:
            target_id = repository.create_measurement(measured_on, "weight", weight, note)
        row = repository.measurement_by_id(target_id)
        return _serialize_measurements(repository, [row])[0]


def save_legacy_measurement(payload: dict) -> None:
    has_weight = payload.get("weight") not in (None, "")
    with db() as connection:
        connection.execute("BEGIN IMMEDIATE")
        repository = BodyMeasurementRepository(connection)
        dynamic_values = _tape_values(repository, payload)
        has_tape = any(value is not None for value in dynamic_values.values())
        if not has_weight and not has_tape:
            raise ValueError("Укажи хотя бы один замер.")
        measured_on = _measurement_date(payload)
        note = str(payload.get("note") or "").strip()
        if not has_weight:
            target = _resolve_target(repository, measured_on, ("tape", "mixed"), None)
            if target:
                record_type = "mixed" if target["weight"] is not None else "tape"
                repository.update_measurement(
                    target["id"], measured_on, record_type, target["weight"], note
                )
                measurement_id = target["id"]
            else:
                measurement_id = repository.create_measurement(
                    measured_on, "tape", None, note
                )
            repository.set_values(measurement_id, dynamic_values)
            return

        weight = parse_number(payload.get("weight"), "вес")
        if weight <= 0:
            raise ValueError("Вес должен быть больше нуля.")
        if not has_tape:
            target = _resolve_target(
                repository, measured_on, ("weight", "mixed"), None
            )
            if target:
                has_values = bool(repository.values_for_measurements([target["id"]]))
                repository.update_measurement(
                    target["id"],
                    measured_on,
                    "mixed" if has_values else "weight",
                    weight,
                    note,
                )
            else:
                repository.create_measurement(measured_on, "weight", weight, note)
            return

        candidates = repository.matching_measurements(
            measured_on, ("weight", "tape", "mixed")
        )
        if len(candidates) > 1:
            raise MeasurementConflictError(
                "На эту дату найдено несколько исторических записей. Они не объединены автоматически."
            )
        if candidates:
            measurement_id = candidates[0]["id"]
            repository.update_measurement(
                measurement_id, measured_on, "mixed", weight, note
            )
        else:
            measurement_id = repository.create_measurement(
                measured_on, "mixed", weight, note
            )
        repository.set_values(measurement_id, dynamic_values)


def _resolve_target(repository, measured_on, record_types, measurement_id):
    if measurement_id is not None:
        target = repository.measurement_by_id(measurement_id)
        if not target:
            raise LookupError("Замер не найден.")
        conflicts = repository.matching_measurements(
            measured_on, record_types, excluded_id=measurement_id
        )
        if conflicts:
            raise MeasurementConflictError(
                "На эту дату уже есть запись такого вида. Выбери существующую запись."
            )
        return target
    matches = repository.matching_measurements(measured_on, record_types)
    if len(matches) > 1:
        raise MeasurementConflictError(
            "На эту дату найдено несколько исторических записей такого вида. Они не объединены автоматически."
        )
    return matches[0] if matches else None


def _tape_values(repository, payload: dict) -> dict[int, float | None]:
    raw_values = payload.get("values")
    if raw_values is None:
        raw_values = {
            field["slug"]: payload.get(field["slug"])
            for field in repository.fields(include_archived=True)
            if field["slug"] in payload
        }
    if not isinstance(raw_values, dict):
        raise ValueError("Значения сантиметровых замеров должны быть объектом.")
    values = {}
    for slug, raw_value in raw_values.items():
        field = repository.field_by_slug(str(slug))
        if not field:
            raise ValueError(f"Неизвестное поле замера: {slug}.")
        value = parse_number(raw_value, field["name"], optional=True)
        if value is not None and value < 0:
            raise ValueError("Значения замеров не могут быть отрицательными.")
        values[field["id"]] = value
    return values


def _serialize_measurements(repository, rows) -> list[dict]:
    values = repository.values_for_measurements([row["id"] for row in rows])
    values_by_measurement: dict[int, dict] = {}
    for value in values:
        values_by_measurement.setdefault(value["measurement_id"], {})[value["slug"]] = value["value"]
    result = []
    for row in rows:
        item = dict(row)
        item["values"] = values_by_measurement.get(row["id"], {})
        for slug, value in item["values"].items():
            item[slug] = value
        result.append(item)
    return result


def _measurement_date(payload: dict, fallback: str | None = None) -> str:
    measured_on = payload.get("measured_on") or fallback or date.today().isoformat()
    try:
        return date.fromisoformat(str(measured_on)).isoformat()
    except ValueError as error:
        raise ValueError("Дата замера должна быть в формате ГГГГ-ММ-ДД.") from error


def _field_name(value) -> str:
    name = str(value or "").strip()
    if not name:
        raise ValueError("Укажи название части тела.")
    if len(name) > 80:
        raise ValueError("Название части тела не должно быть длиннее 80 символов.")
    return name


def _available_slug(repository, name: str) -> str:
    base = re.sub(r"[^\w]+", "-", name.casefold(), flags=re.UNICODE).strip("-") or "field"
    slug = base
    suffix = 2
    while repository.field_by_slug(slug):
        slug = f"{base}-{suffix}"
        suffix += 1
    return slug


def _parse_active(value) -> bool:
    if value in (True, 1, "1"):
        return True
    if value in (False, 0, "0"):
        return False
    raise ValueError("Статус поля должен быть логическим значением.")


def _serialize_field(field) -> dict:
    payload = dict(field)
    payload["active"] = bool(payload["active"])
    return payload
