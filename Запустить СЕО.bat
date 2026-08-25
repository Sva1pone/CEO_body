@echo off
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  echo Не найдено Python-окружение .venv.
  echo Выполни команды установки из README.md.
  pause
  exit /b 1
)

".venv\Scripts\python.exe" app.py
