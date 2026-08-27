from __future__ import annotations

import hashlib
import io
import json
import sqlite3
import zipfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath

from werkzeug.datastructures import FileStorage

from backend.services import runtime
from backend.services.products import image_suffix


FORMAT_VERSION = 1
MAX_ARCHIVE_BYTES = 9 * 1024 * 1024
MAX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024
MAX_FILES = 250
MAX_IMAGE_BYTES = 8 * 1024 * 1024
MAX_JSON_BYTES = 2 * 1024 * 1024
CONFLICT_POLICIES = {"skip", "replace", "copy"}
IMAGE_MIME_TYPES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
}


class ExercisePackError(ValueError):
    pass


def _json_bytes(value: object) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


def _zip_entry(name: str, content: bytes) -> tuple[zipfile.ZipInfo, bytes]:
    entry = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
    entry.compress_type = zipfile.ZIP_DEFLATED
    entry.external_attr = 0o600 << 16
    return entry, content


def _integer_set(selection: dict, key: str) -> set[int]:
    values = selection.get(key, [])
    if not isinstance(values, list):
        raise ExercisePackError("Некорректный выбор содержимого пака.")
    try:
        result = {int(value) for value in values}
    except (TypeError, ValueError) as error:
        raise ExercisePackError("Некорректный выбор содержимого пака.") from error
    if any(value <= 0 for value in result):
        raise ExercisePackError("Некорректный выбор содержимого пака.")
    return result


def _placement_set(selection: dict) -> set[tuple[int, int]]:
    values = selection.get("placements", [])
    if not isinstance(values, list):
        raise ExercisePackError("Некорректный выбор содержимого пака.")
    result = set()
    for value in values:
        if not isinstance(value, dict):
            raise ExercisePackError("Некорректный выбор содержимого пака.")
        try:
            subgroup_id = int(value["subgroup_id"])
            exercise_id = int(value["exercise_id"])
        except (KeyError, TypeError, ValueError) as error:
            raise ExercisePackError("Некорректный выбор содержимого пака.") from error
        if subgroup_id <= 0 or exercise_id <= 0:
            raise ExercisePackError("Некорректный выбор содержимого пака.")
        result.add((subgroup_id, exercise_id))
    return result


