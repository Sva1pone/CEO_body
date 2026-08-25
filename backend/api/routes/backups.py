from pathlib import Path

from flask import Blueprint, jsonify, send_file

from backend.config import BACKUP_DIR
from backend.database.backups import ManualBackupLimitError, find_backup
from backend.services.runtime import create_manual_database_backup, serialize_backups

backup_routes = Blueprint("backups", __name__)


@backup_routes.get("/api/backups")
def get_backups():
    return jsonify({"backups": serialize_backups()})


@backup_routes.post("/api/backups")
def create_backup_file():
    try:
        backup = create_manual_database_backup()
    except ManualBackupLimitError as error:
        return jsonify({"error": str(error)}), 429
    return jsonify({"backup": backup, "backups": serialize_backups()}), 201


@backup_routes.get("/api/backups/<filename>/download")
def download_backup(filename: str):
    if Path(filename).name != filename:
        return jsonify({"error": "Резервная копия не найдена."}), 404
    path = find_backup(BACKUP_DIR, filename)
    if path is None:
        return jsonify({"error": "Резервная копия не найдена."}), 404
    return send_file(
        path,
        as_attachment=True,
        download_name=filename,
        mimetype="application/x-sqlite3",
    )
