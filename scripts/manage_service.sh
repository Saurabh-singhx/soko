#!/usr/bin/env bash
# ==============================================================================
# Soko Background Daemon Management Tool (Linux systemd, macOS launchd, Windows)
# Usage: ./scripts/manage_service.sh [install|uninstall|start|stop|restart|status|logs]
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ACTION="${1:-status}"

detect_platform() {
    case "$(uname -s)" in
        Linux*)   echo "linux";;
        Darwin*)  echo "darwin";;
        CYGWIN*|MINGW*|MSYS*) echo "windows";;
        *)        echo "unknown";;
    esac
}

PLATFORM="$(detect_platform)"

# ------------------------------------------------------------------------------
# LINUX SYSTEMD USER SERVICE
# ------------------------------------------------------------------------------
manage_linux() {
    local UNIT_DIR="$HOME/.config/systemd/user"
    local SERVICE_SRC="$SCRIPT_DIR/systemd/soko.service"
    local SERVICE_DEST="$UNIT_DIR/soko.service"

    case "$ACTION" in
        install)
            echo "[Soko Daemon] Installing systemd user service..."
            mkdir -p "$UNIT_DIR"
            # Substitute current node path and project directory dynamically
            local NODE_BIN
            NODE_BIN="$(which node || echo "/usr/bin/node")"
            sed -e "s|ExecStart=.*|ExecStart=${NODE_BIN} ${ROOT_DIR}/scripts/soko_bridge.js|g" \
                -e "s|WorkingDirectory=.*|WorkingDirectory=${ROOT_DIR}|g" \
                "$SERVICE_SRC" > "$SERVICE_DEST"
            systemctl --user daemon-reload
            systemctl --user enable soko.service
            systemctl --user start soko.service
            echo "[Soko Daemon] Service installed and started successfully!"
            systemctl --user status soko.service --no-pager
            ;;
        uninstall)
            echo "[Soko Daemon] Uninstalling systemd user service..."
            systemctl --user stop soko.service 2>/dev/null || true
            systemctl --user disable soko.service 2>/dev/null || true
            rm -f "$SERVICE_DEST"
            systemctl --user daemon-reload
            echo "[Soko Daemon] Service uninstalled."
            ;;
        start)
            systemctl --user start soko.service
            systemctl --user status soko.service --no-pager
            ;;
        stop)
            systemctl --user stop soko.service
            echo "[Soko Daemon] Service stopped."
            ;;
        restart)
            systemctl --user restart soko.service
            systemctl --user status soko.service --no-pager
            ;;
        status)
            systemctl --user status soko.service --no-pager || true
            ;;
        logs)
            local LOG_FILE="${XDG_STATE_HOME:-$HOME/.local/state}/soko/logs/soko_bridge.log"
            if [ -f "$LOG_FILE" ]; then
                echo "[Soko Daemon] Tailing rolling log file ($LOG_FILE):"
                tail -n 50 -f "$LOG_FILE"
            else
                echo "[Soko Daemon] Following systemd journal:"
                journalctl --user -u soko.service -f
            fi
            ;;
        *)
            echo "Unknown action '$ACTION'. Options: install, uninstall, start, stop, restart, status, logs"
            exit 1
            ;;
    esac
}

# ------------------------------------------------------------------------------
# MACOS LAUNCHD AGENT
# ------------------------------------------------------------------------------
manage_darwin() {
    local AGENT_DIR="$HOME/Library/LaunchAgents"
    local PLIST_SRC="$SCRIPT_DIR/launchd/com.soko.bridge.plist"
    local PLIST_DEST="$AGENT_DIR/com.soko.bridge.plist"

    case "$ACTION" in
        install)
            echo "[Soko Daemon] Installing macOS LaunchAgent..."
            mkdir -p "$AGENT_DIR"
            local NODE_BIN
            NODE_BIN="$(which node || echo "/usr/local/bin/node")"
            sed -e "s|/usr/local/bin/node|${NODE_BIN}|g" \
                -e "s|__SOKO_BRIDGE_PATH__|${ROOT_DIR}/scripts/soko_bridge.js|g" \
                -e "s|__SOKO_DIR__|${ROOT_DIR}|g" \
                "$PLIST_SRC" > "$PLIST_DEST"
            launchctl unload "$PLIST_DEST" 2>/dev/null || true
            launchctl load "$PLIST_DEST"
            echo "[Soko Daemon] LaunchAgent installed and loaded!"
            ;;
        uninstall)
            echo "[Soko Daemon] Removing macOS LaunchAgent..."
            launchctl unload "$PLIST_DEST" 2>/dev/null || true
            rm -f "$PLIST_DEST"
            echo "[Soko Daemon] LaunchAgent uninstalled."
            ;;
        start)
            launchctl start com.soko.bridge
            ;;
        stop)
            launchctl stop com.soko.bridge
            ;;
        restart)
            launchctl stop com.soko.bridge
            sleep 1
            launchctl start com.soko.bridge
            ;;
        status)
            launchctl list | grep "com.soko.bridge" || echo "Service not currently running."
            ;;
        logs)
            tail -n 50 -f "$HOME/Library/Logs/soko_bridge.log"
            ;;
        *)
            echo "Unknown action '$ACTION'. Options: install, uninstall, start, stop, restart, status, logs"
            exit 1
            ;;
    esac
}

# ------------------------------------------------------------------------------
# WINDOWS SERVICE
# ------------------------------------------------------------------------------
manage_windows() {
    case "$ACTION" in
        install)
            powershell.exe -ExecutionPolicy Bypass -File "$SCRIPT_DIR/windows/install-service.ps1"
            ;;
        uninstall)
            powershell.exe -Command "Unregister-ScheduledTask -TaskName 'SokoBridgeDaemon' -Confirm:\$false"
            ;;
        start)
            powershell.exe -Command "Start-ScheduledTask -TaskName 'SokoBridgeDaemon'"
            ;;
        stop)
            powershell.exe -Command "Stop-ScheduledTask -TaskName 'SokoBridgeDaemon'"
            ;;
        restart)
            powershell.exe -Command "Stop-ScheduledTask -TaskName 'SokoBridgeDaemon'; Start-ScheduledTask -TaskName 'SokoBridgeDaemon'"
            ;;
        status)
            powershell.exe -Command "Get-ScheduledTask -TaskName 'SokoBridgeDaemon'"
            ;;
        logs)
            powershell.exe -Command "Get-Content -Path \"\$env:LOCALAPPDATA\\soko\\logs\\soko_bridge.log\" -Tail 50 -Wait"
            ;;
        *)
            echo "Unknown action '$ACTION'. Options: install, uninstall, start, stop, restart, status, logs"
            exit 1
            ;;
    esac
}

case "$PLATFORM" in
    linux)   manage_linux ;;
    darwin)  manage_darwin ;;
    windows) manage_windows ;;
    *)
        echo "Unsupported OS: $PLATFORM"
        exit 1
        ;;
esac
