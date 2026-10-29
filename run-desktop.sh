#!/usr/bin/env bash
# Soko Desktop Launcher
# Automatically launches the native Linux build without requiring FUSE

SOKO_REPO="/home/saurabh/coding/soko"
SCRIPT_DIR="$SOKO_REPO"
UNPACKED_BIN="$SCRIPT_DIR/dist-desktop/linux-unpacked/soko"
APPIMAGE_BIN="$SCRIPT_DIR/dist-desktop/soko-linux-x86_64.AppImage"

# Force stable X11 / XWayland backend on Linux for frameless transparent windows and drag-and-drop
export ELECTRON_OZONE_PLATFORM_HINT="x11"
export NO_AT_BRIDGE=1

STABILITY_FLAGS=(
  "--ozone-platform=x11"
  "--disable-gpu"
)

# Pre-flight: ensure bridge daemon is alive on port 8766
BRIDGE_PID=""
if ! curl -s -m 1 http://127.0.0.1:8766/api/status > /dev/null 2>&1; then
  echo "[Soko Launcher] Starting background bridge daemon on :8766..."
  if command -v node > /dev/null 2>&1; then
    node "$SCRIPT_DIR/scripts/soko_bridge.js" &
    BRIDGE_PID=$!
  elif [ -x "$UNPACKED_BIN" ]; then
    ELECTRON_RUN_AS_NODE=1 "$UNPACKED_BIN" "$SCRIPT_DIR/scripts/soko_bridge.js" &
    BRIDGE_PID=$!
  fi
  sleep 0.5
fi

# Cleanup on exit if launcher spawned the bridge
cleanup() {
  if [ -n "$BRIDGE_PID" ]; then
    kill "$BRIDGE_PID" 2>/dev/null
  fi
}
trap cleanup EXIT INT TERM

# Linux Desktop Runner (supports Wayland and X11 via XWayland)
if [ -x "/opt/Soko/soko" ]; then
  exec /opt/Soko/soko "${STABILITY_FLAGS[@]}" "$@"
elif [ -x "$UNPACKED_BIN" ]; then
  # On Ubuntu 24.04+, unprivileged user namespaces require --no-sandbox if chrome-sandbox lacks root SUID
  if [ ! -u "$SCRIPT_DIR/dist-desktop/linux-unpacked/chrome-sandbox" ]; then
    STABILITY_FLAGS+=("--no-sandbox")
  fi
  exec "$UNPACKED_BIN" "${STABILITY_FLAGS[@]}" "$@"
elif [ -x "$APPIMAGE_BIN" ]; then
  exec "$APPIMAGE_BIN" --appimage-extract-and-run "${STABILITY_FLAGS[@]}" "$@"
else
  echo "Desktop binary not found. Run 'npm run build:linux' first."
  exit 1
fi