def build_exercise_pack(selection: dict | None, include_images: bool) -> tuple[bytes, dict]:
    selection = selection or {}
    template_ids = _integer_set(selection, "template_ids")
    subgroup_ids = _integer_set(selection, "subgroup_ids")
    exercise_ids = _integer_set(selection, "exercise_ids")
    selected_placements = _placement_set(selection)
    has_explicit_selection = any(
        key in selection
        for key in ("template_ids", "subgroup_ids", "exercise_ids", "placements")
    )
    select_all = bool(selection.get("all")) or not has_explicit_selection

    with runtime.db() as connection:
        templates = [dict(row) for row in connection.execute(
            "SELECT * FROM workout_templates WHERE active=1 ORDER BY sort_order, name COLLATE NOCASE, id"
        )]
        subgroups = [dict(row) for row in connection.execute(
            "SELECT * FROM exercise_subgroups WHERE active=1 ORDER BY template_id, sort_order, name COLLATE NOCASE, id"
        )]
        exercises = [dict(row) for row in connection.execute(
            "SELECT * FROM exercise_catalog WHERE active=1 ORDER BY name COLLATE NOCASE, id"
        )]
        mappings = [dict(row) for row in connection.execute(
            """SELECT wte.template_id, wte.subgroup_id, wte.exercise_name, wte.sort_order
               FROM workout_template_exercises wte
               ORDER BY wte.template_id, wte.subgroup_id, wte.sort_order,
                        wte.exercise_name COLLATE NOCASE, wte.id"""
        )]

    exercise_by_name = {row["name"]: row for row in exercises}
    selected_exercise_names = {
        row["name"] for row in exercises if row["id"] in exercise_ids
    }
    selected_mappings = [
        row
        for row in mappings
        if select_all
        or row["template_id"] in template_ids
        or row["subgroup_id"] in subgroup_ids
        or row["exercise_name"] in selected_exercise_names
        or (
            row["exercise_name"] in exercise_by_name
            and (row["subgroup_id"], exercise_by_name[row["exercise_name"]]["id"])
            in selected_placements
        )
    ]
    selected_template_ids = set(template_ids)
    selected_subgroup_ids = set(subgroup_ids)
    selected_names = set(selected_exercise_names)
    for row in selected_mappings:
        selected_template_ids.add(row["template_id"])
        if row["subgroup_id"] is not None:
            selected_subgroup_ids.add(row["subgroup_id"])
        selected_names.add(row["exercise_name"])
    if select_all:
        selected_template_ids = {row["id"] for row in templates}
        selected_subgroup_ids = {row["id"] for row in subgroups}
        selected_names = set(exercise_by_name)

    selected_subgroups = [row for row in subgroups if row["id"] in selected_subgroup_ids]
    selected_template_ids.update(row["template_id"] for row in selected_subgroups)
    selected_templates = [row for row in templates if row["id"] in selected_template_ids]
    selected_exercises = [row for row in exercises if row["name"] in selected_names]

    template_keys = {row["id"]: f"template-{index + 1}" for index, row in enumerate(selected_templates)}
    subgroup_keys = {row["id"]: f"subgroup-{index + 1}" for index, row in enumerate(selected_subgroups)}
    exercise_keys = {row["name"]: f"exercise-{index + 1}" for index, row in enumerate(selected_exercises)}
    image_entries: list[tuple[zipfile.ZipInfo, bytes]] = []
    image_bytes = 0
    catalog_exercises = []
    for row in selected_exercises:
        image_name = None
        if include_images and row.get("image_path"):
            source = runtime.UPLOAD_DIR / Path(row["image_path"]).name
            if source.is_file():
                content = source.read_bytes()
                suffix = image_suffix(content)
                if suffix and len(content) <= MAX_IMAGE_BYTES:
                    digest = hashlib.sha256(content).hexdigest()
                    image_name = f"images/{digest}{suffix}"
                    if not any(entry.filename == image_name for entry, _ in image_entries):
                        image_entries.append(_zip_entry(image_name, content))
                        image_bytes += len(content)
        try:
            muscle_profile = json.loads(row.get("muscle_profile") or "{}")
        except json.JSONDecodeError:
            muscle_profile = {}
        catalog_exercises.append({
            "key": exercise_keys[row["name"]],
            "name": row["name"],
            "description": row.get("note") or "",
            "muscle_group": row.get("muscle_group") or "",
            "effectiveness_rating": row.get("effectiveness_rating") or 3,
            "difficulty_rating": row.get("difficulty_rating") or 3,
            "primary_muscles": muscle_profile.get("primary", []),
            "secondary_muscles": muscle_profile.get("secondary", []),
            "image": image_name,
        })

    catalog = {
        "templates": [
            {
                "key": template_keys[row["id"]],
                "name": row["name"],
                "default_duration_minutes": row["default_duration_minutes"],
                "default_intensity_met": row["default_intensity_met"],
                "sort_order": row["sort_order"],
            }
            for row in selected_templates
        ],
        "subgroups": [
            {
                "key": subgroup_keys[row["id"]],
                "template_key": template_keys[row["template_id"]],
                "name": row["name"],
                "sort_order": row["sort_order"],
            }
            for row in selected_subgroups
        ],
        "exercises": catalog_exercises,
        "placements": [
            {
                "template_key": template_keys[row["template_id"]],
                "subgroup_key": subgroup_keys.get(row["subgroup_id"]),
                "exercise_key": exercise_keys[row["exercise_name"]],
                "sort_order": row["sort_order"],
            }
            for row in selected_mappings
            if row["template_id"] in template_keys
            and row["exercise_name"] in exercise_keys
            and (row["subgroup_id"] is None or row["subgroup_id"] in subgroup_keys)
        ],
    }
    manifest = {
        "format": "ceo-body-exercise-pack",
        "format_version": FORMAT_VERSION,
        "exported_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "includes_images": bool(image_entries),
    }
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        for entry, content in [
            _zip_entry("manifest.json", _json_bytes(manifest)),
            _zip_entry("catalog.json", _json_bytes(catalog)),
            *sorted(image_entries, key=lambda value: value[0].filename),
        ]:
            archive.writestr(entry, content)
    pack_content = output.getvalue()
    inspect_exercise_pack(
        FileStorage(
            stream=io.BytesIO(pack_content),
            filename="export.ceopack.zip",
            content_type="application/zip",
        )
    )
    summary = {
        "templates": len(catalog["templates"]),
        "subgroups": len(catalog["subgroups"]),
        "exercises": len(catalog["exercises"]),
        "image_bytes": image_bytes,
    }
    return pack_content, summary


