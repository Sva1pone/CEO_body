from flask import Blueprint, jsonify

from backend.services.reminders import get_reminders


reminder_routes = Blueprint("reminders", __name__)


@reminder_routes.get("/api/reminders")
def api_reminders():
    return jsonify(get_reminders())
