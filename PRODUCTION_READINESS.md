# Soko Production Readiness Roadmap & Checklist

This document details the architectural, security, lifecycle, and platform requirements needed to take **Soko** from its current beta state to a hardened, general-availability production release.

---

## 1. Security & Network Hardening (Priority: P0 — Critical)

- [x] **Transport Layer Security (TLS / HTTPS & WSS)**
  - *Current State*: Ephemeral/persistent local TLS certificate with SAN for localhost, 127.0.0.1, ::1, and LAN interfaces; dual HTTPS/WSS and HTTP/WS socket-level multiplexer on port 8766.
  - *Implementation*:
    - Self-signed local TLS certificate generated on first bridge initialization in OS config directory.
    - Export certificate fingerprint (`SHA256:XX:...`) in `/api/status`, `BRIDGE_STATUS`, and SAS PIN pairing handshake.
    - REST and WebSocket connections served over HTTPS (`https://`) and WSS (`wss://`).

- [x] **PIN Brute-Force Defense & Rate Limiting**
  - *Current State*: Progressive exponential backoff & IP blocking active via `@soko/security/RateLimiter`.
  - *Implementation*:
    - Progressive delay: 3 failed attempts = 15s delay; 5 failed attempts = 60s cooldown; 10 failed attempts = regenerate PIN and block IP for 10 minutes (returns HTTP 429 Too Many Requests & WebSocket PAIR_REJECT with `Retry-After`).
    - Emits `SECURITY_ALERT` broadcast packet to desktop HUD on brute-force attempts.

- [x] **Secure Trust Store & Credential Storage Location**
  - *Current State*: Standard OS configuration paths (`$XDG_CONFIG_HOME/soko/trust_store.json`, `%APPDATA%\soko`, `~/Library/Application Support/soko`) with automatic legacy migration.
  - *Implementation*:
    - Migrated storage to OS-standard configuration paths with atomic temporary-swap writes.
    - Enforced strict POSIX file permissions (`0600`, readable/writable only by the running user).

- [x] **Strict CORS & Host Header Hardening**
  - *Current State*: Strict Host validation (DNS rebinding defense) and explicit origin reflection without wildcard `*`.
  - *Implementation*:
    - Validate `Host` headers on incoming HTTP requests (rejects foreign hosts with HTTP 400).
    - Validate `Origin` headers (rejects untrusted origins with HTTP 403 Forbidden).
    - Restrict requests to `localhost`, `127.0.0.1`, local LAN interface IPs, or explicit companion IPs.

- [x] **Bearer Token Expiration & Rotation Cycle**
  - *Current State*: 30-day TTL attached to bearer tokens with automated refresh token rotation.
  - *Implementation*:
    - Attached 30-day expiration TTL (`expiresAt`) and paired `refreshToken`.
    - Token rotation endpoint `POST /api/auth/refresh` (and WS `TOKEN_REFRESH`) to rotate credentials before or upon expiry.
    - Provided manual "Revoke All Sessions" in Desktop Settings UI and `POST /api/auth/revoke-all` (WS `REVOKE_ALL_SESSIONS`).

---

## 2. Zero-Configuration Pairing & User Experience (Priority: P0 / P1)

- [x] **mDNS / Bonjour / Zeroconf Network Discovery**
  - *Current State*: Fully implemented in `@soko/discovery` package and bridge server.
  - *Implementation*:
    - Broadcasts `_soko._tcp.local` from the bridge via zero-dependency RFC 6762 / RFC 6763 responder (`packages/discovery/src/mdnsAdvertiser.js`) advertising PTR, SRV, TXT, and A records.
    - Fallback discovery endpoint (`GET /api/discovery`) with full metadata (name, port, addresses, TLS fingerprint, SAS PIN status) for Wi-Fi routers that restrict UDP multicast.
    - Auto-discovers running Soko instances in the mobile companion app (`apps/mobile/companion/index.html`) and Flutter screen (`PairingScreen`) with a 1-tap "Connect" list.