def _safe_member_name(name: str) -> str:
    if "\\" in name or not name or name.startswith("/"):
        raise ExercisePackError("Архив содержит небезопасный путь.")
    path = PurePosixPath(name)
    if path.is_absolute() or ".." in path.parts or "." in path.parts:
        raise ExercisePackError("Архив содержит небезопасный путь.")
    return path.as_posix()


def _read_json(archive: zipfile.ZipFile, name: str) -> object:
    info = archive.getinfo(name)
    if info.file_size > MAX_JSON_BYTES:
        raise ExercisePackError(f"Файл {name} слишком большой.")
    try:
        return json.loads(archive.read(info).decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError, RuntimeError, zipfile.BadZipFile, OSError) as error:
        raise ExercisePackError(f"Файл {name} повреждён.") from error


def _list_of_objects(catalog: dict, key: str, maximum: int) -> list[dict]:
    values = catalog.get(key)
    if not isinstance(values, list) or len(values) > maximum or any(not isinstance(value, dict) for value in values):
        raise ExercisePackError("Структура catalog.json не поддерживается.")
    return values


def _bounded_number(value: object, minimum: float, maximum: float) -> bool:
    return (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and minimum <= value <= maximum
    )


def inspect_exercise_pack(upload: FileStorage | None) -> dict:
    if not upload or not upload.filename:
        raise ExercisePackError("Выбери файл .ceopack.zip.")
    if not upload.filename.lower().endswith(".ceopack.zip"):
        raise ExercisePackError("Нужен файл с расширением .ceopack.zip.")
    content = upload.stream.read(MAX_ARCHIVE_BYTES + 1)
    if len(content) > MAX_ARCHIVE_BYTES:
        raise ExercisePackError("Пак не должен превышать 9 МБ.")
    try:
        archive = zipfile.ZipFile(io.BytesIO(content))
    except zipfile.BadZipFile as error:
        raise ExercisePackError("Пак повреждён или не является ZIP-архивом.") from error
    with archive:
        infos = archive.infolist()
        if len(infos) > MAX_FILES:
            raise ExercisePackError("В паке слишком много файлов.")
        names = [_safe_member_name(info.filename) for info in infos]
        if len(names) != len(set(names)):
            raise ExercisePackError("Пак содержит повторяющиеся пути.")
        if "manifest.json" not in names or "catalog.json" not in names:
            raise ExercisePackError("В паке нет manifest.json или catalog.json.")
        total_size = sum(info.file_size for info in infos)
        if total_size > MAX_UNCOMPRESSED_BYTES:
            raise ExercisePackError("Распакованное содержимое пака слишком большое.")
        for info in infos:
            if info.is_dir():
                continue
            if info.compress_size == 0 and info.file_size > 0:
                raise ExercisePackError("Пак содержит подозрительно сжатый файл.")
            if info.compress_size and info.file_size / info.compress_size > 200:
                raise ExercisePackError("Пак содержит подозрительно сжатый файл.")
            if info.filename not in {"manifest.json", "catalog.json"} and not info.filename.startswith("images/"):
                raise ExercisePackError("Пак содержит неизвестные файлы.")
        manifest = _read_json(archive, "manifest.json")
        catalog = _read_json(archive, "catalog.json")
        if not isinstance(manifest, dict) or manifest.get("format") != "ceo-body-exercise-pack":
            raise ExercisePackError("Это не пак упражнений «СЕО тела».")
        version = manifest.get("format_version")
        if not isinstance(version, int) or isinstance(version, bool) or version != FORMAT_VERSION:
            if isinstance(version, int) and not isinstance(version, bool) and version > FORMAT_VERSION:
                raise ExercisePackError("Пак создан в более новой версии приложения.")
            raise ExercisePackError("Версия формата пака не поддерживается.")
        if not isinstance(catalog, dict):
            raise ExercisePackError("Структура catalog.json не поддерживается.")
        templates = _list_of_objects(catalog, "templates", 100)
        subgroups = _list_of_objects(catalog, "subgroups", 500)
        exercises = _list_of_objects(catalog, "exercises", 5000)
        placements = _list_of_objects(catalog, "placements", 20000)
        all_key_rows = templates + subgroups + exercises
        if any(
            not isinstance(row.get("key"), str)
            or not row["key"].strip()
            or len(row["key"]) > 100
            for row in all_key_rows
        ):
            raise ExercisePackError("В паке есть некорректный ключ.")
        keys = {
            "templates": {row.get("key") for row in templates},
            "subgroups": {row.get("key") for row in subgroups},
            "exercises": {row.get("key") for row in exercises},
        }
        if any(None in values or len(values) != expected for values, expected in (
            (keys["templates"], len(templates)),
            (keys["subgroups"], len(subgroups)),
            (keys["exercises"], len(exercises)),
        )):
            raise ExercisePackError("В паке есть пустые или повторяющиеся ключи.")
        for row in templates + subgroups + exercises:
            if not isinstance(row.get("name"), str) or not row["name"].strip() or len(row["name"]) > 200:
                raise ExercisePackError("В паке есть некорректное название.")
            row["name"] = row["name"].strip()
        if len({row["name"].strip().casefold() for row in templates}) != len(templates):
            raise ExercisePackError("В паке повторяются названия тренировочных дней.")
        if len({row["name"].strip().casefold() for row in exercises}) != len(exercises):
            raise ExercisePackError("В паке повторяются названия упражнений.")
        subgroup_names = {
            (row.get("template_key"), row["name"].strip().casefold())
            for row in subgroups
        }
        if len(subgroup_names) != len(subgroups):
            raise ExercisePackError("В паке повторяются названия подгрупп.")
        for row in templates:
            if not _bounded_number(row.get("default_duration_minutes", 75), 1, 1440) or not _bounded_number(row.get("default_intensity_met", 3.5), 0.1, 50):
                raise ExercisePackError("В паке есть некорректные параметры тренировочного дня.")
            if not _bounded_number(row.get("sort_order", 100), -1_000_000, 1_000_000):
                raise ExercisePackError("В паке есть некорректный порядок тренировочного дня.")
        for row in subgroups:
            if not isinstance(row.get("template_key"), str):
                raise ExercisePackError("Подгруппа ссылается на некорректный тренировочный день.")
            if not _bounded_number(row.get("sort_order", 100), -1_000_000, 1_000_000):
                raise ExercisePackError("В паке есть некорректный порядок подгруппы.")
        for row in exercises:
            if not _bounded_number(row.get("effectiveness_rating", 3), 1, 5) or not _bounded_number(row.get("difficulty_rating", 3), 1, 5):
                raise ExercisePackError("В паке есть некорректный рейтинг упражнения.")
            for muscle_key in ("primary_muscles", "secondary_muscles"):
                muscles = row.get(muscle_key, [])
                if not isinstance(muscles, list) or len(muscles) > 100 or any(not isinstance(muscle, str) or not muscle.strip() or len(muscle) > 100 for muscle in muscles):
                    raise ExercisePackError("В паке есть некорректный список мышц.")
            description = row.get("description") or ""
            muscle_group = row.get("muscle_group") or ""
            if not isinstance(description, str) or not isinstance(muscle_group, str) or len(description) > 20000 or len(muscle_group) > 200:
                raise ExercisePackError("Описание упражнения в паке слишком большое.")
        if any(row.get("template_key") not in keys["templates"] for row in subgroups):
            raise ExercisePackError("Подгруппа ссылается на неизвестный тренировочный день.")
        subgroup_templates = {row["key"]: row["template_key"] for row in subgroups}
        placement_keys = set()
        for row in placements:
            if any(not isinstance(row.get(key), str) for key in ("template_key", "subgroup_key", "exercise_key")):
                raise ExercisePackError("В паке есть некорректное размещение.")
            if row.get("template_key") not in keys["templates"] or row.get("exercise_key") not in keys["exercises"]:
                raise ExercisePackError("Размещение ссылается на неизвестный объект.")
            if row.get("subgroup_key") not in keys["subgroups"]:
                raise ExercisePackError("Размещение ссылается на неизвестную подгруппу.")
            if subgroup_templates[row["subgroup_key"]] != row["template_key"]:
                raise ExercisePackError("Размещение связывает подгруппу с другим тренировочным днём.")
            placement_key = (row["template_key"], row["exercise_key"])
            if placement_key in placement_keys:
                raise ExercisePackError("В паке повторяется размещение упражнения.")
            placement_keys.add(placement_key)
            if not _bounded_number(row.get("sort_order", 100), -1_000_000, 1_000_000):
                raise ExercisePackError("В паке есть некорректный порядок упражнений.")
        image_payloads = {}
        referenced_images = {row.get("image") for row in exercises if row.get("image")}
        archived_images = {name for name in names if name.startswith("images/") and not name.endswith("/")}
        if archived_images != referenced_images:
            raise ExercisePackError("Пак содержит лишние или незаявленные изображения.")
        for name in referenced_images:
            if not isinstance(name, str) or not name.startswith("images/") or name not in names:
                raise ExercisePackError("В паке отсутствует заявленное изображение.")
            info = archive.getinfo(name)
            if info.file_size > MAX_IMAGE_BYTES:
                raise ExercisePackError("Изображение в паке превышает 8 МБ.")
            try:
                image = archive.read(info)
            except (RuntimeError, zipfile.BadZipFile, OSError) as error:
                raise ExercisePackError("Изображение в паке повреждено.") from error
            detected_suffix = image_suffix(image)
            declared_suffix = Path(name).suffix.lower()
            if detected_suffix != declared_suffix or declared_suffix not in IMAGE_MIME_TYPES:
                raise ExercisePackError("Тип изображения не соответствует его расширению.")
            image_payloads[name] = image
    return {
        "content": content,
        "manifest": manifest,
        "catalog": catalog,
        "images": image_payloads,
        "summary": {
            "templates": len(templates),
            "subgroups": len(subgroups),
            "exercises": len(exercises),
            "placements": len(placements),
            "images": len(image_payloads),
            "image_bytes": sum(len(value) for value in image_payloads.values()),
        },
    }


