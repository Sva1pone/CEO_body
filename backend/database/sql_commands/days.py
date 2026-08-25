import sqlite3


class DayRepository:
    def __init__(self, connection: sqlite3.Connection):
        self.connection = connection

    def find(self, day_id: int):
        return self.connection.execute(
            "SELECT * FROM days WHERE id=?", (day_id,)
        ).fetchone()

    def find_by_date(self, log_date: str):
        return self.connection.execute(
            "SELECT * FROM days WHERE log_date=?", (log_date,)
        ).fetchone()

    def list_settings(self):
        return self.connection.execute("SELECT key, value FROM settings").fetchall()

    def find_strategy(self, log_date: str):
        return self.connection.execute(
            """SELECT * FROM strategy_versions
               WHERE effective_from <= ?
               ORDER BY effective_from DESC, id DESC LIMIT 1""",
            (log_date,),
        ).fetchone()

    def find_first_strategy(self):
        return self.connection.execute(
            "SELECT * FROM strategy_versions ORDER BY effective_from, id LIMIT 1"
        ).fetchone()

    def create_if_missing(self, day: dict) -> None:
        self.connection.execute(
            """INSERT OR IGNORE INTO days(
                   log_date, day_type, phase, base_tdee, goal_delta, step_cadence,
                   protein_min, protein_max, strategy_version_id
               ) VALUES (?, 'Отдых', ?, ?, ?, ?, ?, ?, ?)""",
            (
                day["log_date"],
                day["phase"],
                day["base_tdee"],
                day["goal_delta"],
                day["step_cadence"],
                day["protein_min"],
                day["protein_max"],
                day["strategy_version_id"],
            ),
        )

    def latest_weight(self):
        return self.connection.execute("""SELECT weight FROM measurements
               WHERE weight IS NOT NULL
               ORDER BY measured_on DESC, id DESC LIMIT 1""").fetchone()

    def list_workout_energy(self, day_id: int):
        return self.connection.execute(
            "SELECT duration_minutes, intensity_met FROM workouts WHERE day_id=?",
            (day_id,),
        ).fetchall()

    def list_food_entries(self, day_id: int):
        return self.connection.execute(
            "SELECT * FROM food_entries WHERE day_id=? ORDER BY id",
            (day_id,),
        ).fetchall()

    def list_closed(self, until: str | None = None):
        if until:
            return self.connection.execute(
                "SELECT * FROM days WHERE closed_at IS NOT NULL AND log_date<=?",
                (until,),
            ).fetchall()
        return self.connection.execute(
            "SELECT * FROM days WHERE closed_at IS NOT NULL"
        ).fetchall()

    def list_detailed_food_entries(self, day_id: int):
        return self.connection.execute(
            """SELECT f.*, p.image_path, p.category, p.benefit_tag, p.benefit_color,
                      p.serving_grams, p.serving_units, p.unit_name, p.package_units,
                      c.icon_key AS category_icon, c.color AS category_color
               FROM food_entries f
               LEFT JOIN products p ON p.id=f.product_id
               LEFT JOIN product_categories c ON c.name=p.category
               WHERE f.day_id=? ORDER BY f.id""",
            (day_id,),
        ).fetchall()

    def list_workouts(self, day_id: int):
        return self.connection.execute(
            "SELECT * FROM workouts WHERE day_id=? ORDER BY id DESC",
            (day_id,),
        ).fetchall()

    def setup(self, day_id: int, training_planned: bool, day_type: str) -> None:
        self.connection.execute(
            "UPDATE days SET setup_done=1, training_planned=?, day_type=? WHERE id=?",
            (int(training_planned), day_type, day_id),
        )

    def set_current_meal(self, day_id: int, meal: str) -> None:
        self.connection.execute(
            "UPDATE days SET current_meal=? WHERE id=?", (meal, day_id)
        )

    def find_food_request(self, request_token: str):
        return self.connection.execute(
            """SELECT day_id, product_id, quantity, quantity_mode
               FROM food_entries WHERE request_token=?""",
            (request_token,),
        ).fetchone()

    def add_food(self, food_entry: dict) -> None:
        self.connection.execute(
            """INSERT INTO food_entries(
                   day_id, product_id, product_name, quantity, quantity_mode,
                   kcal, protein, fat, carbs, meal_type, request_token, created_at
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                food_entry["day_id"],
                food_entry["product_id"],
                food_entry["product_name"],
                food_entry["quantity"],
                food_entry["quantity_mode"],
                food_entry["kcal"],
                food_entry["protein"],
                food_entry["fat"],
                food_entry["carbs"],
                food_entry["meal_type"],
                food_entry["request_token"],
                food_entry["created_at"],
            ),
        )

    def list_active_products(self, product_ids: list[int]):
        placeholders = ",".join("?" for _ in product_ids)
        return self.connection.execute(
            f"SELECT * FROM products WHERE active=1 AND id IN ({placeholders})",
            product_ids,
        ).fetchall()

    def find_food_for_deletion(self, entry_id: int):
        return self.connection.execute(
            """SELECT d.log_date, d.closed_at FROM food_entries f
               JOIN days d ON d.id=f.day_id WHERE f.id=?""",
            (entry_id,),
        ).fetchone()

    def find_food_for_update(self, entry_id: int):
        return self.connection.execute(
            """SELECT f.*, d.log_date, d.closed_at, p.serving_grams, p.serving_units,
                      p.kcal AS product_kcal, p.protein AS product_protein,
                      p.fat AS product_fat, p.carbs AS product_carbs
               FROM food_entries f
               JOIN days d ON d.id=f.day_id
               JOIN products p ON p.id=f.product_id
               WHERE f.id=?""",
            (entry_id,),
        ).fetchone()

    def delete_food(self, entry_id: int) -> None:
        self.connection.execute("DELETE FROM food_entries WHERE id=?", (entry_id,))

    def update_food(self, entry_id: int, food_entry: dict) -> None:
        self.connection.execute(
            """UPDATE food_entries SET
                   quantity=?, quantity_mode=?, kcal=?, protein=?, fat=?, carbs=?, meal_type=?
               WHERE id=?""",
            (
                food_entry["quantity"],
                food_entry["quantity_mode"],
                food_entry["kcal"],
                food_entry["protein"],
                food_entry["fat"],
                food_entry["carbs"],
                food_entry["meal_type"],
                entry_id,
            ),
        )

    def update(self, day_id: int, day: dict) -> None:
        self.connection.execute(
            """UPDATE days SET
                   day_type=?, base_tdee=?, goal_delta=?, steps=?, step_cadence=?,
                   watch_active_kcal=?, cardio_kcal=?, manual_adjustment=?, note=?
               WHERE id=?""",
            (
                day["day_type"],
                day["base_tdee"],
                day["goal_delta"],
                day["steps"],
                day["step_cadence"],
                day["watch_active_kcal"],
                day["cardio_kcal"],
                day["manual_adjustment"],
                day["note"],
                day_id,
            ),
        )

    def update_sleep(self, day_id: int, sleep: dict) -> None:
        self.connection.execute(
            """UPDATE days SET
                   sleep_start=?, sleep_end=?, sleep_deep_percent=?, sleep_rem_percent=?
               WHERE id=?""",
            (
                sleep["start"],
                sleep["end"],
                sleep["deep_percent"],
                sleep["rem_percent"],
                day_id,
            ),
        )

    def close(self, day_id: int, summary: dict, closed_at: str) -> None:
        self.connection.execute(
            """UPDATE days SET
                   closed_at=?, closed_weight=?, closed_steps_kcal=?,
                   closed_workout_kcal=?, closed_tdee=?
               WHERE id=?""",
            (
                closed_at,
                summary["weight"],
                summary["steps_kcal"],
                summary["workout_kcal"],
                summary["tdee"],
                day_id,
            ),
        )

    def reopen(self, day_id: int) -> None:
        self.connection.execute(
            """UPDATE days SET
                   closed_at=NULL, closed_weight=NULL, closed_steps_kcal=NULL,
                   closed_workout_kcal=NULL, closed_tdee=NULL
               WHERE id=?""",
            (day_id,),
        )

    def delete_with_related_data(self, day_id: int) -> None:
        self.connection.execute(
            """DELETE FROM cardio_intervals WHERE session_id IN (
                   SELECT cs.id FROM cardio_sessions cs
                   JOIN workouts w ON w.id=cs.workout_id WHERE w.day_id=?
               )""",
            (day_id,),
        )
        self.connection.execute(
            "DELETE FROM cardio_sessions WHERE workout_id IN (SELECT id FROM workouts WHERE day_id=?)",
            (day_id,),
        )
        self.connection.execute(
            "DELETE FROM workout_sets WHERE workout_id IN (SELECT id FROM workouts WHERE day_id=?)",
            (day_id,),
        )
        self.connection.execute("DELETE FROM workouts WHERE day_id=?", (day_id,))
        self.connection.execute("DELETE FROM food_entries WHERE day_id=?", (day_id,))
        self.connection.execute("DELETE FROM days WHERE id=?", (day_id,))
