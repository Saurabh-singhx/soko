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

- [ ] **Persistent Android Release Keystore**
  - *Current State*: `scripts/build_apks.sh` generates a temporary keystore via `keytool` on every clean build.
  - *Risk*: Android requires matching certificates for app updates. APKs built across different machines or CI runs fail to update (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`).
  - *Implementation*:
    - Store a production Android release keystore as an encrypted CI secret (`ANDROID_KEYSTORE_BASE64`).
    - Sign release APKs (`soko-mobile.apk`, `soko-mobile-lite.apk`) with the persistent release key.

- [ ] **Android 14+ Foreground Service Media Type Compliance**
  - *Current State*: Manifest registers `foregroundServiceType="connectedDevice"`.
  - *Risk*: Android 14+ (API 34) terminates or throws `SecurityException` for background audio streaming without the media playback type.
  - *Implementation*:
    - Update manifest to `foregroundServiceType="connectedDevice|mediaPlayback"`.
    - Acquire Android `WakeLock` and `WifiLock` during active audio streaming or large file transfers.

- [ ] **Code Signing for Desktop Installers**
  - *Windows*: Acquire an Authenticode EV certificate or configure trusted signing to prevent Microsoft Defender SmartScreen warnings ("Unknown Publisher").
  - *macOS*: Implement Apple Developer ID signing and notarization if shipping macOS builds.
  - *Linux*: Add Flatpak (Flathub) and Snap packaging alongside AppImage and `.deb`.

---

## 4. Desktop Display Server & Multi-Monitor Robustness (Priority: P1)

- [ ] **Dynamic Display Re-centering & DPI Scaling Watcher**
  - *Current State*: `electron/main.cjs` positions the Dynamic Island once on primary display work area at boot.
  - *Risk*: Connecting/disconnecting external monitors or changing display scaling (100% to 150%) can push the window off-screen or misalign it.
  - *Implementation*:
    - Add Electron screen event listeners:
      ```javascript
      screen.on('display-metrics-changed', () => recenterIslandWindow());
      screen.on('display-added', () => recenterIslandWindow());
      screen.on('display-removed', () => recenterIslandWindow());
      ```

- [ ] **Native Wayland Layer-Shell Protocol Support**
  - *Current State*: Forces `--ozone-platform=x11` fallback on Linux to avoid Wayland client-side positioning bugs.
  - *Implementation*:
    - Provide native Wayland layer-shell protocol integration (via `gtk4-layer-shell` or native Tauri Wayland extensions) for pure Wayland compositors (Hyprland, Sway, GNOME Wayland).

- [ ] **In-App Auto-Updater (Silent / Delta Updates)**
  - *Current State*: Gist feed checks notify the user and open browser download links.
  - *Implementation*:
    - Integrate `electron-updater` for automatic background downloading, SHA-256 signature verification, and 1-click restart-to-update.

---

## 5. Audio Pipeline & Background Daemon (Priority: P1 / P2)

- [ ] **Bundled Audio Utilities (`ffmpeg-static`)**
  - *Current State*: Bridge spawns `ffmpeg` from system `PATH`.
  - *Risk*: Systems without `ffmpeg` installed fail audio streaming silently.
  - *Implementation*:
    - Bundle `ffmpeg-static` or a minimal pre-compiled ffmpeg binary inside the desktop distribution package.

- [ ] **Dynamic Audio Output / Device Switching**
  - *Current State*: PulseAudio/PipeWire monitor source is detected once when stream starts.
  - *Implementation*:
    - Listen to `pactl subscribe` / PipeWire node events.
    - Dynamically switch capture stream when user plugs in USB headphones, Bluetooth audio, or external DAC without restarting the bridge.

- [ ] **Low-Latency Audio Codec (Opus)**
  - *Current State*: 192kbps MP3 stream (~150–250ms latency).
  - *Implementation*:
    - Add low-latency Opus WebM stream (`-c:a libopus -b:a 96k`), cutting Wi-Fi bandwidth by 50% and reducing latency to <50ms.

- [ ] **Daemon Service Management (systemd / Windows Service)**
  - *Implementation*:
    - Provide a `systemd --user` unit (`~/.config/systemd/user/soko.service`) on Linux with `Restart=always` and `RestartSec=3s`.
    - Provide a Windows background service / Startup Task for seamless headless boot.

---

## 6. Observability, Error Recovery & Quality Assurance (Priority: P2)

- [ ] **React Error Boundaries**
  - *Implementation*: Wrap Dynamic Island widgets, media controls, and mascot components in React Error Boundaries to prevent a crash in one widget from unmounting the island HUD.

- [ ] **Log Rotation & Resource Bounds**
  - *Implementation*: Implement rolling file logs (max 10MB per file, retaining 3 historical files) for `soko_bridge.log` to prevent disk exhaustion.

- [ ] **Automated Frontend & E2E Testing**
  - *Current State*: 100% pass on bridge integration (63 tests), zero-trust security (54 tests), and island layout assertions (15 tests).
  - *Implementation*:
    - Add Vitest / React Testing Library unit tests for desktop React components.
    - Add Playwright E2E tests for the Electron desktop shell across Windows and Linux runners in CI.
