from __future__ import annotations

from datetime import date, timedelta

from backend.database.sql_commands.reminders import ReminderRepository
from backend.services.runtime import db


def get_reminders(current_date: date | None = None) -> dict:
    today = current_date or date.today()
    today_iso = today.isoformat()

    with db() as connection:
        repository = ReminderRepository(connection)
        unclosed_rows = repository.list_meaningful_unclosed_days(today_iso)
        strategy = repository.active_strategy(today_iso)
        latest_tape = repository.latest_tape_measurement(today_iso)

    measurement = _measurement_reminder(today, strategy, latest_tape)
    return {
        "today": today_iso,
        "unclosed_days": {
            "count": len(unclosed_rows),
            "items": [dict(row) for row in unclosed_rows],
        },
        "measurement": measurement,
        "active_reminders": int(bool(unclosed_rows)) + int(measurement["overdue"]),
    }


def _measurement_reminder(today: date, strategy, latest_tape) -> dict:
    if not strategy:
        return {
            "last_tape_date": None,
            "interval_days": None,
            "next_due_date": None,
            "elapsed_days": None,
            "overdue": False,
        }

    interval_days = strategy["measurement_reminder_days"]
    baseline = date.fromisoformat(
        latest_tape["measured_on"] if latest_tape else strategy["effective_from"]
    )
    next_due = baseline + timedelta(days=interval_days)
    return {
        "last_tape_date": latest_tape["measured_on"] if latest_tape else None,
        "interval_days": interval_days,
        "next_due_date": next_due.isoformat(),
        "elapsed_days": max(0, (today - baseline).days),
        "overdue": today >= next_due,
    }
