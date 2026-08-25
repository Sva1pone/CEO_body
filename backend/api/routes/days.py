from __future__ import annotations

from datetime import date

from flask import Blueprint, jsonify, request

from backend.services.days import (
    DayConflictError,
    DayResourceNotFoundError,
    StrategyNotConfiguredError,
    add_food_batch,
    add_food_entry,
    get_day_details,
    close_day,
    delete_day,
    delete_food_entry,
    move_to_meal,
    reopen_day,
    setup_day,
    update_day,
    update_day_sleep,
    update_food_entry,
)

day_routes = Blueprint("days", __name__)


def error_response(error: Exception, status_code: int):
    return jsonify({"error": str(error)}), status_code


def requested_log_date() -> str:
    selected_date = request.args.get("date", date.today().isoformat())
    try:
        parsed_date = date.fromisoformat(selected_date)
    except ValueError as error:
        raise ValueError("Укажи дату в формате YYYY-MM-DD.") from error
    if selected_date != parsed_date.isoformat():
        raise ValueError("Укажи дату в формате YYYY-MM-DD.")
    return selected_date


@day_routes.get("/api/day")
def api_day():
    try:
        return jsonify(get_day_details(requested_log_date()))
    except ValueError as error:
        return error_response(error, 400)
    except StrategyNotConfiguredError as error:
        return error_response(error, 409)


@day_routes.post("/api/day")
def api_materialize_day():
    try:
        return jsonify(get_day_details(requested_log_date(), create=True)), 201
    except ValueError as error:
        return error_response(error, 400)
    except StrategyNotConfiguredError as error:
        return error_response(error, 409)


@day_routes.post("/api/day/<int:day_id>/setup")
def api_setup_day(day_id: int):
    payload = request.get_json(silent=True) or {}

    try:
        day = setup_day(day_id, payload)
    except ValueError as error:
        return error_response(error, 400)
    except DayResourceNotFoundError as error:
        return error_response(error, 404)
    except DayConflictError as error:
        return error_response(error, 409)

    return jsonify(day)


@day_routes.patch("/api/day/<int:day_id>/meal")
def api_move_meal(day_id: int):
    payload = request.get_json(silent=True) or {}

    try:
        day = move_to_meal(day_id, payload)
    except ValueError as error:
        return error_response(error, 400)
    except DayResourceNotFoundError as error:
        return error_response(error, 404)

    return jsonify(day)


@day_routes.post("/api/day/<int:day_id>/food")
def api_add_food(day_id: int):
    payload = request.get_json(silent=True) or {}

    try:
        day = add_food_entry(day_id, payload)
    except ValueError as error:
        return error_response(error, 400)
    except DayResourceNotFoundError as error:
        return error_response(error, 404)
    except DayConflictError as error:
        return error_response(error, 409)

    return jsonify(day)


@day_routes.post("/api/day/<int:day_id>/food/batch")
def api_add_food_batch(day_id: int):
    payload = request.get_json(silent=True) or {}

    try:
        day = add_food_batch(day_id, payload)
    except ValueError as error:
        return error_response(error, 400)
    except DayResourceNotFoundError as error:
        return error_response(error, 404)
    except DayConflictError as error:
        return error_response(error, 409)

    return jsonify(day)


@day_routes.delete("/api/food/<int:entry_id>")
def api_delete_food(entry_id: int):
    try:
        day = delete_food_entry(entry_id)
    except DayResourceNotFoundError as error:
        return error_response(error, 404)
    except DayConflictError as error:
        return error_response(error, 409)

    return jsonify(day)


@day_routes.patch("/api/food/<int:entry_id>")
def api_update_food(entry_id: int):
    payload = request.get_json(silent=True) or {}

    try:
        day = update_food_entry(entry_id, payload)
    except ValueError as error:
        return error_response(error, 400)
    except DayResourceNotFoundError as error:
        return error_response(error, 404)
    except DayConflictError as error:
        return error_response(error, 409)

    return jsonify(day)


@day_routes.patch("/api/day/<int:day_id>")
def api_update_day(day_id: int):
    payload = request.get_json(silent=True) or {}

    try:
        day = update_day(day_id, payload)
    except ValueError as error:
        return error_response(error, 400)
    except DayResourceNotFoundError as error:
        return error_response(error, 404)
    except DayConflictError as error:
        return error_response(error, 409)

    return jsonify(day)


@day_routes.patch("/api/day/<int:day_id>/sleep")
def api_update_sleep(day_id: int):
    payload = request.get_json(silent=True) or {}

    try:
        day = update_day_sleep(day_id, payload)
    except ValueError as error:
        return error_response(error, 400)
    except DayResourceNotFoundError as error:
        return error_response(error, 404)

    return jsonify(day)


@day_routes.post("/api/day/<int:day_id>/close")
def api_close_day(day_id: int):
    try:
        day = close_day(day_id)
    except DayResourceNotFoundError as error:
        return error_response(error, 404)

    return jsonify(day)


@day_routes.post("/api/day/<int:day_id>/reopen")
def api_reopen_day(day_id: int):
    try:
        day = reopen_day(day_id)
    except DayResourceNotFoundError as error:
        return error_response(error, 404)

    return jsonify(day)


@day_routes.delete("/api/day/<int:day_id>")
def api_delete_day(day_id: int):
    payload = request.get_json(silent=True) or {}

    try:
        result = delete_day(day_id, payload)
    except ValueError as error:
        return error_response(error, 400)
    except DayResourceNotFoundError as error:
        return error_response(error, 404)

    return jsonify(result)
