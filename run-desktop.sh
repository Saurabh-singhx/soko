#!/usr/bin/env bash
# Soko Desktop Launcher
# Automatically launches the native Linux build with intelligent X11 / Wayland detection
# and GPU acceleration for fluid 60fps animations with software fallback.

SOKO_REPO="/home/saurabh/coding/soko"
SCRIPT_DIR="$SOKO_REPO"
UNPACKED_BIN="$SCRIPT_DIR/dist-desktop/linux-unpacked/soko"
APPIMAGE_BIN="$SCRIPT_DIR/dist-desktop/soko-linux-x86_64.AppImage"

# -----------------------------------------------------------------------------
# 1. Display Server & Ozone Platform Resolution
# -----------------------------------------------------------------------------
HAS_X11=""
if [ -n "$DISPLAY" ]; then
  HAS_X11="1"
fi

IS_WAYLAND_SESSION=""
if [ -n "$WAYLAND_DISPLAY" ] || [ "${XDG_SESSION_TYPE:-}" = "wayland" ]; then
  IS_WAYLAND_SESSION="1"
fi

FORCE_WAYLAND=""
if [ "${SOKO_WAYLAND:-}" = "1" ]; then
  FORCE_WAYLAND="1"
fi
for arg in "$@"; do
  if [ "$arg" = "--wayland" ]; then
    FORCE_WAYLAND="1"
  fi
done

STABILITY_FLAGS=()

# If user forced Wayland or we are on pure Wayland without X11, use Wayland backend
if [ -n "$FORCE_WAYLAND" ] || { [ -z "$HAS_X11" ] && [ -n "$IS_WAYLAND_SESSION" ]; }; then
  export ELECTRON_OZONE_PLATFORM_HINT="wayland"
  STABILITY_FLAGS+=(
    "--ozone-platform=wayland"
    "--enable-features=UseOzonePlatform,WaylandWindowDecorations"
  )
else
  # Default to stable X11 / XWayland for transparent frameless overlays
  export ELECTRON_OZONE_PLATFORM_HINT="x11"
  STABILITY_FLAGS+=(
    "--ozone-platform=x11"
  )
fi

export NO_AT_BRIDGE=1

# -----------------------------------------------------------------------------
# 2. Hardware Acceleration & GPU Flags
# Enabled by default for 60fps Framer Motion spring physics.
# Pass --disable-gpu or set SOKO_DISABLE_GPU=1 for software fallback if running on headless/VM.
# -----------------------------------------------------------------------------
DISABLE_GPU=""
if [ "${SOKO_DISABLE_GPU:-}" = "1" ]; then
  DISABLE_GPU="1"
fi
for arg in "$@"; do
  if [ "$arg" = "--disable-gpu" ] || [ "$arg" = "--no-gpu" ]; then
    DISABLE_GPU="1"
  fi
done

if [ -n "$DISABLE_GPU" ]; then
  STABILITY_FLAGS+=("--disable-gpu")
else
  STABILITY_FLAGS+=(
    "--enable-transparent-visuals"
    "--enable-gpu-rasterization"
    "--enable-zero-copy"
  )
fi

# -----------------------------------------------------------------------------
# 3. Background Bridge Daemon Pre-Flight (Port 8766)
# -----------------------------------------------------------------------------
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

# -----------------------------------------------------------------------------
# 4. Linux Desktop Binary Execution
# Dynamically selects the newest binary between local unpacked build,
# installed /opt/Soko package, or AppImage artifact.
# -----------------------------------------------------------------------------
TARGET_BIN=""
if [ -x "$UNPACKED_BIN" ] && [ -x "/opt/Soko/soko" ]; then
  if [ "$UNPACKED_BIN" -nt "/opt/Soko/soko" ]; then
    TARGET_BIN="$UNPACKED_BIN"
  else
    TARGET_BIN="/opt/Soko/soko"
  fi
elif [ -x "$UNPACKED_BIN" ]; then
  TARGET_BIN="$UNPACKED_BIN"
elif [ -x "/opt/Soko/soko" ]; then
  TARGET_BIN="/opt/Soko/soko"
elif [ -x "$APPIMAGE_BIN" ]; then
  TARGET_BIN="$APPIMAGE_BIN"
fi

if [ -n "$TARGET_BIN" ]; then
  if [ "$TARGET_BIN" = "$UNPACKED_BIN" ]; then
    if [ ! -u "$SCRIPT_DIR/dist-desktop/linux-unpacked/chrome-sandbox" ]; then
      STABILITY_FLAGS+=("--no-sandbox")
    fi
    exec "$TARGET_BIN" "${STABILITY_FLAGS[@]}" "$@"
  elif [ "$TARGET_BIN" = "$APPIMAGE_BIN" ]; then
    exec "$TARGET_BIN" --appimage-extract-and-run "${STABILITY_FLAGS[@]}" "$@"
  else
    exec "$TARGET_BIN" "${STABILITY_FLAGS[@]}" "$@"
  fi
else
  echo "Desktop binary not found. Run 'npm run build:linux' first."
  exit 1
fi
