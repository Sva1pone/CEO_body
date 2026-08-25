import sqlite3


class WorkoutRepository:
    def __init__(self, connection: sqlite3.Connection):
        self.connection = connection

    def find_exercise_snapshot(self, exercise_name: str):
        return self.connection.execute(
            "SELECT id, muscle_profile FROM exercise_catalog WHERE name=?",
            (exercise_name,),
        ).fetchone()

    def list_templates(self):
        return self.connection.execute("""SELECT * FROM workout_templates WHERE active=1
               ORDER BY sort_order, name COLLATE NOCASE""").fetchall()

    def list_template_exercises(self):
        return self.connection.execute(
            """SELECT template_id, exercise_name FROM workout_template_exercises
               ORDER BY template_id, sort_order, exercise_name COLLATE NOCASE"""
        ).fetchall()

    def list_cardio_sessions(self, workout_id: int):
        return self.connection.execute(
            "SELECT * FROM cardio_sessions WHERE workout_id=? ORDER BY id",
            (workout_id,),
        ).fetchall()

    def list_cardio_intervals(self, session_id: int):
        return self.connection.execute(
            "SELECT * FROM cardio_intervals WHERE session_id=? ORDER BY sort_order, id",
            (session_id,),
        ).fetchall()

    def find_with_day(self, workout_id: int):
        return self.connection.execute(
            """SELECT w.*, d.log_date, d.closed_at AS day_closed_at,
                      d.closed_weight AS day_closed_weight
               FROM workouts w JOIN days d ON d.id=w.day_id WHERE w.id=?""",
            (workout_id,),
        ).fetchone()

    def list_sets(self, workout_id: int):
        return self.connection.execute(
            """SELECT * FROM workout_sets ws WHERE workout_id=?
               ORDER BY (
                   SELECT MIN(grouped.id) FROM workout_sets grouped
                   WHERE grouped.workout_id=ws.workout_id
                     AND grouped.exercise=ws.exercise
               ) DESC, set_number, id""",
            (workout_id,),
        ).fetchall()

    def list_previous_records(self, workout_id: int):
        return self.connection.execute(
            """SELECT exercise, MAX(weight) AS best_weight,
                      MAX(weight * (1 + reps / 30.0)) AS best_1rm
               FROM workout_sets previous_set
               JOIN workouts previous_workout ON previous_workout.id=previous_set.workout_id
               JOIN days previous_day ON previous_day.id=previous_workout.day_id
               JOIN workouts current_workout ON current_workout.id=?
               JOIN days current_day ON current_day.id=current_workout.day_id
               WHERE (
                      previous_day.log_date < current_day.log_date
                  OR (
                      previous_day.log_date=current_day.log_date
                      AND previous_workout.id < current_workout.id
                  ))
                 AND COALESCE(previous_set.is_warmup, 0)=0 AND previous_set.reps>0
               GROUP BY exercise ORDER BY exercise COLLATE NOCASE""",
            (workout_id,),
        ).fetchall()

    def list_previous_repetition_records(self, workout_id: int):
        return self.connection.execute(
            """SELECT exercise, weight, MAX(reps) AS best_reps
               FROM workout_sets previous_set
               JOIN workouts previous_workout ON previous_workout.id=previous_set.workout_id
               JOIN days previous_day ON previous_day.id=previous_workout.day_id
               JOIN workouts current_workout ON current_workout.id=?
               JOIN days current_day ON current_day.id=current_workout.day_id
               WHERE (
                      previous_day.log_date < current_day.log_date
                  OR (
                      previous_day.log_date=current_day.log_date
                      AND previous_workout.id < current_workout.id
                  ))
                 AND COALESCE(previous_set.is_warmup, 0)=0 AND previous_set.reps>0
               GROUP BY exercise, weight ORDER BY exercise COLLATE NOCASE, weight""",
            (workout_id,),
        ).fetchall()

    def list_active_exercise_metadata(self):
        return self.connection.execute(
            """SELECT id, name, muscle_group, note, image_path, effectiveness_rating,
                      difficulty_rating, muscle_profile
               FROM exercise_catalog WHERE active=1 ORDER BY name COLLATE NOCASE"""
        ).fetchall()

    def list_available_exercises(self, template_id: int | None):
        if template_id is None:
            return self.connection.execute(
                """SELECT id, name FROM exercise_catalog
                   WHERE active=1 ORDER BY name COLLATE NOCASE"""
            ).fetchall()

        return self.connection.execute(
            """SELECT DISTINCT ec.id, ec.name
               FROM exercise_catalog ec
               JOIN workout_template_exercises wte ON wte.exercise_name=ec.name
               WHERE ec.active=1 AND wte.template_id=?
               ORDER BY wte.sort_order, ec.name COLLATE NOCASE""",
            (template_id,),
        ).fetchall()

    def list_catalog(self):
        return self.connection.execute("""SELECT * FROM exercise_catalog WHERE active=1
               ORDER BY COALESCE(muscle_group, ''), name COLLATE NOCASE""").fetchall()

    def list_mappings(self):
        return self.connection.execute(
            """SELECT template_id, exercise_name, subgroup_id, sort_order
               FROM workout_template_exercises
               ORDER BY template_id, subgroup_id, sort_order, id"""
        ).fetchall()

    def list_subgroups(self):
        return self.connection.execute(
            """SELECT * FROM exercise_subgroups WHERE active=1
               ORDER BY template_id, sort_order, name COLLATE NOCASE"""
        ).fetchall()

    def find_subgroup(self, template_id: int, subgroup_id: int):
        return self.connection.execute(
            """SELECT id FROM exercise_subgroups
               WHERE id=? AND template_id=? AND active=1""",
            (subgroup_id, template_id),
        ).fetchone()

    def find_first_subgroup(self, template_id: int):
        return self.connection.execute(
            """SELECT id FROM exercise_subgroups
               WHERE template_id=? AND active=1 ORDER BY sort_order, id LIMIT 1""",
            (template_id,),
        ).fetchone()

    def next_exercise_sort_order(self, subgroup_id: int) -> int:
        row = self.connection.execute(
            """SELECT COALESCE(MAX(sort_order), 0) AS value
               FROM workout_template_exercises WHERE subgroup_id=?""",
            (subgroup_id,),
        ).fetchone()
        return int(row["value"]) + 10