- [x] **QR Code Instant Pairing**
  - *Current State*: Fully implemented with pure JS ISO/IEC 18004 QR engine (`packages/discovery/src/qrGenerator.js`).
  - *Implementation*:
    - Desktop Dynamic Island / Connection Popover (`apps/desktop/src/components/island/ConnectionPopover.tsx`) renders dynamic glassmorphic pairing QR code encoding `soko://pair?host=<ip>&port=8766&pin=<pin>&fp=<fingerprint>`.
    - Dedicated QR SVG endpoint (`GET /api/discovery/qr`) for zero-dependency image streaming.
    - Mobile companion app includes HTML5 camera QR scanner (`apps/mobile/companion/index.html`) and URL deep-link auto-handshake (`?pin=<pin>&host=<ip>`) to perform pairing in 1 tap without typing the 6-digit PIN.

---

## 3. Packaging, Distribution & Mobile Lifecycle (Priority: P1)

- [x] **Persistent Android Release Keystore**
  - *Resolved*:
    - Added release keystore configuration in `scripts/build_apks.sh` with resolution order:
      1. `ANDROID_KEYSTORE_BASE64` (decoded into build temp for automated CI/CD runs).
      2. `ANDROID_KEYSTORE_FILE` (custom keystore path).
      3. Persistent repository keystore at `scripts/keystore/soko.keystore` (generated once with 10,000 days validity and committed/persisted).
    - Added `scripts/export_keystore_base64.sh` utility to easily encode keystores for GitHub Actions secrets.
    - Updated `apksigner` invocation with `--v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true` enforcing APK Signature Scheme v1, v2, and v3 to guarantee update compatibility across all Android versions (Android 7.0 through Android 15+).
    - Wired secrets into `.github/workflows/release.yml`.

