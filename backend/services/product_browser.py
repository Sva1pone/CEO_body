from __future__ import annotations

from datetime import datetime
from math import isfinite
from uuid import uuid4

from backend.database.sql_commands.product_browser import ProductBrowserRepository
from backend.services.products import ProductNotFoundError, serialize_product
from backend.services.runtime import db


class ProductSubcategoryNotFoundError(Exception):
    pass


class TempProductNotFoundError(Exception):
    pass


class DayNotFoundError(Exception):
    pass


def _positive_number(value: object, field_name: str) -> float:
    try:
        number = float(str(value).strip().replace(",", "."))
    except (TypeError, ValueError) as error:
        raise ValueError(f"Проверь {field_name}.") from error
    if not isfinite(number) or number <= 0:
        raise ValueError(f"{field_name.capitalize()} должно быть больше нуля.")
    return number


def _nonnegative_number(value: object, field_name: str) -> float:
    try:
        number = float(str(value).strip().replace(",", "."))
    except (TypeError, ValueError) as error:
        raise ValueError(f"Проверь {field_name}.") from error
    if not isfinite(number) or number < 0:
        raise ValueError(f"{field_name.capitalize()} не может быть отрицательным.")
    return number


def get_archived_products() -> list[dict]:
    with db() as connection:
        rows = ProductBrowserRepository(connection).list_archived_products()
    return [serialize_product(row) for row in rows]


def restore_product(product_id: int) -> dict:
    with db() as connection:
        restored = ProductBrowserRepository(connection).restore_product(product_id)
    if not restored:
        raise ProductNotFoundError
    return {"restored": True, "product_id": product_id}


def get_subcategories(category_id: int) -> list[dict]:
    with db() as connection:
        rows = ProductBrowserRepository(connection).list_subcategories(category_id)
    return [dict(row) for row in rows]


def create_subcategory(category_id: int, payload: dict) -> list[dict]:
    name = str(payload.get("name") or "").strip()
    if not name:
        raise ValueError("Укажи название подкатегории.")
    if name.casefold() == "неразмечено":
        raise ValueError("Название «Неразмечено» зарезервировано системой.")

    with db() as connection:
        products = ProductBrowserRepository(connection)
        category = products.find_active_category(category_id)
        if category is None:
            raise ProductSubcategoryNotFoundError

        had_subcategories = bool(products.list_subcategories(category_id))
        products.create_or_restore_subcategory(category_id, name)
        if not had_subcategories:
            unassigned_id = products.ensure_unassigned_subcategory(category_id)
            products.assign_unclassified_products(category["name"], unassigned_id)
        rows = products.list_subcategories(category_id)

    return [dict(row) for row in rows]


def move_product_to_subcategory(product_id: int, subcategory_id: int) -> dict:
    with db() as connection:
        products = ProductBrowserRepository(connection)
        subcategory = products.find_active_subcategory(subcategory_id)
        if subcategory is None or not products.move_product(product_id, subcategory_id):
            raise ProductSubcategoryNotFoundError
        products.hide_empty_unassigned_subcategory(subcategory["category_id"])
    return {"product_id": product_id, "subcategory_id": subcategory_id}


def list_temp_products() -> list[dict]:
    with db() as connection:
        rows = ProductBrowserRepository(connection).list_temp_products()
    return [dict(row) for row in rows]


def create_temp_food(day_id: int, payload: dict) -> dict:
    name = str(payload.get("name") or "").strip()
    nutrition_basis = str(payload.get("nutrition_basis") or "serving").strip()
    if not name:
        raise ValueError("Укажи название TEMP-позиции.")
    if nutrition_basis not in {"serving", "per_100g"}:
        raise ValueError("Выбери способ указания КБЖУ.")

    kcal_basis = _nonnegative_number(payload.get("kcal_basis"), "калорийность")
    protein_basis = _nonnegative_number(payload.get("protein_basis"), "белок")
    quantity = 1 if nutrition_basis == "serving" else _positive_number(
        payload.get("quantity", 100),
        "вес",
    )
    multiplier = quantity if nutrition_basis == "serving" else quantity / 100
    created_at = datetime.now().isoformat(timespec="seconds")

    with db() as connection:
        products = ProductBrowserRepository(connection)
        day = products.find_day(day_id)
        if day is None:
            raise DayNotFoundError

        temp_product_id = products.create_temp_product(
            {
                "log_date": day["log_date"],
                "name": name,
                "nutrition_basis": nutrition_basis,
                "kcal_basis": kcal_basis,
                "protein_basis": protein_basis,
            },
            created_at,
        )
        entry_id = products.create_temp_food_entry(
            {
                "day_id": day_id,
                "product_name": name,
                "quantity": quantity,
                "quantity_mode": "serving" if nutrition_basis == "serving" else "grams",
                "kcal": kcal_basis * multiplier,
                "protein": protein_basis * multiplier,
                "meal_type": str(payload.get("meal_type") or day["current_meal"]),
                "request_token": f"temp-{uuid4()}",
                "created_at": created_at,
            }
        )

    return {"temp_product_id": temp_product_id, "entry_id": entry_id}


def promote_temp_product(temp_product_id: int, product_id: int) -> dict:
    with db() as connection:
        products = ProductBrowserRepository(connection)
        if products.find_active_temp_product(temp_product_id) is None:
            raise TempProductNotFoundError
        if products.find_active_product(product_id) is None:
            raise ProductNotFoundError
        if not products.mark_temp_product_promoted(temp_product_id, product_id):
            raise TempProductNotFoundError
    return {"promoted": True, "temp_product_id": temp_product_id, "product_id": product_id}


def update_image_placement(product_id: int, payload: dict) -> dict:
    position_x = _nonnegative_number(payload.get("image_position_x", 50), "позицию по X")
    position_y = _nonnegative_number(payload.get("image_position_y", 50), "позицию по Y")
    scale = _positive_number(payload.get("image_scale", 1), "масштаб")
    if position_x > 100 or position_y > 100 or scale > 3:
        raise ValueError("Положение или масштаб фото вне допустимого диапазона.")
    with db() as connection:
        updated = ProductBrowserRepository(connection).update_product_image_placement(
            product_id,
            position_x,
            position_y,
            scale,
        )
    if not updated:
        raise ProductNotFoundError
    return {
        "product_id": product_id,
        "image_position_x": position_x,
        "image_position_y": position_y,
        "image_scale": scale,
    }
