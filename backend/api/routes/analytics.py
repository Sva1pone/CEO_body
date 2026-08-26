from __future__ import annotations

import sqlite3
from datetime import date, timedelta

from flask import Blueprint, jsonify, request

from backend.services.analytics import (
    add_measurement,
    get_progress,
    get_report,
    get_statistics,
    get_weight_trend,
)
from backend.services.body_measurements import (
    MeasurementConflictError,
    create_body_measurement_field,
    get_body_measurement_fields,
    get_measurements,
    save_tape_measurement,
    save_weight_measurement,
    update_body_measurement_field,
)
from backend.services.strategy import (
    StrategyVersionAlreadyExistsError,
    create_strategy_version,
    get_strategy_overview,
)

analytics_routes = Blueprint("analytics", __name__)


@analytics_routes.get("/api/strategy")
def api_strategy():
    return jsonify(get_strategy_overview())


@analytics_routes.post("/api/strategy")
def api_create_strategy():
    payload = request.get_json(silent=True) or {}

    try:
        create_strategy_version(payload)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except StrategyVersionAlreadyExistsError:
        return (
            jsonify(
                {
                    "error": "На эту дату уже существует версия стратегии. Выбери другую дату."
                }
            ),
            409,
        )

    return jsonify(get_strategy_overview()), 201


@analytics_routes.get("/api/report")
def api_report():
    start = request.args.get("start", date.today().replace(day=1).isoformat())
    end = request.args.get("end", date.today().isoformat())

    try:
        report = get_report(start, end)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    return jsonify(report)


@analytics_routes.get("/api/statistics")
def api_statistics():
    today = date.today()
    start = request.args.get("start", (today - timedelta(days=89)).isoformat())
    end = request.args.get("end", today.isoformat())

    try:
        statistics = get_statistics(start, end)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    return jsonify(statistics)


@analytics_routes.get("/api/weight-trend")
def api_weight_trend():
    today = date.today()
    start = request.args.get("start", (today - timedelta(days=179)).isoformat())
    end = request.args.get("end", today.isoformat())

    try:
        trend = get_weight_trend(start, end)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    return jsonify(trend)


@analytics_routes.get("/api/progress")
def api_progress():
    return jsonify(get_progress())


@analytics_routes.post("/api/progress")
def api_add_measurement():
    payload = request.get_json(silent=True) or {}

    try:
        progress = add_measurement(payload)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except MeasurementConflictError as error:
        return jsonify({"error": str(error)}), 409

    return jsonify(progress)


@analytics_routes.get("/api/measurement-fields")
def api_measurement_fields():
    include_archived = request.args.get("include_archived") in {"1", "true"}
    return jsonify({"fields": get_body_measurement_fields(include_archived)})


@analytics_routes.post("/api/measurement-fields")
def api_create_measurement_field():
    try:
        field = create_body_measurement_field(request.get_json(silent=True) or {})
    except (ValueError, sqlite3.IntegrityError) as error:
        return jsonify({"error": str(error)}), 400
    return jsonify(field), 201


@analytics_routes.patch("/api/measurement-fields/<int:field_id>")
def api_update_measurement_field(field_id: int):
    try:
        field = update_body_measurement_field(
            field_id, request.get_json(silent=True) or {}
        )
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except LookupError as error:
        return jsonify({"error": str(error)}), 404
    return jsonify(field)


@analytics_routes.get("/api/measurements")
def api_measurements():
    return jsonify({"measurements": get_measurements()})


@analytics_routes.post("/api/measurements/tape")
def api_create_tape_measurement():
    return _save_measurement(save_tape_measurement)


@analytics_routes.patch("/api/measurements/tape/<int:measurement_id>")
def api_update_tape_measurement(measurement_id: int):
    return _save_measurement(save_tape_measurement, measurement_id)


@analytics_routes.post("/api/measurements/weight")
def api_create_weight_measurement():
    return _save_measurement(save_weight_measurement)


@analytics_routes.patch("/api/measurements/weight/<int:measurement_id>")
def api_update_weight_measurement(measurement_id: int):
    return _save_measurement(save_weight_measurement, measurement_id)


def _save_measurement(save, measurement_id: int | None = None):
    try:
        measurement = save(
            request.get_json(silent=True) or {}, measurement_id=measurement_id
        )
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except LookupError as error:
        return jsonify({"error": str(error)}), 404
    except MeasurementConflictError as error:
        return jsonify({"error": str(error)}), 409
    return jsonify(measurement)
