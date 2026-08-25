$ErrorActionPreference = "Stop"

$projectDirectory = Split-Path -Parent $PSScriptRoot
$pythonw = Join-Path $projectDirectory ".venv\Scripts\pythonw.exe"
$application = Join-Path $projectDirectory "app.py"
$nodeModules = Join-Path $projectDirectory "node_modules"
$backendPort = if ($env:CEO_BODY_DEV_BACKEND_PORT) { [int]$env:CEO_BODY_DEV_BACKEND_PORT } else { 5050 }
$frontendPort = if ($env:CEO_BODY_DEV_FRONTEND_PORT) { [int]$env:CEO_BODY_DEV_FRONTEND_PORT } else { 5173 }

if (-not (Test-Path -LiteralPath $pythonw)) {
    throw "Не найдено Python-окружение .venv. Выполни команды установки из README.md."
}

if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw "Не найден npm. Установи Node.js 20 или новее."
}

if (-not (Test-Path -LiteralPath $nodeModules)) {
    throw "Не найдены npm-зависимости. Выполни npm install."
}

function Test-ApplicationEndpoint {
    param(
        [int]$Port,
        [string]$Path,
        [string]$ExpectedText
    )

    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port$Path" -TimeoutSec 2
        return $response.StatusCode -eq 200 -and $response.Content.Contains($ExpectedText)
    }
    catch {
        return $false
    }
}

function Wait-ApplicationEndpoint {
    param(
        [int]$Port,
        [string]$Path,
        [string]$ExpectedText
    )

    foreach ($attempt in 1..20) {
        if (Test-ApplicationEndpoint -Port $Port -Path $Path -ExpectedText $ExpectedText) {
            return
        }
        Start-Sleep -Milliseconds 500
    }
    throw "Сервис на порту $Port не запустился за 10 секунд."
}

function Get-ListenerProcess {
    param([int]$Port)

    $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $listener) {
        return $null
    }
    return Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
}

$backendListener = Get-ListenerProcess -Port $backendPort
if ($backendListener) {
    if (-not $backendListener.CommandLine.Contains($application) -or -not (Test-ApplicationEndpoint -Port $backendPort -Path "/api/strategy" -ExpectedText '"today"')) {
        throw "Порт $backendPort занят другим процессом. Освободи порт и повтори запуск."
    }
}
else {
    Start-Process -FilePath $pythonw -ArgumentList "`"$application`" --headless --port $backendPort" -WorkingDirectory $projectDirectory -WindowStyle Hidden
    Wait-ApplicationEndpoint -Port $backendPort -Path "/api/strategy" -ExpectedText '"today"'
}

$frontendListener = Get-ListenerProcess -Port $frontendPort
if ($frontendListener) {
    if (-not $frontendListener.CommandLine.Contains($projectDirectory) -or -not (Test-ApplicationEndpoint -Port $frontendPort -Path "/" -ExpectedText "<title>СЕО тела</title>")) {
        throw "Порт $frontendPort занят другим процессом. Освободи порт и повтори запуск."
    }
}
else {
    $env:VITE_API_PROXY_TARGET = "http://127.0.0.1:$backendPort"
    Start-Process -FilePath "npm.cmd" -ArgumentList "run dev -- --port $frontendPort" -WorkingDirectory $projectDirectory -WindowStyle Hidden
    Wait-ApplicationEndpoint -Port $frontendPort -Path "/" -ExpectedText "<title>СЕО тела</title>"
}

if (-not $env:CEO_BODY_DEV_SKIP_BROWSER) {
    Start-Process "http://127.0.0.1:$frontendPort"
}
