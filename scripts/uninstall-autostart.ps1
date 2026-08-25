$ErrorActionPreference = "Stop"

$projectDirectory = Split-Path -Parent $PSScriptRoot
$launcher = Join-Path $projectDirectory "autostart_silent.vbs"
$startupDirectory = [Environment]::GetFolderPath("Startup")
$shortcutPath = Join-Path $startupDirectory "CEO Body Local App.lnk"

if (-not (Test-Path -LiteralPath $shortcutPath)) {
    Write-Host "Автозапуск уже удалён."
    exit 0
}

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
if (-not $shortcut.Arguments.Contains($launcher)) {
    throw "Ярлык CEO Body Local App принадлежит другой установке и не был удалён."
}

Remove-Item -LiteralPath $shortcutPath -Force
Write-Host "Автозапуск удалён."
