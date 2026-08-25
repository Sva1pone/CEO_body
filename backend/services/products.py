from __future__ import annotations

import sqlite3
from datetime import datetime
from pathlib import Path

from werkzeug.datastructures import FileStorage
from werkzeug.utils import secure_filename

from backend.database.sql_commands.products import ProductRepository
from backend.services import runtime
from backend.services.runtime import db, parse_number


class ProductNotFoundError(Exception):
    pass


class ProductCategoryNotFoundError(Exception):
    pass


class ProductCategoryAlreadyExistsError(Exception):
    pass


class ProductImageRequiredError(Exception):
    pass


class ProductHistoryConfirmationRequiredError(Exception):
    pass


MAX_IMAGE_BYTES = 8 * 1024 * 1024
IMAGE_SIGNATURES = {
    b"\x89PNG\r\n\x1a\n": ".png",
    b"\xff\xd8\xff": ".jpg",
    b"GIF87a": ".gif",
    b"GIF89a": ".gif",
}


def serialize_product(row: sqlite3.Row) -> dict:
    result = dict(row)
    result["image_url"] = f"/static/{row['image_path']}" if row["image_path"] else None
    result["category_icon"] = result.get("category_icon") or "utensils"
    result["category_color"] = result.get("category_color") or "#6d5dfc"
    result["benefit_tag"] = result.get("benefit_tag") or "обычный выбор"
    result["benefit_color"] = result.get("benefit_color") or result["category_color"]
    return result


def serialize_product_categories() -> list[dict]:
    with db() as connection:
        rows = ProductRepository(connection).list_categories()
    return [dict(row) for row in rows]


def validate_category_payload(payload: dict) -> tuple[str, str, str]:
    name = (payload.get("name") or "").strip()
    color = (payload.get("color") or "#6d5dfc").strip()
    icon_key = (payload.get("icon_key") or "utensils").strip()
    if not name:
        raise ValueError("Укажи название категории.")
    if len(color) != 7 or not color.startswith("#"):
        raise ValueError("Некорректный цвет категории.")
    return name, icon_key, color


def save_product_image(image: FileStorage | None) -> str | None:
    if not image or not image.filename:
        return None
    content = image.stream.read(MAX_IMAGE_BYTES + 1)
    if len(content) > MAX_IMAGE_BYTES:
        raise ValueError("Фото не должно превышать 8 МБ.")
    suffix = image_suffix(content)
    if suffix is None:
        raise ValueError("Фото должно быть PNG, JPG, WEBP или GIF.")
    safe_name = secure_filename(Path(image.filename).stem) or "image"
    filename = f"{datetime.now():%Y%m%d%H%M%S%f}_{safe_name}"
    filename = f"{filename}{suffix}"
    runtime.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    (runtime.UPLOAD_DIR / filename).write_bytes(content)
    return f"uploads/{filename}"


def image_suffix(content: bytes) -> str | None:
    for signature, suffix in IMAGE_SIGNATURES.items():
        if content.startswith(signature):
            return suffix
    if len(content) >= 12 and content.startswith(b"RIFF") and content[8:12] == b"WEBP":
        return ".webp"
    return None


def delete_uploaded_image(image_path: str | None) -> None:
    if not image_path or not image_path.startswith("uploads/"):
        return
    path = runtime.UPLOAD_DIR / Path(image_path).name
    path.unlink(missing_ok=True)


def product_values_from_input(form: dict, *, fallback_label: str = "") -> dict:
    name = (form.get("name") or "").strip()
    category = (form.get("category") or "").strip()
    weight = parse_number(form.get("serving_grams"), "вес упаковки")
    if not name or not category or weight <= 0:
        raise ValueError("Укажи название, категорию и вес упаковки в граммах.")
    required = ("kcal_100", "protein_100", "fat_100", "carbs_100")
    if any(form.get(field) in (None, "") for field in required):
        raise ValueError("Укажи КБЖУ на 100 г полностью.")
    kcal_100, protein_100, fat_100, carbs_100 = [
        parse_number(form[field], "КБЖУ") for field in required
    ]
    if min(kcal_100, protein_100, fat_100, carbs_100) < 0:
        raise ValueError("КБЖУ не может быть отрицательным.")
    return {
        "name": name,
        "brand": (form.get("brand") or "").strip(),
        "category": category,
        "serving_grams": weight,
        "serving_label": (
            form.get("serving_label") or fallback_label or f"{weight:g} г"
        ).strip(),
        "serving_units": parse_number(form.get("serving_units", 1), "количество порций"),
        "unit_name": (form.get("unit_name") or "порция").strip(),
        "package_units": parse_number(form.get("package_units"), "количество единиц в упаковке", optional=True),
        "kcal_100": kcal_100,
        "protein_100": protein_100,
        "fat_100": fat_100,
        "carbs_100": carbs_100,
        "kcal": kcal_100 * weight / 100,
        "protein": protein_100 * weight / 100,
        "fat": fat_100 * weight / 100,
        "carbs": carbs_100 * weight / 100,
        "benefit_tag": (form.get("benefit_tag") or "").strip() or "обычный выбор",
        "benefit_color": (form.get("benefit_color") or "#6d5dfc").strip(),
        "approximate": (
            1 if str(form.get("approximate", "")).lower() in {"true", "1", "on"} else 0
        ),
        "note": (form.get("note") or "").strip(),
    }


