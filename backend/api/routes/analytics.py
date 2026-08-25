from __future__ import annotations

from datetime import date, timedelta

from flask import Blueprint, jsonify, request

from backend.services.analytics import (
    add_measurement,
    get_progress,
    get_report,
    get_statistics,
    get_weight_trend,
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

    return jsonify(progress)
