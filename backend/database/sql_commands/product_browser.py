import sqlite3


class ProductBrowserRepository:
    def __init__(self, connection: sqlite3.Connection):
        self.connection = connection

    def list_archived_products(self):
        return self.connection.execute(
            """SELECT p.*, c.id AS category_id, c.icon_key AS category_icon,
                      c.color AS category_color, s.name AS subcategory_name
               FROM products p
               LEFT JOIN product_categories c ON c.name=p.category
               LEFT JOIN product_subcategories s ON s.id=p.subcategory_id
               WHERE p.active=0
               ORDER BY c.sort_order, p.name COLLATE NOCASE, p.id"""
        ).fetchall()

    def restore_product(self, product_id: int) -> bool:
        cursor = self.connection.execute(
            "UPDATE products SET active=1 WHERE id=? AND active=0",
            (product_id,),
        )
        return cursor.rowcount == 1

    def list_subcategories(self, category_id: int):
        return self.connection.execute(
            """SELECT * FROM product_subcategories
               WHERE category_id=? AND active=1
               ORDER BY sort_order, name COLLATE NOCASE, id""",
            (category_id,),
        ).fetchall()

    def find_active_category(self, category_id: int):
        return self.connection.execute(
            "SELECT * FROM product_categories WHERE id=? AND active=1",
            (category_id,),
        ).fetchone()

    def find_active_subcategory(self, subcategory_id: int):
        return self.connection.execute(
            "SELECT * FROM product_subcategories WHERE id=? AND active=1",
            (subcategory_id,),
        ).fetchone()

    def create_or_restore_subcategory(self, category_id: int, name: str) -> int:
        existing = self.connection.execute(
            "SELECT id FROM product_subcategories WHERE category_id=? AND name=?",
            (category_id, name),
        ).fetchone()
        if existing:
            self.connection.execute(
                "UPDATE product_subcategories SET active=1 WHERE id=?",
                (existing["id"],),
            )
            return existing["id"]
        cursor = self.connection.execute(
            """INSERT INTO product_subcategories(category_id, name, sort_order)
               VALUES (?, ?, 100)""",
            (category_id, name),
        )
        return cursor.lastrowid

    def ensure_unassigned_subcategory(self, category_id: int) -> int:
        existing = self.connection.execute(
            """SELECT id FROM product_subcategories
               WHERE category_id=? AND system_key='unassigned'""",
            (category_id,),
        ).fetchone()
        if existing:
            self.connection.execute(
                "UPDATE product_subcategories SET active=1 WHERE id=?",
                (existing["id"],),
            )
            return existing["id"]
        cursor = self.connection.execute(
            """INSERT INTO product_subcategories(
                   category_id, name, sort_order, system_key
               ) VALUES (?, 'Неразмечено', 0, 'unassigned')""",
            (category_id,),
        )
        return cursor.lastrowid

    def assign_unclassified_products(
        self,
        category_name: str,
        subcategory_id: int,
    ) -> None:
        self.connection.execute(
            """UPDATE products SET subcategory_id=?
               WHERE category=? AND subcategory_id IS NULL""",
            (subcategory_id, category_name),
        )

    def move_product(self, product_id: int, subcategory_id: int) -> bool:
        cursor = self.connection.execute(
            """UPDATE products SET subcategory_id=?
               WHERE id=? AND active=1 AND category=(
                   SELECT category.name
                   FROM product_categories category
                   JOIN product_subcategories subcategory
                     ON subcategory.category_id=category.id
                   WHERE subcategory.id=? AND subcategory.active=1
               )""",
            (subcategory_id, product_id, subcategory_id),
        )
        return cursor.rowcount == 1

    def hide_empty_unassigned_subcategory(self, category_id: int) -> None:
        self.connection.execute(
            """UPDATE product_subcategories SET active=0
               WHERE category_id=? AND system_key='unassigned'
                 AND NOT EXISTS(
                     SELECT 1 FROM products
                     WHERE subcategory_id=product_subcategories.id AND active=1
                 )""",
            (category_id,),
        )

    def create_temp_product(self, values: dict, created_at: str) -> int:
        cursor = self.connection.execute(
            """INSERT INTO temp_products(
                   log_date, name, nutrition_basis, kcal_basis,
                   protein_basis, created_at
               ) VALUES (?, ?, ?, ?, ?, ?)""",
            (
                values["log_date"],
                values["name"],
                values["nutrition_basis"],
                values["kcal_basis"],
                values["protein_basis"],
                created_at,
            ),
        )
        return cursor.lastrowid

    def list_temp_products(self):
        return self.connection.execute(
            """SELECT * FROM temp_products
               WHERE status='active'
               ORDER BY created_at DESC, id DESC"""
        ).fetchall()

    def find_active_temp_product(self, temp_product_id: int):
        return self.connection.execute(
            "SELECT * FROM temp_products WHERE id=? AND status='active'",
            (temp_product_id,),
        ).fetchone()

    def find_active_product(self, product_id: int):
        return self.connection.execute(
            "SELECT id FROM products WHERE id=? AND active=1",
            (product_id,),
        ).fetchone()

    def find_day(self, day_id: int):
        return self.connection.execute(
            "SELECT * FROM days WHERE id=?",
            (day_id,),
        ).fetchone()

    def create_temp_food_entry(self, values: dict) -> int:
        cursor = self.connection.execute(
            """INSERT INTO food_entries(
                   day_id, product_id, product_name, quantity, quantity_mode,
                   kcal, protein, fat, carbs, meal_type, request_token, created_at
               ) VALUES (?, NULL, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)""",
            (
                values["day_id"],
                values["product_name"],
                values["quantity"],
                values["quantity_mode"],
                values["kcal"],
                values["protein"],
                values["meal_type"],
                values["request_token"],
                values["created_at"],
            ),
        )
        return cursor.lastrowid

    def mark_temp_product_promoted(
        self,
        temp_product_id: int,
        product_id: int,
    ) -> bool:
        cursor = self.connection.execute(
            """UPDATE temp_products
               SET status='promoted', promoted_product_id=?
               WHERE id=? AND status='active'""",
            (product_id, temp_product_id),
        )
        return cursor.rowcount == 1

    def update_product_image_placement(
        self,
        product_id: int,
        position_x: float,
        position_y: float,
        scale: float,
    ) -> bool:
        cursor = self.connection.execute(
            """UPDATE products
               SET image_position_x=?, image_position_y=?, image_scale=?
               WHERE id=?""",
            (position_x, position_y, scale, product_id),
        )
        return cursor.rowcount == 1