def validate_product_category(category_name: str) -> bool:
    with db() as connection:
        return ProductRepository(connection).category_exists(category_name)


def get_product_registry(query: str = "", category: str = "") -> dict:
    with db() as connection:
        products = ProductRepository(connection)
        product_rows = products.list(query, category)
        benefit_tags = products.list_benefit_tags()

    return {
        "products": [serialize_product(row) for row in product_rows],
        "categories": serialize_product_categories(),
        "benefit_tags": [row["benefit_tag"] for row in benefit_tags],
    }


def create_product_category(payload: dict) -> list[dict]:
    name, icon_key, color = validate_category_payload(payload)

    try:
        with db() as connection:
            ProductRepository(connection).create_category(name, icon_key, color)
    except sqlite3.IntegrityError as error:
        raise ProductCategoryAlreadyExistsError from error

    return serialize_product_categories()


def create_product(form: dict, image: FileStorage | None) -> dict:
    values = product_values_from_input(form)
    if not validate_product_category(values["category"]):
        raise ProductCategoryNotFoundError

    image_path = save_product_image(image)

    try:
        with db() as connection:
            products = ProductRepository(connection)
            product_id = products.create(
                values,
                image_path,
                datetime.now().isoformat(timespec="seconds"),
            )
            product = products.find(product_id)
    except Exception:
        delete_uploaded_image(image_path)
        raise

    return serialize_product(product)


def update_product(product_id: int, payload: dict) -> dict:
    with db() as connection:
        products = ProductRepository(connection)
        existing_product = products.find_record(product_id)

        if not existing_product:
            raise ProductNotFoundError

        values = product_values_from_input(
            payload,
            fallback_label=existing_product["serving_label"],
        )
        if not products.category_exists(values["category"]):
            raise ProductCategoryNotFoundError

        apply_to_history = str(payload.get("apply_to_history", "")).lower() in {
            "true",
            "1",
            "on",
        }
        history_entries_updated = 0
        if apply_to_history:
            confirmation = str(payload.get("history_confirmation", "")).lower()
            if confirmation not in {"true", "1", "confirmed"}:
                raise ProductHistoryConfirmationRequiredError
            history_entries = products.list_history(product_id)

        products.update(product_id, values)

        if apply_to_history:
            for entry in history_entries:
                factor = entry["quantity"]
                if entry["quantity_mode"] == "grams":
                    factor = entry["quantity"] / values["serving_grams"]
                elif entry["quantity_mode"] == "units":
                    factor = entry["quantity"] / values["serving_units"]

                products.update_historical_nutrition(
                    entry["id"],
                    (
                        values["kcal"] * factor,
                        values["protein"] * factor,
                        values["fat"] * factor,
                        values["carbs"] * factor,
                    ),
                )
            history_entries_updated = len(history_entries)

        updated_product = products.find(product_id)

    return {
        "product": serialize_product(updated_product),
        "history_updated": history_entries_updated,
    }


def get_product_history_impact(product_id: int) -> dict:
    with db() as connection:
        products = ProductRepository(connection)
        product = products.find_record(product_id)
        if not product:
            raise ProductNotFoundError
        return {"history_entries": products.count_history(product_id)}


def archive_product(product_id: int) -> dict:
    with db() as connection:
        products = ProductRepository(connection)
        product = products.find_active(product_id)
        if not product:
            raise ProductNotFoundError

        products.archive(product_id)

    return {"archived": True, "id": product_id, "name": product["name"]}


def replace_product_image(product_id: int, image: FileStorage | None) -> dict:
    with db() as connection:
        products = ProductRepository(connection)
        existing_product = products.find_record(product_id)

    if not existing_product:
        raise ProductNotFoundError

    image_path = save_product_image(image)
    if not image_path:
        raise ProductImageRequiredError

    try:
        with db() as connection:
            products = ProductRepository(connection)
            products.update_image(product_id, image_path)
            updated_product = products.find(product_id)
    except Exception:
        delete_uploaded_image(image_path)
        raise

    delete_uploaded_image(existing_product["image_path"])

    previous_image_url = (
        f"/static/{existing_product['image_path']}"
        if existing_product["image_path"]
        else None
    )
    return {
        "product": serialize_product(updated_product),
        "previous_image_url": previous_image_url,
    }
