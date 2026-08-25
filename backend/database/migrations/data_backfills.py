from __future__ import annotations

from datetime import datetime

from backend.services.days import day_summary
from backend.services.runtime import db


def migrate_exercise_subgroups() -> None:
    """Rename the legacy fallback and recreate it only for genuinely orphaned rows."""
    with db() as connection:
        templates = connection.execute(
            "SELECT id FROM workout_templates WHERE active=1 ORDER BY sort_order, id"
        ).fetchall()
        for template in templates:
            legacy = connection.execute(
                """SELECT id FROM exercise_subgroups
                   WHERE template_id=? AND name='Без подгруппы'""",
                (template["id"],),
            ).fetchone()
            unassigned = connection.execute(
                """SELECT id FROM exercise_subgroups
                   WHERE template_id=? AND name='Неразмеченное' AND active=1""",
                (template["id"],),
            ).fetchone()
            if legacy and unassigned:
                connection.execute(
                    "UPDATE workout_template_exercises SET subgroup_id=? WHERE subgroup_id=?",
                    (unassigned["id"], legacy["id"]),
                )
                connection.execute(
                    "UPDATE exercise_subgroups SET active=0 WHERE id=?", (legacy["id"],)
                )
            elif legacy:
                connection.execute(
                    "UPDATE exercise_subgroups SET name='Неразмеченное' WHERE id=?",
                    (legacy["id"],),
                )
                unassigned = legacy
            missing_count = connection.execute(
                """SELECT COUNT(*) AS value FROM workout_template_exercises
                   WHERE template_id=? AND subgroup_id IS NULL""",
                (template["id"],),
            ).fetchone()["value"]
            if not missing_count:
                continue
            if not unassigned:
                cursor = connection.execute(
                    """INSERT INTO exercise_subgroups(template_id, name, sort_order)
                       VALUES (?, 'Неразмеченное', 10000)""",
                    (template["id"],),
                )
                unassigned = {"id": cursor.lastrowid}
            connection.execute(
                """UPDATE workout_template_exercises SET subgroup_id=?
                   WHERE template_id=? AND subgroup_id IS NULL""",
                (unassigned["id"], template["id"]),
            )


def backfill_product_per_100_values() -> None:
    """Keeps legacy items editable without changing their stored serving nutrition."""
    with db() as connection:
        connection.execute(
            """UPDATE products
               SET kcal_100 = kcal * 100.0 / serving_grams,
                   protein_100 = protein * 100.0 / serving_grams,
                   fat_100 = CASE WHEN fat IS NULL THEN NULL ELSE fat * 100.0 / serving_grams END,
                   carbs_100 = CASE WHEN carbs IS NULL THEN NULL ELSE carbs * 100.0 / serving_grams END
               WHERE serving_grams IS NOT NULL AND serving_grams > 0 AND kcal_100 IS NULL"""
        )


def backfill_workout_set_profiles() -> None:
    """Freeze the current catalogue classification for legacy workout sets once."""
    with db() as connection:
        if not connection.execute("SELECT 1 FROM workout_sets LIMIT 1").fetchone():
            return
        connection.execute("""UPDATE workout_sets
               SET exercise_catalog_id=(
                       SELECT ec.id FROM exercise_catalog ec
                       WHERE ec.name=workout_sets.exercise LIMIT 1
                   )
               WHERE exercise_catalog_id IS NULL""")
        connection.execute("""UPDATE workout_sets
               SET muscle_profile_snapshot=COALESCE((
                       SELECT ec.muscle_profile FROM exercise_catalog ec
                       WHERE ec.id=workout_sets.exercise_catalog_id
                   ), '{"primary": [], "secondary": []}')
               WHERE muscle_profile_snapshot IS NULL""")
        # Одноразово дополняем пустые снимки, созданные при самой первой миграции.
        # Маркер запрещает будущим правкам каталога переписывать историю.
        migrated = connection.execute(
            "SELECT 1 FROM settings WHERE key='workout_profile_snapshots_v1'"
        ).fetchone()
        if not migrated:
            connection.execute("""UPDATE workout_sets
                   SET muscle_profile_snapshot=(
                       SELECT ec.muscle_profile FROM exercise_catalog ec
                       WHERE ec.id=workout_sets.exercise_catalog_id
                   )
                   WHERE muscle_profile_snapshot='{"primary": [], "secondary": []}'
                     AND EXISTS (
                       SELECT 1 FROM exercise_catalog ec
                       WHERE ec.id=workout_sets.exercise_catalog_id
                         AND ec.muscle_profile IS NOT NULL
                         AND ec.muscle_profile!='{"primary": [], "secondary": []}'
                     )""")
            connection.execute(
                "INSERT INTO settings(key, value) VALUES ('workout_profile_snapshots_v1', ?)",
                (datetime.now().isoformat(timespec="seconds"),),
            )


def backfill_closed_day_energy() -> None:
    """Один раз фиксирует расход старых закрытых дней без изменения их записей."""
    with db() as connection:
        rows = connection.execute(
            "SELECT * FROM days WHERE closed_at IS NOT NULL AND closed_tdee IS NULL ORDER BY id"
        ).fetchall()
    for day in rows:
        summary = day_summary(day)
        with db() as connection:
            connection.execute(
                """UPDATE days
                   SET closed_weight=?, closed_steps_kcal=?, closed_workout_kcal=?, closed_tdee=?
                   WHERE id=? AND closed_at IS NOT NULL AND closed_tdee IS NULL""",
                (
                    summary["weight"],
                    summary["steps_kcal"],
                    summary["workout_kcal"],
                    summary["tdee"],
                    day["id"],
                ),
            )
