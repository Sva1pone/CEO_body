import sqlite3


class ProductRepository:
    PRODUCT_COLUMNS = """
        SELECT p.*, c.icon_key AS category_icon, c.color AS category_color,
               s.name AS subcategory_name
        FROM products p
        LEFT JOIN product_categories c ON c.name = p.category
        LEFT JOIN product_subcategories s ON s.id = p.subcategory_id
    """

    def __init__(self, connection: sqlite3.Connection):
        self.connection = connection

    def list(self, query: str = "", category: str = ""):
        conditions = ["p.active=1"]
        parameters = []

        if query:
            conditions.append(
                "(p.name LIKE ? OR p.brand LIKE ? OR p.category LIKE ? OR p.benefit_tag LIKE ?)"
            )
            parameters.extend([f"%{query}%"] * 4)
        if category:
            conditions.append("p.category=?")
            parameters.append(category)

        statement = f"{self.PRODUCT_COLUMNS} WHERE {' AND '.join(conditions)} ORDER BY c.sort_order, p.name"
        return self.connection.execute(statement, parameters).fetchall()

    def list_popular(self, limit: int = 10):
        return self.connection.execute(
            f"""{self.PRODUCT_COLUMNS}
                LEFT JOIN food_entries f ON f.product_id=p.id
                WHERE p.active=1
                GROUP BY p.id
                ORDER BY COUNT(f.id) DESC, p.name
                LIMIT ?""",
            (limit,),
        ).fetchall()

    def list_benefit_tags(self):
        return self.connection.execute("""SELECT DISTINCT benefit_tag FROM products
               WHERE active=1 AND TRIM(COALESCE(benefit_tag, '')) != ''
               ORDER BY benefit_tag COLLATE NOCASE""").fetchall()

    def list_categories(self):
        return self.connection.execute(
            "SELECT * FROM product_categories WHERE active=1 ORDER BY sort_order, name"
        ).fetchall()

    def category_exists(self, name: str) -> bool:
        return (
            self.connection.execute(
                "SELECT 1 FROM product_categories WHERE name=? AND active=1",
                (name,),
            ).fetchone()
            is not None
        )

    def create_category(self, name: str, icon_key: str, color: str) -> None:
        self.connection.execute(
            "INSERT INTO product_categories(name, icon_key, color, sort_order) VALUES (?, ?, ?, ?)",
            (name, icon_key, color, 100),
        )

    def create(self, values: dict, image_path: str | None, created_at: str) -> int:
        cursor = self.connection.execute(
            """INSERT INTO products(
                   name, brand, category, serving_label, serving_grams, serving_units,
                   unit_name, kcal, protein, fat, carbs, approximate, note, image_path,
                   benefit_tag, benefit_color, package_units, kcal_100, protein_100,
                   fat_100, carbs_100, created_at
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                values["name"],
                values["brand"],
                values["category"],
                values["serving_label"],
                values["serving_grams"],
                values["serving_units"],
                values["unit_name"],
                values["kcal"],
                values["protein"],
                values["fat"],
                values["carbs"],
                values["approximate"],
                values["note"],
                image_path,
                values["benefit_tag"],
                values["benefit_color"],
                values["package_units"],
                values["kcal_100"],
                values["protein_100"],
                values["fat_100"],
                values["carbs_100"],
                created_at,
            ),
        )
        return cursor.lastrowid

    def find(self, product_id: int):
        return self.connection.execute(
            f"{self.PRODUCT_COLUMNS} WHERE p.id=?",
            (product_id,),
        ).fetchone()

    def find_record(self, product_id: int):
        return self.connection.execute(
            "SELECT * FROM products WHERE id=?",
            (product_id,),
        ).fetchone()

    def find_active(self, product_id: int):
        return self.connection.execute(
            "SELECT id, name FROM products WHERE id=? AND active=1",
            (product_id,),
        ).fetchone()

    def update(self, product_id: int, values: dict) -> None:
        self.connection.execute(
            """UPDATE products SET
                   name=?, brand=?, category=?, serving_label=?, serving_grams=?, serving_units=?,
                   unit_name=?, package_units=?, kcal=?, protein=?, fat=?, carbs=?, kcal_100=?,
                   protein_100=?, fat_100=?, carbs_100=?, benefit_tag=?, benefit_color=?,
                   approximate=?, note=? WHERE id=?""",
            (
                values["name"],
                values["brand"],
                values["category"],
                values["serving_label"],
                values["serving_grams"],
                values["serving_units"],
                values["unit_name"],
                values["package_units"],
                values["kcal"],
                values["protein"],
                values["fat"],
                values["carbs"],
                values["kcal_100"],
                values["protein_100"],
                values["fat_100"],
                values["carbs_100"],
                values["benefit_tag"],
                values["benefit_color"],
                values["approximate"],
                values["note"],
                product_id,
            ),
        )

    def archive(self, product_id: int) -> None:
        self.connection.execute(
            "UPDATE products SET active=0 WHERE id=?", (product_id,)
        )

    def update_image(self, product_id: int, image_path: str) -> None:
        self.connection.execute(
            "UPDATE products SET image_path=? WHERE id=?", (image_path, product_id)
        )

    def list_history(self, product_id: int):
        return self.connection.execute(
            "SELECT id, quantity, quantity_mode FROM food_entries WHERE product_id=?",
            (product_id,),
        ).fetchall()

    def count_history(self, product_id: int) -> int:
        return self.connection.execute(
            "SELECT COUNT(*) FROM food_entries WHERE product_id=?", (product_id,)
        ).fetchone()[0]

    def update_historical_nutrition(self, entry_id: int, nutrition: tuple) -> None:
        self.connection.execute(
            "UPDATE food_entries SET kcal=?, protein=?, fat=?, carbs=? WHERE id=?",
            (*nutrition, entry_id),
        )
