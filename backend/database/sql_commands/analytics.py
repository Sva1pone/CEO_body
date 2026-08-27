import sqlite3


class AnalyticsRepository:
    def __init__(self, connection: sqlite3.Connection):
        self.connection = connection

    def create_strategy_version(self, strategy: dict, created_at: str) -> None:
        self.connection.execute(
            """INSERT INTO strategy_versions(
                   effective_from, phase, base_tdee, protein_min, protein_max,
                   goal_delta, measurement_reminder_days, note, created_at
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                strategy["effective_from"],
                strategy["phase"],
                strategy["base_tdee"],
                strategy["protein_min"],
                strategy["protein_max"],
                strategy["goal_delta"],
                strategy["measurement_reminder_days"],
                strategy["note"],
                created_at,
            ),
        )

    def get_strategy_overview(self, today: str) -> tuple:
        versions = self.connection.execute(
            "SELECT * FROM strategy_versions ORDER BY effective_from DESC, id DESC"
        ).fetchall()
        active = self.connection.execute(
            """SELECT * FROM strategy_versions WHERE effective_from<=?
               ORDER BY effective_from DESC, id DESC LIMIT 1""",
            (today,),
        ).fetchone()
        future_day_count = self.connection.execute(
            "SELECT COUNT(*) FROM days WHERE log_date>=?",
            (today,),
        ).fetchone()[0]
        return versions, active, future_day_count

    def report_data(self, start: str, end: str) -> tuple:
        period = (start, end)
        days = self.connection.execute(
            """SELECT d.* FROM days d
               WHERE d.log_date BETWEEN ? AND ? AND (
                   d.closed_at IS NOT NULL OR d.setup_done=1 OR d.steps!=0
                   OR d.watch_active_kcal IS NOT NULL OR d.cardio_kcal!=0
                   OR d.manual_adjustment!=0 OR TRIM(COALESCE(d.note, ''))!=''
                   OR d.sleep_start IS NOT NULL OR d.sleep_end IS NOT NULL
                   OR d.sleep_deep_percent IS NOT NULL OR d.sleep_rem_percent IS NOT NULL
                   OR EXISTS (SELECT 1 FROM food_entries f WHERE f.day_id=d.id)
                   OR EXISTS (SELECT 1 FROM workouts w WHERE w.day_id=d.id)
               ) ORDER BY d.log_date DESC""",
            period,
        ).fetchall()
        entries = self.connection.execute(
            """SELECT f.*, p.category, p.image_path, p.benefit_tag, p.benefit_color,
                      c.icon_key AS category_icon, c.color AS category_color
               FROM food_entries f
               LEFT JOIN products p ON p.id=f.product_id
               LEFT JOIN product_categories c ON c.name=p.category
               WHERE f.day_id IN (SELECT id FROM days WHERE log_date BETWEEN ? AND ?)
               ORDER BY f.day_id, f.meal_type, f.id""",
            period,
        ).fetchall()
        cardio_sessions = self.connection.execute(
            """SELECT cs.* FROM cardio_sessions cs JOIN workouts w ON w.id=cs.workout_id
               WHERE w.day_id IN (SELECT id FROM days WHERE log_date BETWEEN ? AND ?)
               ORDER BY cs.id""",
            period,
        ).fetchall()
        cardio_intervals = self.connection.execute(
            """SELECT ci.* FROM cardio_intervals ci
               JOIN cardio_sessions cs ON cs.id=ci.session_id
               JOIN workouts w ON w.id=cs.workout_id
               WHERE w.day_id IN (SELECT id FROM days WHERE log_date BETWEEN ? AND ?)
               ORDER BY ci.session_id, ci.sort_order, ci.id""",
            period,
        ).fetchall()
        latest_tape_measurement = self.connection.execute(
            """SELECT * FROM measurements WHERE measured_on<=?
               AND record_type IN ('tape', 'mixed')
               ORDER BY measured_on DESC, id DESC LIMIT 1""",
            (end,),
        ).fetchone()
        latest_weight_measurement = self.connection.execute(
            """SELECT * FROM measurements WHERE measured_on<=?
               AND weight IS NOT NULL
               ORDER BY measured_on DESC, id DESC LIMIT 1""",
            (end,),
        ).fetchone()
        workouts = self.connection.execute(
            """SELECT * FROM workouts
               WHERE day_id IN (SELECT id FROM days WHERE log_date BETWEEN ? AND ?)
               ORDER BY id DESC""",
            period,
        ).fetchall()
        sets = self.connection.execute(
            """SELECT ws.*, w.day_id FROM workout_sets ws
               JOIN workouts w ON w.id=ws.workout_id
               WHERE w.day_id IN (SELECT id FROM days WHERE log_date BETWEEN ? AND ?)
               ORDER BY ws.exercise, ws.set_number""",
            period,
        ).fetchall()
        return (
            days,
            entries,
            cardio_sessions,
            cardio_intervals,
            latest_tape_measurement,
            latest_weight_measurement,
            workouts,
            sets,
        )

    def statistics_data(self, start: str, end: str) -> tuple:
        period = (start, end)
        days = self.connection.execute(
            """SELECT d.*, COUNT(f.id) AS entry_count
               FROM days d LEFT JOIN food_entries f ON f.day_id=d.id
               WHERE d.log_date BETWEEN ? AND ? GROUP BY d.id
               HAVING d.closed_at IS NOT NULL OR COUNT(f.id)>0
               ORDER BY d.log_date""",
            period,
        ).fetchall()
        closed_days = self.connection.execute(
            """SELECT * FROM days WHERE closed_at IS NOT NULL
               AND log_date BETWEEN ? AND ? ORDER BY log_date""",
            period,
        ).fetchall()
        products = self.connection.execute(
            """SELECT p.id, p.name, p.category, p.serving_grams, p.kcal, p.protein,
                      p.kcal_100, p.protein_100, p.active, COUNT(f.id) AS uses,
                      COALESCE(SUM(f.kcal), 0) AS consumed_kcal,
                      COALESCE(SUM(f.protein), 0) AS consumed_protein
               FROM products p JOIN food_entries f ON f.product_id=p.id
               JOIN days d ON d.id=f.day_id WHERE d.log_date BETWEEN ? AND ?
               GROUP BY p.id ORDER BY uses DESC, consumed_kcal DESC, p.name""",
            period,
        ).fetchall()
        workouts = self.connection.execute(
            """SELECT w.id, w.title, w.duration_minutes, d.log_date
               FROM workouts w JOIN days d ON d.id=w.day_id
               WHERE d.log_date BETWEEN ? AND ? ORDER BY d.log_date, w.id""",
            period,
        ).fetchall()
        strength = self.connection.execute(
            """SELECT ws.*, w.duration_minutes, d.log_date FROM workout_sets ws
               JOIN workouts w ON w.id=ws.workout_id JOIN days d ON d.id=w.day_id
               WHERE d.log_date BETWEEN ? AND ?
               ORDER BY d.log_date, ws.workout_id, ws.exercise, ws.set_number""",
            period,
        ).fetchall()
        cardio = self.connection.execute(
            """SELECT cs.id, cs.duration_minutes, cs.watch_steps, cs.watch_kcal, d.log_date
               FROM cardio_sessions cs JOIN workouts w ON w.id=cs.workout_id
               JOIN days d ON d.id=w.day_id WHERE d.log_date BETWEEN ? AND ?
               ORDER BY d.log_date, cs.id""",
            period,
        ).fetchall()
        return days, closed_days, products, workouts, strength, cardio

    def weight_trend_data(self, start: str, end: str) -> tuple:
        measurements = self.connection.execute(
            """SELECT id, measured_on, weight FROM measurements
               WHERE weight IS NOT NULL AND measured_on BETWEEN ? AND ?
               ORDER BY measured_on, id""",
            (start, end),
        ).fetchall()
        closed_days = self.connection.execute(
            """SELECT * FROM days WHERE closed_at IS NOT NULL
               AND log_date BETWEEN ? AND ? ORDER BY log_date""",
            (start, end),
        ).fetchall()
        return measurements, closed_days

    def add_measurement(
        self, measured_on: str, fields: list[str], values: list, note: str
    ) -> None:
        columns = ", ".join(fields)
        placeholders = ", ".join("?" for _ in fields)
        self.connection.execute(
            f"INSERT INTO measurements(measured_on, {columns}, note) VALUES (?, {placeholders}, ?)",
            [measured_on, *values, note],
        )
