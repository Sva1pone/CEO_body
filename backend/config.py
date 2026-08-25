import os
import secrets
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
BROWSER_BLOCKED_PORTS = {5060, 5061}


def validate_port(value: str | int | None) -> int:
    try:
        port = int(value or 5050)
    except (TypeError, ValueError) as error:
        raise ValueError("Порт должен быть целым числом.") from error
    if not 1 <= port <= 65535:
        raise ValueError("Порт должен быть в диапазоне от 1 до 65535.")
    if port in BROWSER_BLOCKED_PORTS:
        raise ValueError("Порты 5060 и 5061 блокируются браузерами.")
    return port


def resolve_runtime_paths(environ: dict[str, str] | None = None) -> dict[str, Path]:
    values = environ or os.environ
    data_dir = Path(values.get("CEO_BODY_DATA_DIR", PROJECT_ROOT / "data"))
    return {
        "data_dir": data_dir,
        "database_path": Path(values.get("CEO_BODY_DATABASE_PATH", data_dir / "ceo_body.db")),
        "upload_dir": Path(values.get("CEO_BODY_UPLOAD_DIR", PROJECT_ROOT / "static" / "uploads")),
        "backup_dir": Path(values.get("CEO_BODY_BACKUP_DIR", data_dir / "backups")),
    }


RUNTIME_PATHS = resolve_runtime_paths()
DATA_DIR = RUNTIME_PATHS["data_dir"]
DATABASE_PATH = RUNTIME_PATHS["database_path"]
UPLOAD_DIR = RUNTIME_PATHS["upload_dir"]
BACKUP_DIR = RUNTIME_PATHS["backup_dir"]

SECRET_KEY = os.getenv("CEO_BODY_SECRET_KEY") or secrets.token_urlsafe(32)
HOST = "127.0.0.1"
PORT = validate_port(os.getenv("CEO_BODY_PORT"))
MANUAL_BACKUP_COOLDOWN_SECONDS = int(os.getenv("CEO_BODY_MANUAL_BACKUP_COOLDOWN_SECONDS", "30"))
MANUAL_BACKUP_MAX_FILES = int(os.getenv("CEO_BODY_MANUAL_BACKUP_MAX_FILES", "100"))

# Длина шага остаётся явной оценкой: одних часов без измеренной дистанции недостаточно.
DEFAULT_STEP_LENGTH_METERS = 0.70