def preview_exercise_pack(upload: FileStorage | None) -> dict:
    inspected = inspect_exercise_pack(upload)
    catalog = inspected["catalog"]
    exercises_by_key = {exercise["key"]: exercise for exercise in catalog["exercises"]}
    placed_exercise_keys = {
        placement["exercise_key"] for placement in catalog["placements"]
    }
    return {
        "manifest": inspected["manifest"],
        "summary": inspected["summary"],
        "templates": [
            {
                **template,
                "subgroups": [
                    {
                        **subgroup,
                        "exercises": [
                            exercises_by_key[placement["exercise_key"]]
                            for placement in catalog["placements"]
                            if placement["subgroup_key"] == subgroup["key"]
                        ],
                    }
                    for subgroup in catalog["subgroups"]
                    if subgroup["template_key"] == template["key"]
                ],
            }
            for template in catalog["templates"]
        ],
        "unplaced_exercises": [
            exercise
            for exercise in catalog["exercises"]
            if exercise["key"] not in placed_exercise_keys
        ],
    }


def _copy_name(connection: sqlite3.Connection, table: str, name: str, template_id: int | None = None) -> str:
    candidate_number = 2
    while True:
        candidate = f"{name} (копия {candidate_number})"
        if table == "exercise_subgroups":
            exists = connection.execute(
                "SELECT 1 FROM exercise_subgroups WHERE template_id=? AND name=? COLLATE NOCASE",
                (template_id, candidate),
            ).fetchone()
        else:
            exists = connection.execute(
                f"SELECT 1 FROM {table} WHERE name=? COLLATE NOCASE", (candidate,)
            ).fetchone()
        if not exists:
            return candidate
        candidate_number += 1


