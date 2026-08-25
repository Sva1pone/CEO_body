import sqlite3
from datetime import datetime
from pathlib import Path


class ManualBackupLimitError(Exception):
    pass


def create_backup(
    database_path: Path, backup_directory: Path, reason: str = "manual"
) -> dict:
    backup_directory.mkdir(parents=True, exist_ok=True)
    safe_reason = (
        "".join(
            character
            for character in reason.lower()
            if character.isalnum() or character in "-_"
        )
        or "manual"
    )
    filename = f"ceo_body_{safe_reason}_{datetime.now():%Y%m%d_%H%M%S_%f}.db"
    destination = backup_directory / filename
    temporary_destination = backup_directory / f".{filename}.partial"

    source = sqlite3.connect(database_path)
    target = sqlite3.connect(temporary_destination)
    try:
        source.backup(target)
        target.close()
        target = None
        temporary_destination.replace(destination)
    finally:
        if target is not None:
            target.close()
        source.close()
        temporary_destination.unlink(missing_ok=True)

    file_info = destination.stat()
    return {
        "filename": filename,
        "size": file_info.st_size,
        "created_at": datetime.fromtimestamp(file_info.st_mtime).isoformat(
            timespec="seconds"
        ),
        "download_url": f"/api/backups/{filename}/download",
    }


def list_backups(backup_directory: Path) -> list[dict]:
    backup_directory.mkdir(parents=True, exist_ok=True)
    backup_files = sorted(
        backup_directory.glob("ceo_body_*.db"),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    return [_backup_details(path) for path in backup_files]


def validate_manual_backup_creation(
    backup_directory: Path, cooldown_seconds: int, max_files: int
) -> None:
    manual_backups = sorted(
        backup_directory.glob("ceo_body_manual_*.db"),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    if len(manual_backups) >= max_files:
        raise ManualBackupLimitError(
            f"Достигнут лимит ручных копий: {max_files}. Скачай или перенеси старые копии, затем повтори."
        )
    if manual_backups:
        elapsed = datetime.now().timestamp() - manual_backups[0].stat().st_mtime
        if elapsed < cooldown_seconds:
            remaining = max(1, int(cooldown_seconds - elapsed))
            raise ManualBackupLimitError(
                f"Следующую ручную копию можно создать через {remaining} сек."
            )


def find_backup(backup_directory: Path, filename: str) -> Path | None:
    if Path(filename).name != filename:
        return None
    if not filename.startswith("ceo_body_") or not filename.endswith(".db"):
        return None
    path = backup_directory / filename
    return path if path.is_file() else None


def _backup_details(path: Path) -> dict:
    file_info = path.stat()
    return {
        "filename": path.name,
        "size": file_info.st_size,
        "created_at": datetime.fromtimestamp(file_info.st_mtime).isoformat(
            timespec="seconds"
        ),
        "download_url": f"/api/backups/{path.name}/download",
    }
