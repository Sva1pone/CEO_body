$ErrorActionPreference = "Stop"

$projectDirectory = Split-Path -Parent $PSScriptRoot
$pythonw = Join-Path $projectDirectory ".venv\Scripts\pythonw.exe"
$launcher = Join-Path $projectDirectory "autostart_silent.vbs"
$startupDirectory = [Environment]::GetFolderPath("Startup")
$shortcutPath = Join-Path $startupDirectory "CEO Body Local App.lnk"

if (-not (Test-Path -LiteralPath $pythonw)) {
    throw "Не найдено Python-окружение .venv. Выполни команды установки из README.md."
}

$shell = New-Object -ComObject WScript.Shell
if (Test-Path -LiteralPath $shortcutPath) {
    $existingShortcut = $shell.CreateShortcut($shortcutPath)
    if (-not $existingShortcut.Arguments.Contains($launcher)) {
        throw "Ярлык с именем CEO Body Local App уже принадлежит другой установке."
    }
}

$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "$env:WINDIR\System32\wscript.exe"
$shortcut.Arguments = "`"$launcher`""
$shortcut.WorkingDirectory = $projectDirectory
$shortcut.Description = "Тихий запуск локального приложения СЕО тела"
$shortcut.Save()

Write-Host "Автозапуск установлен."