def import_exercise_pack(upload: FileStorage | None, policy: str) -> dict:
    if policy not in CONFLICT_POLICIES:
        raise ExercisePackError("Выбери политику конфликтов.")
    inspected = inspect_exercise_pack(upload)
    catalog = inspected["catalog"]
    created_files: list[Path] = []
    result = {"created": 0, "updated": 0, "skipped": 0, "errors": []}
    try:
        with runtime.db() as connection:
            template_ids = {}
            for row in catalog["templates"]:
                existing = connection.execute(
                    "SELECT * FROM workout_templates WHERE name=? COLLATE NOCASE", (row["name"],)
                ).fetchone()
                name = row["name"].strip()
                if existing and policy == "copy":
                    name = _copy_name(connection, "workout_templates", name)
                    existing = None
                if existing:
                    template_ids[row["key"]] = existing["id"]
                    if policy == "replace":
                        connection.execute(
                            """UPDATE workout_templates SET default_duration_minutes=?, default_intensity_met=?,
                                      sort_order=?, active=1 WHERE id=?""",
                            (row.get("default_duration_minutes", 75), row.get("default_intensity_met", 3.5), row.get("sort_order", 100), existing["id"]),
                        )
                        result["updated"] += 1
                    else:
                        result["skipped"] += 1
                else:
                    cursor = connection.execute(
                        """INSERT INTO workout_templates(name, default_duration_minutes,
                               default_intensity_met, sort_order, active) VALUES (?, ?, ?, ?, 1)""",
                        (name, row.get("default_duration_minutes", 75), row.get("default_intensity_met", 3.5), row.get("sort_order", 100)),
                    )
                    template_ids[row["key"]] = cursor.lastrowid
                    result["created"] += 1

            subgroup_ids = {}
            for row in catalog["subgroups"]:
                template_id = template_ids[row["template_key"]]
                existing = connection.execute(
                    "SELECT * FROM exercise_subgroups WHERE template_id=? AND name=? COLLATE NOCASE",
                    (template_id, row["name"]),
                ).fetchone()
                name = row["name"].strip()
                if existing and policy == "copy":
                    name = _copy_name(connection, "exercise_subgroups", name, template_id)
                    existing = None
                if existing:
                    subgroup_ids[row["key"]] = existing["id"]
                    if policy == "replace":
                        connection.execute(
                            "UPDATE exercise_subgroups SET sort_order=?, active=1 WHERE id=?",
                            (row.get("sort_order", 100), existing["id"]),
                        )
                        result["updated"] += 1
                    else:
                        result["skipped"] += 1
                else:
                    cursor = connection.execute(
                        "INSERT INTO exercise_subgroups(template_id, name, sort_order, active) VALUES (?, ?, ?, 1)",
                        (template_id, name, row.get("sort_order", 100)),
                    )
                    subgroup_ids[row["key"]] = cursor.lastrowid
                    result["created"] += 1

            exercise_names = {}
            for row in catalog["exercises"]:
                existing = connection.execute(
                    "SELECT * FROM exercise_catalog WHERE name=? COLLATE NOCASE", (row["name"],)
                ).fetchone()
                name = row["name"].strip()
                if existing and policy == "copy":
                    name = _copy_name(connection, "exercise_catalog", name)
                    existing = None
                image_path = existing["image_path"] if existing else None
                image_name = row.get("image")
                if image_name and (not existing or policy == "replace"):
                    image = inspected["images"][image_name]
                    suffix = Path(image_name).suffix.lower()
                    filename = f"exercise-pack-{hashlib.sha256(image).hexdigest()}{suffix}"
                    destination = runtime.UPLOAD_DIR / filename
                    if not destination.exists():
                        runtime.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
                        destination.write_bytes(image)
                        created_files.append(destination)
                    image_path = f"uploads/{filename}"
                muscle_profile = json.dumps(
                    {"primary": row.get("primary_muscles", []), "secondary": row.get("secondary_muscles", [])},
                    ensure_ascii=False,
                )
                values = (
                    row.get("muscle_group") or None,
                    row.get("description") or "",
                    image_path,
                    int(row.get("effectiveness_rating", 3)),
                    int(row.get("difficulty_rating", 3)),
                    muscle_profile,
                )
                if existing:
                    exercise_names[row["key"]] = existing["name"]
                    if policy == "replace":
                        connection.execute(
                            """UPDATE exercise_catalog SET muscle_group=?, note=?, image_path=?,
                                      effectiveness_rating=?, difficulty_rating=?, muscle_profile=?, active=1 WHERE id=?""",
                            (*values, existing["id"]),
                        )
                        result["updated"] += 1
                    else:
                        result["skipped"] += 1
                else:
                    connection.execute(
                        """INSERT INTO exercise_catalog(name, muscle_group, note, image_path,
                               effectiveness_rating, difficulty_rating, muscle_profile, active, created_at)
                               VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)""",
                        (name, *values, datetime.now().isoformat(timespec="seconds")),
                    )
                    exercise_names[row["key"]] = name
                    result["created"] += 1

            for row in catalog["placements"]:
                template_id = template_ids[row["template_key"]]
                subgroup_id = subgroup_ids[row["subgroup_key"]]
                exercise_name = exercise_names[row["exercise_key"]]
                existing = connection.execute(
                    "SELECT id FROM workout_template_exercises WHERE template_id=? AND exercise_name=?",
                    (template_id, exercise_name),
                ).fetchone()
                if existing:
                    if policy == "replace":
                        connection.execute(
                            "UPDATE workout_template_exercises SET subgroup_id=?, sort_order=? WHERE id=?",
                            (subgroup_id, row.get("sort_order", 100), existing["id"]),
                        )
                else:
                    connection.execute(
                        """INSERT INTO workout_template_exercises(template_id, exercise_name, subgroup_id, sort_order)
                           VALUES (?, ?, ?, ?)""",
                        (template_id, exercise_name, subgroup_id, row.get("sort_order", 100)),
                    )
    except Exception:
        for path in created_files:
            path.unlink(missing_ok=True)
        raise
    return {**result, "summary": inspected["summary"]}
