from __future__ import annotations

import argparse
import os
import sys
import tempfile
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Изолированный сервер Playwright")
    parser.add_argument("--port", type=int, required=True)
    return parser.parse_args()


def configure_test_environment(root: Path) -> None:
    os.environ.update(
        {
            "CEO_BODY_DATA_DIR": str(root / "data"),
            "CEO_BODY_DATABASE_PATH": str(root / "data" / "ceo_body_e2e.db"),
            "CEO_BODY_UPLOAD_DIR": str(root / "uploads"),
            "CEO_BODY_BACKUP_DIR": str(root / "backups"),
        }
    )


def create_ready_day(application, log_date: str, product_id: int) -> None:
    from backend.services.days import add_food_entry, setup_day

    day = application.get_or_create_day(log_date)
    setup_day(
        day["id"],
        {"training_planned": True, "day_type": "Тестовый шаблон A"},
    )
    add_food_entry(
        day["id"],
        {
            "product_id": product_id,
            "quantity": 1,
            "quantity_mode": "serving",
            "meal_type": "Завтрак",
            "request_token": f"e2e-{log_date}",
        },
    )
    return day


def main() -> None:
    arguments = parse_arguments()
    with tempfile.TemporaryDirectory(prefix="ceo-body-e2e-") as temporary_directory:
        configure_test_environment(Path(temporary_directory))

        from backend import application
        from backend.services.workout_operations import add_exercise_block, create_workout
        from tests.fixtures import create_test_data

        application.init_db()
        create_test_data(application.db)
        application.migrate_exercise_subgroups()
        with application.db() as connection:
            product_id = connection.execute(
                "SELECT id FROM products ORDER BY id LIMIT 1"
            ).fetchone()["id"]
            template_id = connection.execute(
                "SELECT id FROM workout_templates ORDER BY sort_order, id LIMIT 1"
            ).fetchone()["id"]
            subgroup_id = connection.execute(
                "SELECT id FROM exercise_subgroups WHERE template_id=? AND active=1 ORDER BY sort_order, id LIMIT 1",
                (template_id,),
            ).fetchone()["id"]
            exercise_id = connection.execute(
                "SELECT id FROM exercise_catalog ORDER BY id LIMIT 1"
            ).fetchone()["id"]
            connection.execute(
                """INSERT INTO exercise_catalog(
                       name, muscle_group, muscle_profile, created_at
                   ) VALUES (?, ?, ?, ?)""",
                (
                    "Тестовое дополнительное упражнение",
                    "Тестовый шаблон A",
                    '{"primary": ["тестовая группа"], "secondary": []}',
                    "2030-01-01T00:00:00",
                ),
            )
            connection.execute(
                """INSERT INTO workout_template_exercises(
                       template_id, exercise_name, subgroup_id, sort_order
                   ) VALUES (?, ?, ?, ?)""",
                (template_id, "Тестовое дополнительное упражнение", subgroup_id, 2),
            )

        for log_date in ("2035-07-25", "2035-07-27", "2035-07-31", "2030-01-01"):
            create_ready_day(application, log_date, product_id)

        workout = create_workout(
            application.get_or_create_day("2030-01-01")["id"],
            {"template_id": template_id},
        )["workout"]
        add_exercise_block(
            workout["id"],
            {"exercise_id": exercise_id, "set_count": 3},
        )
        application.app.run(host="127.0.0.1", port=arguments.port, debug=False)


if __name__ == "__main__":
    main()
