# Soko Desktop Launcher for Windows (PowerShell)
# Automatically launches the background bridge daemon and Soko desktop executable

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$UnpackedBin = Join-Path $ScriptDir "dist-desktop\win-unpacked\soko.exe"
$PortableBin = Join-Path $ScriptDir "dist-desktop\soko-win-x64.exe"
$BridgeScript = Join-Path $ScriptDir "scripts\soko_bridge.js"

Write-Host "[Soko Launcher] Initializing Soko Workstation for Windows..." -ForegroundColor Cyan

# Pre-flight: Ensure bridge daemon is active on port 8766
$isAlive = $false
try {
    $res = Invoke-WebRequest -Uri "http://127.0.0.1:8766/api/status" -UseBasicParsing -TimeoutSec 1 -ErrorAction SilentlyContinue
    if ($res.StatusCode -eq 200) { $isAlive = $true }
} catch {}

if (-not $isAlive) {
    Write-Host "[Soko Launcher] Starting background bridge daemon on :8766..." -ForegroundColor Yellow
    if (Get-Command node -ErrorAction SilentlyContinue) {
        Start-Process node -ArgumentList "`"$BridgeScript`"" -WindowStyle Hidden
    } elseif (Test-Path $UnpackedBin) {
        $env:ELECTRON_RUN_AS_NODE = "1"
        Start-Process $UnpackedBin -ArgumentList "`"$BridgeScript`"" -WindowStyle Hidden
    }
    Start-Sleep -Milliseconds 800
}

# Launch Desktop Executable
if (Test-Path $UnpackedBin) {
    Write-Host "[Soko Launcher] Launching Soko Desktop HUD from win-unpacked..." -ForegroundColor Green
    Start-Process $UnpackedBin -ArgumentList $args
} elseif (Test-Path $PortableBin) {
    Write-Host "[Soko Launcher] Launching Portable Soko Desktop HUD..." -ForegroundColor Green
    Start-Process $PortableBin -ArgumentList $args
} else {
    Write-Host "[Soko Launcher] Packaged binary not found. Launching via npm dev:desktop..." -ForegroundColor Yellow
    Set-Location (Join-Path $ScriptDir "apps\desktop")
    npm run dev
}
