@echo off
REM ==============================================================================
REM Soko Desktop Bridge Daemon Launcher for Windows
REM ==============================================================================

set SOKO_DIR=%~dp0..
cd /d "%SOKO_DIR%"

where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not found on PATH. Please install Node.js v18+.
    pause
    exit /b 1
)

echo [Soko] Starting Soko Desktop Bridge in background...
start "" /b node "%SOKO_DIR%\scripts\soko_bridge.js" > "%LOCALAPPDATA%\soko\soko_bridge_daemon.log" 2>&1
echo [Soko] Daemon started with PID monitor.
