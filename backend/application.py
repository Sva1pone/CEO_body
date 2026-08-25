from __future__ import annotations

import mimetypes

from flask import Flask, jsonify, request

from backend import config
from backend.api.route_registration import register_routes
from backend.services import maintenance
from backend.services import runtime
from backend.services.days import get_or_create_day as load_or_create_day

DB_PATH = config.DATABASE_PATH
UPLOAD_DIR = config.UPLOAD_DIR
BACKUP_DIR = config.BACKUP_DIR

app = Flask(
    __name__,
    template_folder=str(config.PROJECT_ROOT / "templates"),
    static_folder=str(config.PROJECT_ROOT / "static"),
)
app.config["SECRET_KEY"] = config.SECRET_KEY
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024
mimetypes.add_type("application/javascript", ".js")


@app.before_request
def reject_non_object_api_json():
    if not request.path.startswith("/api/") or request.method not in {"POST", "PATCH", "DELETE"}:
        return None
    if not request.is_json:
        return None
    payload = request.get_json(silent=True)
    if payload is not None and not isinstance(payload, dict):
        return jsonify({"error": "JSON-тело запроса должно быть объектом."}), 400
    return None


def _sync_runtime_paths() -> None:
    runtime.DB_PATH = DB_PATH
    runtime.UPLOAD_DIR = UPLOAD_DIR
    runtime.BACKUP_DIR = BACKUP_DIR


def db():
    _sync_runtime_paths()
    return runtime.db()


def init_db() -> None:
    _sync_runtime_paths()
    maintenance.init_db()


def create_database_backup(reason: str = "manual") -> dict:
    _sync_runtime_paths()
    return runtime.create_database_backup(reason)


def migrate_exercise_subgroups() -> None:
    _sync_runtime_paths()
    maintenance.migrate_exercise_subgroups()


def get_or_create_day(log_date: str):
    _sync_runtime_paths()
    return load_or_create_day(log_date)


register_routes(app)
