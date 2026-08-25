from __future__ import annotations

from flask import Blueprint, jsonify, render_template

page_routes = Blueprint("pages", __name__)


@page_routes.get("/")
@page_routes.get("/<path:page_path>")
def react_application(page_path: str = ""):
    if page_path.startswith("api/"):
        return jsonify({"error": "API endpoint not found."}), 404

    return render_template("react_app.html")
