CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS strategy_versions (
    id INTEGER PRIMARY KEY,
    effective_from TEXT NOT NULL UNIQUE,
    phase TEXT NOT NULL,
    base_tdee REAL NOT NULL,
    protein_min REAL NOT NULL,
    protein_max REAL NOT NULL,
    goal_delta REAL NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    brand TEXT,
    category TEXT NOT NULL,
    serving_label TEXT NOT NULL,
    serving_grams REAL,
    serving_units REAL DEFAULT 1,
    unit_name TEXT DEFAULT 'порция',
    kcal REAL NOT NULL,
    protein REAL NOT NULL,
    fat REAL,
    carbs REAL,
    approximate INTEGER NOT NULL DEFAULT 0,
    note TEXT,
    image_path TEXT,
    benefit_tag TEXT,
    benefit_color TEXT,
    package_units REAL,
    kcal_100 REAL,
    protein_100 REAL,
    fat_100 REAL,
    carbs_100 REAL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS product_categories (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    icon_key TEXT NOT NULL DEFAULT 'utensils',
    color TEXT NOT NULL DEFAULT '#6d5dfc',
    sort_order INTEGER NOT NULL DEFAULT 100,
    active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS product_subcategories (
    id INTEGER PRIMARY KEY,
    category_id INTEGER NOT NULL REFERENCES product_categories(id),
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 100,
    system_key TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    UNIQUE(category_id, name)
);

CREATE TABLE IF NOT EXISTS temp_products (
    id INTEGER PRIMARY KEY,
    log_date TEXT NOT NULL,
    name TEXT NOT NULL,
    nutrition_basis TEXT NOT NULL CHECK(nutrition_basis IN ('serving', 'per_100g')),
    kcal_basis REAL NOT NULL,
    protein_basis REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'promoted', 'archived')),
    promoted_product_id INTEGER REFERENCES products(id),
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_temp_products_status_date
ON temp_products(status, log_date, created_at);

CREATE TABLE IF NOT EXISTS days (
    id INTEGER PRIMARY KEY,
    log_date TEXT NOT NULL UNIQUE,
    day_type TEXT NOT NULL,
    phase TEXT NOT NULL,
    base_tdee REAL NOT NULL,
    goal_delta REAL NOT NULL,
    steps INTEGER NOT NULL DEFAULT 0,
    step_cadence REAL NOT NULL DEFAULT 100,
    manual_adjustment REAL NOT NULL DEFAULT 0,
    cardio_kcal REAL NOT NULL DEFAULT 0,
    note TEXT,
    closed_at TEXT,
    setup_done INTEGER NOT NULL DEFAULT 0,
    current_meal TEXT NOT NULL DEFAULT 'Завтрак',
    training_planned INTEGER,
    closed_weight REAL,
    closed_steps_kcal REAL,
    closed_workout_kcal REAL,
    closed_tdee REAL,
    sleep_start TEXT,
    sleep_end TEXT,
    sleep_deep_percent REAL,
    sleep_rem_percent REAL,
    watch_active_kcal REAL,
    protein_min REAL,
    protein_max REAL,
    strategy_version_id INTEGER REFERENCES strategy_versions(id)
);

CREATE TABLE IF NOT EXISTS food_entries (
    id INTEGER PRIMARY KEY,
    day_id INTEGER NOT NULL REFERENCES days(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    product_name TEXT NOT NULL,
    quantity REAL NOT NULL,
    quantity_mode TEXT NOT NULL DEFAULT 'serving',
    kcal REAL NOT NULL,
    protein REAL NOT NULL,
    fat REAL,
    carbs REAL,
    meal_type TEXT NOT NULL DEFAULT 'Завтрак',
    request_token TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS measurements (
    id INTEGER PRIMARY KEY,
    measured_on TEXT NOT NULL,
    weight REAL,
    waist REAL,
    belly REAL,
    shoulders REAL,
    biceps REAL,
    chest REAL,
    hips REAL,
    thigh REAL,
    note TEXT
);

CREATE TABLE IF NOT EXISTS workouts (
    id INTEGER PRIMARY KEY,
    day_id INTEGER REFERENCES days(id),
    title TEXT NOT NULL,
    duration_minutes REAL NOT NULL,
    intensity_met REAL NOT NULL DEFAULT 3.5,
    note TEXT,
    template_id INTEGER REFERENCES workout_templates(id),
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workout_sets (
    id INTEGER PRIMARY KEY,
    workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    exercise TEXT NOT NULL,
    set_number INTEGER NOT NULL,
    weight REAL NOT NULL,
    reps INTEGER NOT NULL,
    note TEXT,
    is_warmup INTEGER NOT NULL DEFAULT 0,
    exercise_catalog_id INTEGER REFERENCES exercise_catalog(id),
    muscle_profile_snapshot TEXT
);

CREATE TABLE IF NOT EXISTS workout_templates (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    default_duration_minutes REAL NOT NULL DEFAULT 75,
    default_intensity_met REAL NOT NULL DEFAULT 3.5,
    sort_order INTEGER NOT NULL DEFAULT 100,
    active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS workout_template_exercises (
    id INTEGER PRIMARY KEY,
    template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
    exercise_name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 100,
    subgroup_id INTEGER REFERENCES exercise_subgroups(id),
    UNIQUE(template_id, exercise_name)
);

CREATE TABLE IF NOT EXISTS exercise_catalog (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    muscle_group TEXT,
    note TEXT,
    image_path TEXT,
    effectiveness_rating INTEGER NOT NULL DEFAULT 3,
    difficulty_rating INTEGER NOT NULL DEFAULT 3,
    muscle_profile TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_food_entries_request_token
ON food_entries(request_token)
WHERE request_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS exercise_subgroups (
    id INTEGER PRIMARY KEY,
    template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 100,
    collapsed INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    UNIQUE(template_id, name)
);

CREATE TABLE IF NOT EXISTS cardio_sessions (
    id INTEGER PRIMARY KEY,
    workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL DEFAULT 'Беговая дорожка',
    duration_minutes REAL NOT NULL,
    watch_steps INTEGER,
    watch_kcal REAL,
    note TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cardio_intervals (
    id INTEGER PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES cardio_sessions(id) ON DELETE CASCADE,
    start_minute REAL NOT NULL,
    end_minute REAL NOT NULL,
    incline_percent REAL NOT NULL DEFAULT 0,
    speed_kmh REAL NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 1
);
