from __future__ import annotations

from pathlib import Path

SCHEMA_PATH = Path(__file__).with_name("schema.sql")


def initialize_database(data_dir, upload_dir, connect) -> None:
    data_dir.mkdir(exist_ok=True)
    upload_dir.mkdir(parents=True, exist_ok=True)
    with connect() as connection:
        connection.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
