from __future__ import annotations

import io
from datetime import datetime

from flask import Blueprint, jsonify, request, send_file

from backend.services.exercise_packs import (
    build_exercise_pack,
    import_exercise_pack,
    preview_exercise_pack,
)

from backend.services.workout_operations import (
    WorkoutConflictError,
    WorkoutResourceNotFoundError,
    add_exercise_block,
    add_workout_set,
    archive_exercise,
    create_cardio_session,
    create_exercise,
    create_exercise_subgroup,
    create_workout,
    delete_cardio_session,
    delete_exercise_block,
    delete_exercise_subgroup,
    delete_workout_set,
    get_workout_templates,
    move_exercise,
    place_exercise,
    replace_exercise_image,
    update_cardio_session,
    update_exercise,
    update_exercise_subgroup,
    update_workout,
    update_workout_set,
)
from backend.services.workouts import WorkoutNotFoundError, get_exercise_catalog, get_workout_details

workout_routes = Blueprint("workouts", __name__)


def error_response(error: Exception, status_code: int):
    return jsonify({"error": str(error)}), status_code


def run_workout_operation(operation, *arguments, success_status: int = 200):
    try:
        result = operation(*arguments)
    except ValueError as error:
        return error_response(error, 400)
    except WorkoutResourceNotFoundError as error:
        return error_response(error, 404)
    except WorkoutConflictError as error:
        return error_response(error, 409)

    return jsonify(result), success_status


@workout_routes.get("/api/workout/<int:workout_id>")
def api_workout_detail(workout_id: int):
    try:
        return jsonify(get_workout_details(workout_id))
    except WorkoutNotFoundError as error:
        return error_response(error, 404)


@workout_routes.post("/api/workout/<int:workout_id>/cardio")
def api_create_cardio(workout_id: int):
    payload = request.get_json(silent=True) or {}

    return run_workout_operation(
        create_cardio_session,
        workout_id,
        payload,
        success_status=201,
    )


@workout_routes.patch("/api/cardio/<int:session_id>")
def api_update_cardio(session_id: int):
    payload = request.get_json(silent=True) or {}

    return run_workout_operation(update_cardio_session, session_id, payload)


@workout_routes.delete("/api/cardio/<int:session_id>")
def api_delete_cardio(session_id: int):
    return run_workout_operation(delete_cardio_session, session_id)


@workout_routes.get("/api/workout/templates")
def api_workout_templates():
    return jsonify(get_workout_templates())


@workout_routes.get("/api/exercises")
def api_exercise_catalog():
    return jsonify(get_exercise_catalog())


@workout_routes.post("/api/exercise-packs/export")
def api_export_exercise_pack():
    payload = request.get_json(silent=True) or {}
    try:
        content, _ = build_exercise_pack(
            payload.get("selection"),
            bool(payload.get("include_images")),
        )
    except ValueError as error:
        return error_response(error, 400)
    filename = f"ceo-body-exercises-{datetime.now():%Y-%m-%d}.ceopack.zip"
    return send_file(
        io.BytesIO(content),
        mimetype="application/zip",
        as_attachment=True,
        download_name=filename,
    )


@workout_routes.post("/api/exercise-packs/summary")
def api_exercise_pack_summary():
    payload = request.get_json(silent=True) or {}
    try:
        _, summary = build_exercise_pack(
            payload.get("selection"),
            bool(payload.get("include_images")),
        )
    except ValueError as error:
        return error_response(error, 400)
    return jsonify(summary)


@workout_routes.post("/api/exercise-packs/preview")
def api_preview_exercise_pack():
    try:
        return jsonify(preview_exercise_pack(request.files.get("pack")))
    except ValueError as error:
        return error_response(error, 400)


@workout_routes.post("/api/exercise-packs/import")
def api_import_exercise_pack():
    try:
        result = import_exercise_pack(
            request.files.get("pack"),
            (request.form.get("policy") or "").strip(),
        )
    except ValueError as error:
        return error_response(error, 400)
    return jsonify(result)


