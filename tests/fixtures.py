import json


TEST_SETTINGS = {
    "phase": "Тестовый режим",
    "base_tdee": "2345",
    "protein_min": "111",
    "protein_max": "149",
    "goal_delta": "-321",
    "global_balance": "0",
    "step_cadence": "100",
}

TEST_TEMPLATES = (
    ("Тестовый шаблон A", "Тестовое упражнение A", 10),
    ("Тестовый шаблон B", "Тестовое упражнение B", 20),
    ("Тестовый шаблон C", "Тестовое упражнение C", 30),
)
FIXTURE_CREATED_AT = "2030-01-01T00:00:00"


def create_test_data(connect) -> None:
    created_at = FIXTURE_CREATED_AT
    with connect() as connection:
        connection.executemany(
            "INSERT INTO settings(key, value) VALUES (?, ?)",
            TEST_SETTINGS.items(),
        )
        connection.execute(
            """INSERT INTO strategy_versions(
                   effective_from, phase, base_tdee, protein_min, protein_max,
                   goal_delta, note, created_at
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            ("0001-01-01", "Тестовый режим", 2345, 111, 149, -321, "Test fixture", created_at),
        )
        connection.execute(
            "INSERT INTO measurements(measured_on, weight) VALUES (?, ?)",
            ("2030-01-01", 74),
        )
        connection.execute(
            """INSERT INTO product_categories(name, icon_key, color, sort_order)
               VALUES (?, ?, ?, ?)""",
            ("Тестовая категория", "utensils", "#6d5dfc", 10),
        )
        connection.execute(
            """INSERT INTO products(
                   name, brand, category, serving_label, serving_grams, serving_units,
                   unit_name, kcal, protein, fat, carbs, created_at
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            ("Тестовый продукт", "", "Тестовая категория", "100 г", 100, 1, "порция", 200, 20, 5, 10, created_at),
        )
        connection.execute(
            """INSERT INTO products(
                   name, brand, category, serving_label, serving_grams, serving_units,
                   unit_name, kcal, protein, fat, carbs, created_at
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            ("Тестовый протеин", "", "Тестовая категория", "100 г", 100, 1, "порция", 150, 40, 1, 5, created_at),
        )
        connection.executemany(
            """INSERT INTO products(
                   name, brand, category, serving_label, serving_grams, serving_units,
                   unit_name, kcal, protein, fat, carbs, created_at
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            [
                (
                    f"Тестовый перекус {index}",
                    "",
                    "Тестовая категория",
                    "100 г",
                    100,
                    1,
                    "порция",
                    100 + index,
                    10,
                    2,
                    8,
                    created_at,
                )
                for index in range(1, 10)
            ],
        )
        for template_name, exercise_name, sort_order in TEST_TEMPLATES:
            cursor = connection.execute(
                """INSERT INTO workout_templates(
                       name, default_duration_minutes, default_intensity_met, sort_order
                   ) VALUES (?, ?, ?, ?)""",
                (template_name, 75, 3.5, sort_order),
            )
            template_id = cursor.lastrowid
            connection.execute(
                """INSERT INTO exercise_catalog(name, muscle_group, muscle_profile, created_at)
                   VALUES (?, ?, ?, ?)""",
                (
                    exercise_name,
                    template_name,
                    json.dumps({"primary": ["тестовая группа"], "secondary": []}, ensure_ascii=False),
                    created_at,
                ),
            )
            connection.execute(
                """INSERT INTO workout_template_exercises(template_id, exercise_name, sort_order)
                   VALUES (?, ?, ?)""",
                (template_id, exercise_name, 1),
            )
