@echo off
setlocal enabledelayedexpansion

:: Soko Desktop Launcher for Windows
:: Automatically launches the background bridge daemon and Soko desktop executable

set "SCRIPT_DIR=%~dp0"
set "UNPACKED_BIN=%SCRIPT_DIR%dist-desktop\win-unpacked\soko.exe"
set "PORTABLE_BIN=%SCRIPT_DIR%dist-desktop\soko-win-x64.exe"
set "BRIDGE_SCRIPT=%SCRIPT_DIR%scripts\soko_bridge.js"

echo [Soko Launcher] Initializing Soko Workstation for Windows...

:: Pre-flight: Ensure bridge daemon is active on port 8766
powershell -NoProfile -NonInteractive -Command "try { $res = Invoke-WebRequest -Uri 'http://127.0.0.1:8766/api/status' -UseBasicParsing -TimeoutSec 1; exit 0 } catch { exit 1 }" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo [Soko Launcher] Starting background bridge daemon on :8766...
  where node >nul 2>&1
  if %ERRORLEVEL% EQU 0 (
    start /B "" node "%BRIDGE_SCRIPT%"
  ) else if exist "%UNPACKED_BIN%" (
    set "ELECTRON_RUN_AS_NODE=1"
    start /B "" "%UNPACKED_BIN%" "%BRIDGE_SCRIPT%"
  ) else (
    echo [Soko Launcher] Warning: Node.js was not detected in PATH.
  )
  timeout /t 1 /nobreak >nul
)

:: Launch Windows Desktop Binary
if exist "%UNPACKED_BIN%" (
  echo [Soko Launcher] Launching Soko Desktop HUD from win-unpacked...
  start "" "%UNPACKED_BIN%" %*
) else if exist "%PORTABLE_BIN%" (
  echo [Soko Launcher] Launching Portable Soko Desktop HUD...
  start "" "%PORTABLE_BIN%" %*
) else (
  echo [Soko Launcher] Packaged Windows binary not found in dist-desktop.
  echo [Soko Launcher] Launching via npm dev:desktop...
  cd /d "%SCRIPT_DIR%apps\desktop"
  npm run dev
)

endlocal