@workout_routes.post("/api/exercises")
def api_create_exercise():
    payload = request.get_json(silent=True) or {}

    return run_workout_operation(
        create_exercise,
        payload,
        success_status=201,
    )


@workout_routes.post("/api/exercises/<int:exercise_id>/image")
def api_update_exercise_image(exercise_id: int):
    image = request.files.get("image")

    return run_workout_operation(replace_exercise_image, exercise_id, image)


@workout_routes.patch("/api/exercises/<int:exercise_id>")
def api_update_exercise(exercise_id: int):
    payload = request.get_json(silent=True) or {}

    return run_workout_operation(update_exercise, exercise_id, payload)


@workout_routes.post("/api/exercise-subgroups")
def api_create_exercise_subgroup():
    payload = request.get_json(silent=True) or {}

    return run_workout_operation(
        create_exercise_subgroup,
        payload,
        success_status=201,
    )


@workout_routes.patch("/api/exercise-subgroups/<int:subgroup_id>")
def api_update_exercise_subgroup(subgroup_id: int):
    payload = request.get_json(silent=True) or {}

    return run_workout_operation(update_exercise_subgroup, subgroup_id, payload)


@workout_routes.delete("/api/exercise-subgroups/<int:subgroup_id>")
def api_delete_exercise_subgroup(subgroup_id: int):
    payload = request.get_json(silent=True) or {}

    return run_workout_operation(delete_exercise_subgroup, subgroup_id, payload)


@workout_routes.patch("/api/exercises/<int:exercise_id>/placement")
def api_place_exercise(exercise_id: int):
    payload = request.get_json(silent=True) or {}

    return run_workout_operation(place_exercise, exercise_id, payload)


@workout_routes.patch("/api/exercises/<int:exercise_id>/position")
def api_move_exercise(exercise_id: int):
    payload = request.get_json(silent=True) or {}

    return run_workout_operation(move_exercise, exercise_id, payload)


@workout_routes.delete("/api/exercises/<int:exercise_id>")
def api_archive_exercise(exercise_id: int):
    return run_workout_operation(archive_exercise, exercise_id)


@workout_routes.post("/api/day/<int:day_id>/workout")
def api_create_workout(day_id: int):
    payload = request.get_json(silent=True) or {}

    return run_workout_operation(
        create_workout,
        day_id,
        payload,
        success_status=201,
    )


@workout_routes.post("/api/workout/<int:workout_id>/set")
def api_add_workout_set(workout_id: int):
    payload = request.get_json(silent=True) or {}

    return run_workout_operation(
        add_workout_set,
        workout_id,
        payload,
        success_status=201,
    )


@workout_routes.post("/api/workout/<int:workout_id>/exercise")
def api_add_exercise_block(workout_id: int):
    payload = request.get_json(silent=True) or {}

    return run_workout_operation(
        add_exercise_block,
        workout_id,
        payload,
        success_status=201,
    )


@workout_routes.patch("/api/workout/set/<int:set_id>")
def api_update_workout_set(set_id: int):
    payload = request.get_json(silent=True) or {}

    return run_workout_operation(update_workout_set, set_id, payload)


@workout_routes.delete("/api/workout/set/<int:set_id>")
def api_delete_workout_set(set_id: int):
    return run_workout_operation(delete_workout_set, set_id)


@workout_routes.delete("/api/workout/<int:workout_id>/exercise")
def api_delete_exercise_block(workout_id: int):
    payload = request.get_json(silent=True) or {}

    return run_workout_operation(delete_exercise_block, workout_id, payload)


@workout_routes.patch("/api/workout/<int:workout_id>")
def api_update_workout(workout_id: int):
    payload = request.get_json(silent=True) or {}

    return run_workout_operation(update_workout, workout_id, payload)
