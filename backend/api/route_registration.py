from backend.api.routes.analytics import analytics_routes
from backend.api.routes.backups import backup_routes
from backend.api.routes.days import day_routes
from backend.api.routes.pages import page_routes
from backend.api.routes.products import product_routes
from backend.api.routes.reminders import reminder_routes
from backend.api.routes.workouts import workout_routes


def register_routes(app) -> None:
    routes = (
        page_routes,
        backup_routes,
        day_routes,
        product_routes,
        workout_routes,
        analytics_routes,
        reminder_routes,
    )
    for route_group in routes:
        app.register_blueprint(route_group)
