import sqlite3


class ReminderRepository:
    def __init__(self, connection: sqlite3.Connection):
        self.connection = connection

    def list_meaningful_unclosed_days(self, today: str):
        return self.connection.execute(
            """SELECT d.id, d.log_date
               FROM days d
               WHERE d.log_date < ? AND d.closed_at IS NULL AND (
                   d.setup_done=1 OR d.steps!=0
                   OR d.watch_active_kcal IS NOT NULL OR d.cardio_kcal!=0
                   OR d.manual_adjustment!=0 OR TRIM(COALESCE(d.note, ''))!=''
                   OR d.sleep_start IS NOT NULL OR d.sleep_end IS NOT NULL
                   OR d.sleep_deep_percent IS NOT NULL OR d.sleep_rem_percent IS NOT NULL
                   OR EXISTS (SELECT 1 FROM food_entries f WHERE f.day_id=d.id)
                   OR EXISTS (SELECT 1 FROM workouts w WHERE w.day_id=d.id)
               )
               ORDER BY d.log_date, d.id""",
            (today,),
        ).fetchall()

    def active_strategy(self, today: str):
        return self.connection.execute(
            """SELECT id, effective_from, measurement_reminder_days
               FROM strategy_versions
               WHERE effective_from <= ?
               ORDER BY effective_from DESC, id DESC
               LIMIT 1""",
            (today,),
        ).fetchone()

    def latest_tape_measurement(self, today: str):
        return self.connection.execute(
            """SELECT m.id, m.measured_on
               FROM measurements m
               WHERE m.measured_on <= ? AND EXISTS (
                   SELECT 1 FROM body_measurement_values value
                   WHERE value.measurement_id=m.id
               )
               ORDER BY m.measured_on DESC, m.id DESC
               LIMIT 1""",
            (today,),
        ).fetchone()
