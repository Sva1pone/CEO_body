import sqlite3


class BodyMeasurementRepository:
    def __init__(self, connection: sqlite3.Connection):
        self.connection = connection

    def fields(self, include_archived: bool = False):
        where = "" if include_archived else "WHERE active=1"
        return self.connection.execute(
            f"""SELECT * FROM body_measurement_fields {where}
                ORDER BY sort_order, id"""
        ).fetchall()

    def field_by_id(self, field_id: int):
        return self.connection.execute(
            "SELECT * FROM body_measurement_fields WHERE id=?", (field_id,)
        ).fetchone()

    def field_by_slug(self, slug: str):
        return self.connection.execute(
            "SELECT * FROM body_measurement_fields WHERE slug=?", (slug,)
        ).fetchone()

    def create_field(self, name: str, slug: str, sort_order: int, created_at: str):
        cursor = self.connection.execute(
            """INSERT INTO body_measurement_fields(
                   name, slug, unit, sort_order, active, created_at
               ) VALUES (?, ?, 'см', ?, 1, ?)""",
            (name, slug, sort_order, created_at),
        )
        return self.field_by_id(cursor.lastrowid)

    def update_field(self, field_id: int, name: str, sort_order: int, active: bool):
        self.connection.execute(
            """UPDATE body_measurement_fields
               SET name=?, sort_order=?, active=? WHERE id=?""",
            (name, sort_order, int(active), field_id),
        )
        return self.field_by_id(field_id)

    def measurements(self):
        return self.connection.execute(
            "SELECT * FROM measurements ORDER BY measured_on DESC, id DESC"
        ).fetchall()

    def measurement_by_id(self, measurement_id: int):
        return self.connection.execute(
            "SELECT * FROM measurements WHERE id=?", (measurement_id,)
        ).fetchone()

    def values_for_measurements(self, measurement_ids: list[int]):
        if not measurement_ids:
            return []
        placeholders = ", ".join("?" for _ in measurement_ids)
        return self.connection.execute(
            f"""SELECT value.measurement_id, value.field_id, value.value,
                       field.slug, field.name, field.unit, field.active, field.sort_order
                FROM body_measurement_values value
                JOIN body_measurement_fields field ON field.id=value.field_id
                WHERE value.measurement_id IN ({placeholders})
                ORDER BY field.sort_order, field.id""",
            measurement_ids,
        ).fetchall()

    def matching_measurements(
        self, measured_on: str, record_types: tuple[str, ...], excluded_id: int | None = None
    ):
        placeholders = ", ".join("?" for _ in record_types)
        parameters = [measured_on, *record_types]
        exclusion = ""
        if excluded_id is not None:
            exclusion = "AND id!=?"
            parameters.append(excluded_id)
        return self.connection.execute(
            f"""SELECT * FROM measurements
                WHERE measured_on=? AND record_type IN ({placeholders}) {exclusion}
                ORDER BY id""",
            parameters,
        ).fetchall()

    def create_measurement(
        self, measured_on: str, record_type: str, weight: float | None, note: str
    ):
        cursor = self.connection.execute(
            """INSERT INTO measurements(measured_on, record_type, weight, note)
               VALUES (?, ?, ?, ?)""",
            (measured_on, record_type, weight, note),
        )
        return cursor.lastrowid

    def update_measurement(
        self,
        measurement_id: int,
        measured_on: str,
        record_type: str,
        weight: float | None,
        note: str,
    ) -> None:
        self.connection.execute(
            """UPDATE measurements
               SET measured_on=?, record_type=?, weight=?, note=? WHERE id=?""",
            (measured_on, record_type, weight, note, measurement_id),
        )

    def set_values(self, measurement_id: int, values: dict[int, float | None]) -> None:
        for field_id, value in values.items():
            if value is None:
                self.connection.execute(
                    """DELETE FROM body_measurement_values
                       WHERE measurement_id=? AND field_id=?""",
                    (measurement_id, field_id),
                )
                continue
            self.connection.execute(
                """INSERT INTO body_measurement_values(measurement_id, field_id, value)
                   VALUES (?, ?, ?)
                   ON CONFLICT(measurement_id, field_id) DO UPDATE SET value=excluded.value""",
                (measurement_id, field_id, value),
            )
