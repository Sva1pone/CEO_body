from __future__ import annotations

from flask import Blueprint, jsonify, request

from backend.services.products import (
    ProductCategoryAlreadyExistsError,
    ProductCategoryNotFoundError,
    ProductImageRequiredError,
    ProductHistoryConfirmationRequiredError,
    ProductNotFoundError,
    archive_product,
    create_product,
    create_product_category,
    get_product_history_impact,
    get_product_registry,
    replace_product_image,
    update_product,
)
from backend.services.product_browser import (
    DayNotFoundError,
    ProductSubcategoryNotFoundError,
    TempProductNotFoundError,
    create_subcategory,
    create_temp_food,
    get_archived_products,
    get_subcategories,
    list_temp_products,
    move_product_to_subcategory,
    promote_temp_product,
    restore_product,
    update_image_placement,
)

product_routes = Blueprint("products", __name__)


@product_routes.get("/api/registry")
def api_registry():
    query = request.args.get("q", "").strip()
    category = request.args.get("category", "").strip()

    return jsonify(get_product_registry(query, category))


@product_routes.get("/api/registry/archive")
def api_archived_registry():
    return jsonify({"products": get_archived_products()})


@product_routes.post("/api/categories")
def api_create_category():
    payload = request.get_json(silent=True) or {}

    try:
        categories = create_product_category(payload)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except ProductCategoryAlreadyExistsError:
        return jsonify({"error": "Такая категория уже существует."}), 409

    return jsonify({"categories": categories}), 201


@product_routes.post("/api/registry")
def api_create_product():
    try:
        product = create_product(request.form, request.files.get("image"))
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except ProductCategoryNotFoundError:
        return jsonify({"error": "Выбери существующую категорию."}), 400

    return jsonify({"product": product}), 201


@product_routes.patch("/api/registry/<int:product_id>")
def api_update_product(product_id: int):
    payload = request.get_json(silent=True) or {}

    try:
        result = update_product(product_id, payload)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except ProductCategoryNotFoundError:
        return jsonify({"error": "Выбери существующую категорию."}), 400
    except ProductHistoryConfirmationRequiredError:
        return jsonify({"error": "Подтверди пересчёт исторических записей."}), 400
    except ProductNotFoundError:
        return jsonify({"error": "Продукт не найден."}), 404

    return jsonify(result)


@product_routes.get("/api/registry/<int:product_id>/history-impact")
def api_product_history_impact(product_id: int):
    try:
        return jsonify(get_product_history_impact(product_id))
    except ProductNotFoundError:
        return jsonify({"error": "Продукт не найден."}), 404


@product_routes.delete("/api/registry/<int:product_id>")
def api_archive_product(product_id: int):
    try:
        result = archive_product(product_id)
    except ProductNotFoundError:
        return jsonify({"error": "Продукт не найден."}), 404

    return jsonify(result)


@product_routes.post("/api/registry/<int:product_id>/restore")
def api_restore_product(product_id: int):
    try:
        return jsonify(restore_product(product_id))
    except ProductNotFoundError:
        return jsonify({"error": "Архивный продукт не найден."}), 404


@product_routes.get("/api/categories/<int:category_id>/subcategories")
def api_product_subcategories(category_id: int):
    return jsonify({"subcategories": get_subcategories(category_id)})


@product_routes.post("/api/categories/<int:category_id>/subcategories")
def api_create_product_subcategory(category_id: int):
    payload = request.get_json(silent=True) or {}
    try:
        subcategories = create_subcategory(category_id, payload)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except ProductSubcategoryNotFoundError:
        return jsonify({"error": "Категория не найдена."}), 404
    return jsonify({"subcategories": subcategories}), 201


@product_routes.patch("/api/registry/<int:product_id>/subcategory")
def api_move_product_to_subcategory(product_id: int):
    payload = request.get_json(silent=True) or {}
    try:
        result = move_product_to_subcategory(
            product_id,
            int(payload.get("subcategory_id")),
        )
    except (TypeError, ValueError):
        return jsonify({"error": "Подкатегория указана неверно."}), 400
    except ProductSubcategoryNotFoundError:
        return jsonify({"error": "Позиция и подкатегория не совпадают."}), 400
    return jsonify(result)


@product_routes.get("/api/temp-products")
def api_temp_products():
    return jsonify({"products": list_temp_products()})


@product_routes.post("/api/day/<int:day_id>/temp-food")
def api_create_temp_food(day_id: int):
    payload = request.get_json(silent=True) or {}
    try:
        result = create_temp_food(day_id, payload)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except DayNotFoundError:
        return jsonify({"error": "День не найден."}), 404
    return jsonify(result), 201


@product_routes.post("/api/temp-products/<int:temp_product_id>/promote")
def api_promote_temp_product(temp_product_id: int):
    payload = request.get_json(silent=True) or {}
    try:
        result = promote_temp_product(temp_product_id, int(payload.get("product_id")))
    except (TypeError, ValueError):
        return jsonify({"error": "Обычная позиция указана неверно."}), 400
    except TempProductNotFoundError:
        return jsonify({"error": "TEMP-позиция не найдена."}), 404
    except ProductNotFoundError:
        return jsonify({"error": "Обычная позиция не найдена."}), 404
    return jsonify(result)


@product_routes.post("/api/registry/<int:product_id>/image")
@product_routes.patch("/api/registry/<int:product_id>/image")
def api_update_product_image(product_id: int):
    try:
        result = replace_product_image(product_id, request.files.get("image"))
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except ProductImageRequiredError:
        return jsonify({"error": "Выбери файл изображения."}), 400
    except ProductNotFoundError:
        return jsonify({"error": "Продукт не найден."}), 404

    return jsonify(result)


@product_routes.patch("/api/registry/<int:product_id>/image-placement")
def api_update_product_image_placement(product_id: int):
    payload = request.get_json(silent=True) or {}
    try:
        return jsonify(update_image_placement(product_id, payload))
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except ProductNotFoundError:
        return jsonify({"error": "Продукт не найден."}), 404
