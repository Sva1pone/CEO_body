from __future__ import annotations

from flask import Blueprint, jsonify, render_template

page_routes = Blueprint("pages", __name__)


@page_routes.get("/")
def home():
    return render_template("react_app.html")


@page_routes.get("/registry")
def registry():
    return render_template("react_app.html")


@page_routes.get("/exercises")
def exercises():
    return render_template("react_app.html")


@page_routes.get("/workout/<int:workout_id>")
def workout(workout_id: int):
    return render_template("react_app.html")


@page_routes.get("/report")
def report():
    return render_template("react_app.html")


@page_routes.get("/progress")
def progress():
    return render_template("react_app.html")


@page_routes.get("/statistics")
def statistics():
    return render_template("react_app.html")


@page_routes.get("/settings")
def settings():
    return render_template("react_app.html")


@page_routes.get("/<path:page_path>")
def unknown_page(page_path: str):
    if page_path.startswith("api/"):
        return jsonify({"error": "API endpoint not found."}), 404

    return render_template("react_app.html")