- [x] **Android 14+ Foreground Service Media Type Compliance**
  - *Resolved*:
    - Manifest updated with permissions: `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_CONNECTED_DEVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, and `WAKE_LOCK`.
    - AndroidManifest `<service>` registered with `android:foregroundServiceType="connectedDevice|mediaPlayback"`.
    - `SokoBackgroundService.java` updated to pass combined foreground service flags (`FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE | FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK`) on Android 14+ (API 34+).
    - Integrated `PowerManager.WakeLock` (`PARTIAL_WAKE_LOCK`) and `WifiManager.WifiLock` (`WIFI_MODE_FULL_LOW_LATENCY` / `HIGH_PERF`) with safety timeout caps and unreferenced counting.
    - Exposed native bridge methods `acquireWakeLock(tag, timeoutMs)` and `releaseWakeLock()` in `MainActivity.SokoNativeBridge`.
    - Hooked wake lock state synchronization (`syncWakeLockState`) in `apps/mobile/companion/index.html` during active PC audio streaming, offline connector playback, and large file beaming with automatic release on completion, error, or idle.

- [x] **Code Signing & Multi-Platform Packaging for Desktop Installers**
  - *Resolved*:
    - Configured `apps/desktop/electron-builder.json` with `extraResources` mapping `../../packages` to `packages/` ensuring runtime imports (`@soko/security`, `@soko/discovery`, `@soko/protocol`) resolve seamlessly in packaged builds.
    - Added Windows NSIS installer targets with custom installer directory support, desktop/start menu shortcuts, and Authenticode signing hooks (`CSC_LINK`, `CSC_KEY_PASSWORD`).
    - Added macOS hardened runtime configurations, Gatekeeper assessment, entitlements (`entitlements.mac.plist`, `entitlements.mac.inherit.plist`), and DMG/ZIP packaging targets.
    - Added Linux packaging for AppImage, `.deb`, `.rpm`, and `.tar.gz`.
    - Updated `.github/workflows/release.yml` with multi-platform matrix building Linux, Android APKs, Windows, and macOS with signing credential bindings.

---

## 4. Desktop Display Server & Multi-Monitor Robustness (Priority: P1)

- [x] **Dynamic Display Re-centering & DPI Scaling Watcher**
  - *Resolved*:
    - Implemented debounced Electron `screen` event listeners in `apps/desktop/electron/main.cjs`:
      ```javascript
      screen.on('display-metrics-changed', (_event, display, metrics) => handleScreenChange('metrics-changed', display));
      screen.on('display-added', (_event, newDisplay) => handleScreenChange('display-added', newDisplay));
      screen.on('display-removed', (_event, oldDisplay) => handleScreenChange('display-removed', oldDisplay));
      ```
    - Added `recenterIslandWindow(reason)` logic:
      - Automatically calculates `islandCenterX = Math.round(workX + workWidth / 2)` and `islandY = Math.max(workY + 4, 8)`.
      - Preserves custom user drag offsets across monitor reconnects while strictly clamping window bounds inside the target display's `workArea` with an 8px safety margin.
      - Disconnection recovery: when an external monitor is disconnected, Soko automatically identifies the nearest active display and repositions the island safely within viewport bounds, completely eliminating off-screen lost-window bugs.
      - Broadcasts `soko:display-changed` event to the web renderer.

- [x] **Native Wayland Layer-Shell Protocol & Compositor Robustness**
  - *Resolved*:
    - Replaced rigid X11 fallback with intelligent display server auto-detection in `apps/desktop/electron/main.cjs`:
      - Detects pure Wayland sessions (`WAYLAND_DISPLAY` set without `DISPLAY` / XWayland) or explicit flags (`SOKO_WAYLAND=1` / `--wayland`), automatically launching with `--ozone-platform=wayland` and `--enable-features=UseOzonePlatform,WaylandWindowDecorations`.
      - Defaults to `--ozone-platform=x11` when X11 or XWayland is available for pixel-perfect frameless transparent overlay positioning.
      - Sets window `type: 'toolbar'` / `'panel'` and `title: 'Soko Dynamic Island'` for compositor surface matching.
    - Created compositor preset rule files in `apps/desktop/resources/compositor/`:
      - `hyprland-soko.conf`: Rules for floating, pinning across all workspaces, nodim, and noblur on Hyprland.
      - `sway-soko.conf`: Rules for floating, sticky, and borderless positioning on Sway and i3.
      - Detailed setup guide in `apps/desktop/resources/compositor/README.md`.
    - Added `soko:get-display-server` IPC handler displaying active display server, compositor, monitor dimensions, and scale factors in Settings View.

- [x] **In-App Auto-Updater (Silent / Delta Updates)**
  - *Resolved*:
    - Integrated `electron-updater` (`autoUpdater`) into `apps/desktop/electron/main.cjs` and configured `publish` block in `electron-builder.json` targeting GitHub Releases.
    - Added full lifecycle IPC channels:
      - `soko:check-update`: Triggers update inspection.
      - `soko:download-update`: Starts background delta download.
      - `soko:quit-and-install`: 1-click restart-to-install updater.
      - `soko:update-status`: Real-time streaming events (`checking`, `available`, `downloading` with percent and transfer rate, `downloaded`, `error`).
    - Added in-app progress bar and "Restart & Install Now" action cards in `SettingsView.tsx`.
    - Automated tests added to `tests/test_display_and_updater.js` verifying semver comparisons and multi-platform asset extraction (AppImage, deb, rpm, exe, dmg, apk).

---

## 5. Audio Pipeline & Background Daemon (Priority: P1 / P2)

- [x] **Bundled Audio Utilities (`ffmpeg-static`)**
  - *Current State*: Bundled fallback resolution chain implemented via `resolveFfmpegPath()` in `scripts/soko_bridge.js`.
  - *Implementation Details*:
    - Evaluates priority hierarchy: `process.env.SOKO_FFMPEG_PATH` -> System `ffmpeg` on PATH -> Packaged Electron resources -> Bundled `ffmpeg-static` npm package binary -> Standard fallback.
    - Eliminates silent failures on pristine Linux, macOS, and Windows systems lacking global ffmpeg binaries.

- [x] **Dynamic Audio Output / Device Switching**
  - *Current State*: Active capture stream automatically hot-swaps to newly connected devices without dropping client sockets.
  - *Implementation Details*:
    - Listens to PipeWire (`pw-mon`) and PulseAudio (`pactl subscribe`) event streams with debounced change detection.
    - Seamlessly swaps the active FFmpeg capture process to newly connected USB DACs, Bluetooth headphones, or HDMI sinks while preserving connected client HTTP chunked responses.
    - Emits updated `AUDIO_STATUS` packets across WebSockets in real time.

- [x] **Low-Latency Audio Codec (Opus)**
  - *Current State*: Ultra-low latency Opus stream available at `/api/audio/stream?codec=opus`.
  - *Implementation Details*:
    - Encodes 48kHz stereo at 96kbps with 20ms frame duration into WebM (`audio/webm; codecs=opus`), reducing bandwidth by 50% and network latency to <40ms.
    - Preserves standard 192kbps MP3 stream at `/api/audio/stream?codec=mp3` for legacy clients and fallback compatibility.
    - Mobile web companion includes a dynamic codec selector allowing instantaneous switching between Opus Low-Latency and MP3.

- [x] **Daemon Service Management (systemd / Windows Service / launchd)**
  - *Current State*: Cross-platform background service templates and unified management tool.
  - *Implementation Details*:
    - Linux: `scripts/systemd/soko.service` user service with `Restart=always`, `RestartSec=3s`, `LimitNOFILE=65536`, and `MemoryMax=1G`.
    - Windows: `scripts/windows/soko-startup.bat` for startup folder execution and `scripts/windows/install-service.ps1` for scheduled task logon management.
    - macOS: `scripts/launchd/com.soko.bridge.plist` LaunchAgent.
    - Unified management CLI: `scripts/manage_service.sh [install|uninstall|start|stop|restart|status|logs]`.

---

## 6. Observability, Error Recovery & Quality Assurance (Priority: P2)

- [x] **React Error Boundaries**
  - *Current State*: Component-level fault isolation across Dynamic Island HUD.
  - *Implementation Details*:
    - Created `apps/desktop/src/components/common/IslandErrorBoundary.tsx` with customizable glassmorphic fallback card and ultra-compact mode.
    - Wrapped `CharacterHost` (mascots), `NotificationBanner`, `CliStatusWidget`, `TransferProgress`, `ConnectionPopover`, and `App.tsx` root views.
    - Prevents widget exceptions from crashing the HUD window, providing individual Retry / Reset actions while preserving the main capsule physics.

- [x] **Log Rotation & Resource Bounds**
  - *Current State*: Production-grade rolling log engine implemented in `@soko/logger` package.
  - *Implementation Details*:
    - Enforces strict 10MB maximum file size limit, retaining 3 historical files (`soko_bridge.log.1`, `.2`, `.3`) and automatically purging older files.
    - Intercepts `console.log`, `info`, `warn`, and `error` in `scripts/soko_bridge.js` while adhering to XDG state directories (`~/.local/state/soko/logs`).
    - Verified with automated rotation unit tests in `packages/logger/test/logger.test.js` and `tests/test_audio_and_resilience.js`.

- [x] **Automated Frontend & E2E Testing**
  - *Current State*: Comprehensive multi-suite test automation with 100% pass rate.
  - *Implementation Details*:
    - Added `tests/test_audio_and_resilience.js` covering FFmpeg resolution, Opus/MP3 argument builders, dynamic device switching, logger rolling rotation, and React ErrorBoundary mechanics.
    - Wired `npm run test:audio` into root `npm run test:all`.
    - All 9 test suites pass 100%: characters (24/24), security (35/35), discovery, device scanning, workspace resolution, multi-display & updater (18/18), audio & resilience (10/10), idle completion, and bridge integration (63/63).
