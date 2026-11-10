<div align="center">

<img src="docs/assets/soko-mascot.gif" width="140" height="140" alt="Soko Mascot HUD" />

# Soko (そ小)

### *Dynamic Island Desktop HUD & High-Speed Android Companion*

[![GitHub Release](https://img.shields.io/github/v/release/Saurabh-singhx/soko?include_prereleases&color=7c3aed&style=for-the-badge&logo=github)](https://github.com/Saurabh-singhx/soko/releases)
[![Platform](https://img.shields.io/badge/Platform-Linux%20%7C%20Windows%20%7C%20macOS%20%7C%20Android-007ACC?style=for-the-badge&logo=linux)](https://github.com/Saurabh-singhx/soko/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-10b981?style=for-the-badge)](LICENSE)
[![Build Status](https://img.shields.io/badge/Build-Passing-emerald?style=for-the-badge&logo=githubactions)](https://github.com/Saurabh-singhx/soko)
[![Test Suites](https://img.shields.io/badge/Tests-9%20Suites%20Passing%20(100%25)-purple?style=for-the-badge&logo=vitest)](tests/README.md)

<p align="center">
  <b>Zero-Cloud Local Workstation Integration</b><br>
  Reactive OLED Mascot HUD • High-Speed Hotspot File Transfers (60 MB/s) • Real-Time Notification Mirroring • Remote CLI Agent Terminal • Dual-Codec Desktop Audio (Opus 40ms / MP3 192k) • YouTube Music Offline Sync • Zero-Trust Security Engine
</p>

[✨ Key Features](#-features) • [📥 Downloads](#-downloads) • [🏗️ Architecture](#-system-architecture) • [🚀 Quick Start](#-quick-start) • [🧪 Testing](#-testing) • [🛡️ Security](#-security--zero-trust) • [📖 Documentation](#-deep-dive-documentation)

</div>

---

## 💡 What is Soko?

**Soko** transforms your desktop (Linux, Windows, and macOS) and Android device into a synchronized, zero-latency workstation. 

Unlike proprietary cloud bridges or heavy screen-mirroring tools, Soko operates **100% locally** over peer-to-peer Wi-Fi LAN, Hotspot, and Bluetooth Low Energy. It pairs a sleek, floating top-center **Dynamic Island HUD** on your desktop with an ultra-responsive companion app on your phone.

Whether you need to beam 100MB+ APKs and media files across devices in seconds without touching cellular data, keep an eye on real-time smartphone notifications while coding, monitor remote CLI agent workflows, stream PC audio to your phone with sub-40ms latency, or sync YouTube Music offline with zero core bloat, Soko does it all with **zero internet dependency and zero cloud surveillance**.

---

## ✨ Features

### 🏝️ Dynamic Island Desktop HUD
- **Top-Center Floating Island**: Frameless, transparent, and spring-physics animated desktop HUD styled with Linear dark glassmorphic aesthetics.
- **Click-Through & Screen Adaptive**: Dynamic OS-level window resizing (`setBounds`) tracks exact island dimensions in real time, eliminating transparent click deadzones over browser tabs and IDE titlebars. Automatically enables mouse event forward pass-through (`soko:set-ignore-mouse-events`) in compact mode while retaining instantaneous hover responsiveness.
- **Micro-Stutter Free & Hardware Accelerated**: Framer Motion `popLayout` transitions with GPU-promoted layout (`willChange`, `backfaceVisibility: hidden`), 60ms `ResizeObserver` debouncing, and React 18 `startTransition` rendering to eliminate jitter under heavy telemetry loads.
- **Throttled Window Dragging**: Window dragging utilizes `requestAnimationFrame` delta accumulation in `useWindowDrag.ts`, consolidating IPC calls to screen refresh rates (60–240Hz) and eliminating CPU spikes on 1000Hz gaming mice.
- **Feature-Sliced Design (FSD) & Atomic UI Primitives**: Decomposed into modular UI building blocks (`Button`, `Badge`, `Card`, `ProgressBar`, `Kbd`, `AudioWaveform`, `AudioControls`, `IslandGrip`, `IslandBacklight`).
- **WCAG 2.2 AA Accessibility Compliant**: High-contrast text palette (6.4:1 contrast ratio), global keyboard shortcuts (`Ctrl+Shift+S` for Settings, `Ctrl+Shift+H` for HUD focus), visible focus rings (`focus-visible:ring-2`), descriptive ARIA labels, and screen reader `aria-live="polite"` status announcements.
- **Component-Level Fault Isolation**: Glassmorphic `IslandErrorBoundary` wraps character avatars, notifications, CLI status widgets, and transfer progress—providing localized Retry actions without crashing the HUD capsule.
- **Multi-State Fluid Layout**: Expands smoothly when notifications arrive, file transfers initiate, music streams, or CLI commands output logs. Dismisses on `Escape` or outside click.
- **Graceful Lifecycle & In-App Quit**: Clean application shutdown (`soko:quit` / `forceQuitApp`) terminates background bridge daemons, disposes the system tray, releases single-instance locks, and intercepts `SIGINT`/`SIGTERM` with in-app quit triggers in Settings and Connection Popover.

### 🤖 Living Soko Mascot & Modular Character Engine
- **Procedural SVG Micro-Avatars**: Built-in high-framerate cyber-mascots (**Grok Bot** and **Cyber Cat**) rendered with pure SVG morphing.
- **Biomimetic Eye Engine**: Dynamic eye-tracking, biological ballistic saccades, blink reflexes, and expressively choreographed emotions (`idle`, `happy`, `thinking`, `busy`, `error`, `surprised`).
- **360° Physics Interactions**: Watch Soko roll, inspect active transfers, read incoming notifications left-to-right, and react to system state changes.
- **Modular Character Engine & Hot-Swapping**: Switch between built-in mascots or import custom character JSON/SVG packs generated via AI with localStorage persistence and cross-window IPC synchronization (`soko:sync-character`).
- **Strict Validation Guardrails**: Automatically verifies essential states (`idle`, `thinking`, `music`) to guarantee UI animations never break.
- **13 Atmospheric State Backgrounds**: Characters dynamically customize the Dynamic Island's background gradient and color palette for every state:
  - `idle`: Minimalist dark glassmorphic canvas
  - `music`: Synthwave cyan-violet gradient with active audio wave
  - `thinking`: Cognitive deep blue aura
  - `sleeping`: OLED black energy-saving mode
  - `dragging`: Kinetic amber acceleration glow
  - `git_push`: Radiant violet gradient when pushing code
  - `git_commit`: Vibrant emerald/teal gradient when committing changes
  - `offline`: Crimson alert pulse when disconnected
  - `charging`: Electric amber aura when battery power connects
  - `working`: Energetic blue pulse during active file/task execution
  - `multi_session`: Neural indigo gradient when multiple CLI agents run concurrently
  - `hover`: Elevated interactive glass surface
- **Dynamic Eye Color & Halo Bloom**: Color synchronization (`#EF4444` alerts, `#A855F7` git push, `#2DD4BF` git commit, `#FBBF24` charging, `#6366F1` multi-session) with an ambient backlight glow halo (`IslandBacklight`).
- **Complete Architecture & AI Generator**: See [docs/characters/README.md](docs/characters/README.md) for full technical schemas, SVG specs, and ready-to-use AI prompts.

### ⚡ 60 MB/s Hotspot & LAN Transfers
- **Direct Peer-to-Peer Streaming**: Pull and push files directly between devices at 30–60+ MB/s over local Wi-Fi or Mobile Hotspot.
- **Zero Cellular Data**: Transfers bypass external networks completely—beam heavy build artifacts, videos, and APKs in under 2 seconds.
- **Native Android DownloadManager**: Received files are automatically verified via SHA-256 and integrated into Android's native Downloads manager and Desktop file manager.
- **Sandboxed Storage & Path Sanitization**: All transferred files are strictly stripped of directory traversal paths (`../`) to their basename, stored in `transfers/`, assigned non-executable `0644` permissions, and automatically cleaned up if checksums fail.

### 🔔 Real-Time Notification Mirroring
- **Native Android NotificationListener**: Low-latency event streaming delivers notifications right to your desktop Island HUD.
- **Authentic Brand Squircle Badges**: Pixel-perfect app icons for WhatsApp, Telegram, Slack, Discord, GitHub, Gmail, SMS, and custom applications.
- **Expandable Card Reader & 1-Click Copy**: Expand notifications on hover or click to inspect multi-line content, and click any message to instantly copy text to your desktop clipboard.

### 💻 Remote Developer CLI Agent Deck & Telemetry
- **Mobile Control Terminal**: Trigger, inspect, and monitor local command-line tasks (such as `antigravity-cli` / `agy`, Git status, or custom shell operations) straight from your phone.
- **Live Streaming stdout**: Real-time ANSI terminal logs stream over WebSockets to your mobile companion deck.
- **Whitelisted Sandbox**: Only commands explicitly registered in the desktop configuration can be executed, preventing arbitrary remote code execution (RCE).
- **Active Workspace & Project Folder Discovery**: Automatically detects active project directories (e.g. `soko`, `frontend`, `backend`) for AI developer agents (Antigravity, Claude Code, Codex) by introspecting session registries, SQLite conversation summaries (`~/.gemini/antigravity*`, `~/.codex/sessions`), and tool-call paths.
- **Multi-Session Live Telemetry & Completion Badges**: Displays agent chips with project badges, live token usage counters (`14.5k tokens`), and wakes Soko from idle orb mode to normal mode when background tasks complete.

### 🎵 Low-Latency Desktop Audio Streaming (Dual Codec & Dynamic Hot-Swap)
- **Zero-Bloat Desktop-to-Phone Audio**: Stream desktop sound (YouTube, Spotify, IDE build alerts, movies) directly to your mobile device or Bluetooth earbuds without adding a single megabyte to your APK.
- **Dual-Codec Architecture**:
  - **Opus Ultra-Low Latency** (`/api/audio/stream?codec=opus`): Encodes 48 kHz stereo at 96 kbps into WebM with 20ms frames, slashing network latency to **<40ms**—ideal for gaming and video synchronization.
  - **MP3 High-Fidelity** (`/api/audio/stream?codec=mp3`): High-bitrate 192 kbps / 48 kHz stereo stream for universal media player compatibility.
- **Dynamic Device Switching (Hot-Swap)**: Monitored via PipeWire (`pw-mon`) and PulseAudio (`pactl subscribe`) event streams. Automatically hot-swaps capture sinks when USB DACs, Bluetooth headphones, or HDMI displays are connected/disconnected without interrupting client streams.
- **Auto-Mute PC Speaker**: Automatically mutes desktop speakers upon mobile connection and restores volume when mobile listeners disconnect (`POST /api/audio/mute-speaker`).
- **Bundled FFmpeg Fallback Chain**: Prioritizes `SOKO_FFMPEG_PATH` -> System `ffmpeg` -> Packaged Electron binaries -> Bundled `ffmpeg-static` npm package, ensuring zero configuration on fresh OS installs.
- **Interactive Island Transport Controls**: Integrated play/pause, prev/next buttons, volume controls, and a real-time reactive audio waveform visualizer (`AudioWaveform`).

### 📻 YouTube Music Offline Desktop Connector
- **Decoupled Sidecar Architecture**: Runs as a lightweight sidecar connector (`/coding/soko-music-connector`) with zero core daemon bloat.
- **Sub-Millisecond Cache Lookups**: Intercepts YouTube & YT Music playback via D-Bus MPRIS (`org.mpris.MediaPlayer2`), extracts 11-character video IDs, and validates local cache via SQLite database (`music.db`).
- **HTTP 206 Byte-Range Streaming**: High-bitrate audio (~160 kbps Opus / 128 kbps AAC) served via seekable `Accept-Ranges: bytes` partial content streaming (`GET /api/music/stream/:filename`).
- **Mobile Lockscreen MediaSession**: Mobile companion renders full album cover art, track metadata, interactive audio scrubbers, and hardware lockscreen controls.

### 📱 Mobile Companion & Android 14+ Compliance
- **Dual Companion Architecture**:
  - **Standalone Flutter App** (`apps/mobile/lib`): High-performance native Android application with glassmorphic cards, reactive mascot, and hardware BLE/Hotspot controllers.
  - **Zero-Install Web Companion (PWA)** (`apps/mobile/companion/index.html`): Served directly by the local bridge daemon (`http://<ip>:8766`). Includes camera QR scanner, audio player, CLI terminal, and file transfer deck.
- **Android 14+ Foreground Service Compliance**: Manifest and service registered with combined `FOREGROUND_SERVICE_CONNECTED_DEVICE` and `FOREGROUND_SERVICE_MEDIA_PLAYBACK` flags.
- **Power & Wi-Fi Lock Synchronization**: Integrates `PowerManager.WakeLock` (`PARTIAL_WAKE_LOCK`) and `WifiManager.WifiLock` (`WIFI_MODE_FULL_LOW_LATENCY` / `HIGH_PERF`) with safety timeout caps and automatic release on stream completion or idle.

### 🌐 Universal Hybrid QR Pairing & Multi-Interface Engine (Option 3)
- **Universal Smartphone Camera Compatibility**: Dynamic Island Connection Popover renders high-contrast SVG QR codes embedding Universal Web URLs (`http://<ip>:8766/?pair=1&pin=<pin>&exp=<exp>&alts=<alts>`). Any default smartphone camera (iOS Camera, Google Lens, Samsung Camera) opens the mobile web companion and completes 1-tap auto-pairing.
- **Dedicated 3-Tab Card**: Switch seamlessly between **Phone Cam** (Universal Web URL), **Soko App** (Native `soko://pair` deep link), and **Hotspot** (standard `WIFI:S:...` schema) directly in the Dynamic Island popover.
- **Multi-Interface Hardware Classification**: Intelligently classifies network interfaces, automatically filtering out virtual machine hypervisors and container bridges (`docker0`, `virbr0`, `veth*`, `tailscale*`, `cni*`). Prioritizes physical Wi-Fi and Hotspot over Ethernet.
- **Candidate Fallback Routing (`alts`)**: Multi-homed developer workstations encode alternative candidate IP addresses. If primary routing fails, the mobile companion probes candidates automatically.
- **Time-Sensitive 5-Minute Countdown Expiration**: Pairing tokens expire after 300 seconds (`exp`) with live countdown timer and automatic refresh to thwart screenshot replay attacks.
- **Timing-Safe Zero-Trust Pinning**: SAS PIN matching and TLS SHA-256 certificate fingerprints (`fp`) are verified with constant-time cryptographic checks (`crypto.timingSafeEqual`) to eliminate timing side-channel attacks.

### 🤖 Real-Time Mobile Agent Terminal & Transcript Streaming
- **Live Agent Terminal Deck**: Direct mobile mirror for AI developer CLI agents (Google Antigravity `agy`, Claude Code, Codex).
- **Sub-Second Delta Streaming**: 400ms delta tailing engine tracks transcript byte offsets (`readDelta`), streaming conversational turns, thought processes, and tool executions over WebSockets with zero polling latency.
- **Mobile-First Conversational Ergonomics**:
  - Automatically strips internal XML scaffolding (`<USER_REQUEST>`, `<ADDITIONAL_METADATA>`, `<identity>`) to present clean user prompts.
  - **Collapsible Thought Accordions**: Agent reasoning blocks fold cleanly into interactive disclosure pills (`[Show ▾] / [Hide ▴]`).
  - **Unified Activity Pills**: Replaces bulky tool JSONs with concise execution summaries (e.g. `$ npm test`, `Edit main.ts`).
  - **Tool Output Capping**: Caps oversized command outputs to 40 lines / 4KB to protect mobile device memory.
- **Remote Prompt Turn Dispatching**: Type instructions and send prompts directly from your mobile device. Includes optimistic turn insertion, child process detachment (`child.unref()`), session queueing, and strict CLI `mode`/`effort` allowlists to prevent command injection.

### 🔐 Android APK Release Signing Parity & Hardware Permissions
- **Keystore CI/CD Parity**: Local builds (`scripts/build_apks.sh`) and GitHub Actions CI share canonical release keystore credentials via `.env.signing` and `ANDROID_KEYSTORE_BASE64`.
- **Signature Parity Verifier**: Run `bash scripts/verify_apk_signature.sh [apk]` to confirm signature matches canonical release key before distributing updates.
- **Hardware Camera Integration**: Companion WebView incorporates camera permissions with origin-restricted runtime approval, enabling live QR scanning.

### 🛡️ Zero-Trust Security & Network Hardening
- **Local Transport Layer Security (TLS / HTTPS & WSS)**: Self-signed certificate generation with automated SAN coverage and socket multiplexing on port 8766. Certificate fingerprints (`SHA256:XX:...`) are exported for client-side pinning.
- **PIN Brute-Force Defense & Progressive Rate Limiting**: Exponential progressive delays on failed pairing attempts (Stage 1: 15s delay, Stage 2: 60s cooldown, Stage 3: 10-minute IP block & auto-regeneration of PIN) emitting `SECURITY_ALERT` broadcast packets.
- **OS-Standard Secure Trust Store**: Persistent device authorization stored in OS configuration standards (`$XDG_CONFIG_HOME/soko/trust_store.json`, `%APPDATA%\soko`, `~/Library/Application Support/soko`) with atomic temporary writes and strict POSIX `0600` permissions.
- **Strict CORS & Host Header Hardening**: Blocks DNS rebinding attacks by validating `Host` and untrusted foreign web `Origin` headers (rejecting foreign internet origins with HTTP 403 Forbidden).
- **30-Day Bearer Token Rotation**: Authenticated companion devices receive 128-bit persistent cryptographic bearer tokens paired with refresh tokens (`POST /api/auth/refresh`), with desktop-level "Revoke All Sessions" capability (`POST /api/auth/revoke-all`).
- **Replay Attack Defense & File Sandbox**: Monotonic sequence counters reject duplicated or delayed network packets; strict basename sanitization prevents directory-traversal attacks (`../`) and enforces `0644` non-executable permissions.
- **Production Rolling Logger (`@soko/logger`)**: Enforces strict 10MB bounds, retains 3 historical rotation files (`soko_bridge.log.1`, `.2`, `.3`), and adheres to XDG state directories (`~/.local/state/soko/logs`).

### 🖥️ Display Server, Multi-Monitor & Platform Hardening
- **Dynamic Multi-Monitor Re-centering & DPI Scaling**: Electron `screen` event listeners (`display-metrics-changed`, `display-added`, `display-removed`) dynamically re-center the HUD capsule across resolution changes and fractional DPI scaling (100% to 150%+).
- **Zero-Loss Disconnect Clamping**: When secondary or external monitors are disconnected, Soko automatically detects the nearest active display and clamps the island safely within viewport bounds, preventing off-screen window loss.
- **Pure Wayland & X11 Intelligent Detection**: Automatically detects pure Wayland sessions (without XWayland) or `--wayland` / `SOKO_WAYLAND=1` flags, launching with `--ozone-platform=wayland`; defaults to X11 when available for optimal frameless transparent overlay support.
- **Hyprland & Sway Compositor Presets**: Dedicated window rules and presets in `apps/desktop/resources/compositor/` keep the island floating, borderless, and pinned across all workspaces.
- **Native Windows 11 Mica & Taskbar Alignment**: Uses native Windows 11 `backgroundMaterial: 'mica'` with fallback to solid dark `#090A0F` on Windows 10/Linux; automatically detects top-aligned taskbars and docks 4px below.
- **In-App Auto-Updater**: Native background delta updates powered by `electron-updater` with real-time download progress and 1-click "Restart & Install" controls alongside the GitHub Gist version feed.

### ⚙️ Background Daemon Management & Multi-Agent Orchestration
- **Unified Daemon CLI**: Manage background bridge services easily via `scripts/manage_service.sh` (`install`, `uninstall`, `start`, `stop`, `restart`, `status`, `logs`).
- **Platform Native Daemon Templates**: Linux systemd user service (`scripts/systemd/soko.service`), Windows scheduled task / startup scripts (`scripts/windows/`), and macOS launchd plist (`scripts/launchd/com.soko.bridge.plist`).
- **Multi-Agent KVM Fleet Orchestration**: Distributed development protocol ([`AGENTS.md`](AGENTS.md)) and hardened dispatcher ([`scripts/agent_dispatch.sh`](scripts/agent_dispatch.sh)) distributing monorepo tasks concurrently across dual KVM nodes (`antigravity-vm1` for backend/systems, `antigravity-vm2` for frontend/mobile/QA) with transport-layer domain scoping, canonical schema protection, per-target concurrency locks, and automated dependency auditing. See [docs/features/13-multi-agent-vm-orchestration.md](docs/features/13-multi-agent-vm-orchestration.md).

---

## 📥 Downloads

Ready-to-use binaries are published with every release on [GitHub Releases](https://github.com/Saurabh-singhx/soko/releases).

| Platform | Package Format | Direct Download / Install Command | Notes |
| :--- | :--- | :--- | :--- |
| **Linux (x64)** | `.AppImage` | [`soko-linux-x86_64.AppImage`](https://github.com/Saurabh-singhx/soko/releases/latest) | Portable, runs on any modern distro (Ubuntu, Fedora, Arch) |
| **Linux (x64)** | `.deb` | [`soko-linux-amd64.deb`](https://github.com/Saurabh-singhx/soko/releases/latest) | Debian, Ubuntu, Linux Mint native package |
| **Linux (x64)** | `.rpm` | [`soko-linux-x86_64.rpm`](https://github.com/Saurabh-singhx/soko/releases/latest) | Fedora, RHEL, openSUSE native package |
| **Linux (x64)** | `.tar.gz` | [`soko-linux-x64.tar.gz`](https://github.com/Saurabh-singhx/soko/releases/latest) | Standalone unpacked binary archive |
| **Windows (x64)** | Setup `.exe` (NSIS) | [`soko-win-setup.exe`](https://github.com/Saurabh-singhx/soko/releases/latest) | Standard Windows installer with start menu & desktop shortcuts |
| **Windows (x64)** | Portable `.exe` | [`soko-win-x64.exe`](https://github.com/Saurabh-singhx/soko/releases/latest) | Standalone portable executable (No installer required) |
| **Windows (x64)** | `.zip` | [`soko-win-x64.zip`](https://github.com/Saurabh-singhx/soko/releases/latest) | Unpack and launch `soko.exe` |
| **macOS (Universal)** | `.dmg` / `.zip` | [`soko-mac.dmg`](https://github.com/Saurabh-singhx/soko/releases/latest) | Apple Silicon & Intel with Hardened Runtime & Entitlements |
| **Android (API 26+)** | `soko-mobile.apk` | [`soko-mobile.apk`](https://github.com/Saurabh-singhx/soko/releases/latest) | Full companion with Android Notification Listener & FGS audio |
| **Android (API 26+)** | `soko-mobile-lite.apk` | [`soko-mobile-lite.apk`](https://github.com/Saurabh-singhx/soko/releases/latest) | Lite standalone companion (Clean transfer & CLI, 0 permission warnings) |
| **Android (API 26+)** | `soko-desktop.apk` | [`soko-desktop.apk`](https://github.com/Saurabh-singhx/soko/releases/latest) | Soko Dynamic Island HUD running as native Android tablet HUD |

> [!TIP]
> On Linux, you can launch the local desktop build directly via `./run-desktop.sh`. On Windows, use `run-desktop.bat` or `run-desktop.ps1`.

---

## 🏗️ System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Desktop Workstation                           │
│                                                                        │
│  ┌───────────────────────────────┐  ┌────────────────────────────────┐ │
│  │      Dynamic Island HUD       │  │     Settings & Hub Window      │ │
│  │   (Electron + React 18 FSD)   │  │   (8 Modular Decomposed Tabs)  │ │
│  │   • IslandGrip & Backlight    │  │   • Pairing, Tokens, Security  │ │
│  │   • Waveform & Audio Player   │  │   • Mascots, CLI, Updates      │ │
│  │   • IslandErrorBoundary       │  │   • Atomic Design Primitives   │ │
│  └───────────────┬───────────────┘  └───────────────┬────────────────┘ │
│                  │                                  │                  │
│                  ▼                                  ▼                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │          Soko Local Bridge Daemon (Node.js / Port 8766)          │  │
│  │  • TLS Engine & Socket Multiplexer (Dual HTTPS/WSS & HTTP/WS)    │  │
│  │  • Dual-Codec Audio Streamer (Opus <40ms & MP3 192k)             │  │
│  │  • PipeWire / PulseAudio Dynamic Sink Switcher                   │  │
│  │  • Whitelisted CLI PTY Process Spawner & Token Aggregator        │  │
│  │  • High-Speed HTTP Chunked Transfer Receiver & SHA-256 Sandbox   │  │
│  │  • Zero-Trust OS Trust Store (0600) & Progressive Rate Limiter   │  │
│  │  • Rolling File Logger (10MB Bounds, 3 Rotation Archives)        │  │
│  │  • Zero-Dependency RFC 6762 / 6763 mDNS & QR SVG Generator       │  │
│  └───────────────────────────────┬──────────────────────────────────┘  │
│                                  │                                     │
│  ┌───────────────────────────────┴──────────────────────────────────┐  │
│  │  YouTube Music Offline Sidecar Connector (/coding/soko-music)    │  │
│  │  • D-Bus MPRIS Listener • Fast ID Cache • HTTP 206 Byte-Range    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────┼─────────────────────────────────────┘
                                   │
                     Local Wi-Fi LAN / Mobile Hotspot
                Dual-Protocol: WebSocket (Control) + HTTP (Data)
                                   │
┌──────────────────────────────────┼─────────────────────────────────────┐
│                                  ▼                                     │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │               Soko Android Companion Ecosystem                   │  │
│  │                                                                  │  │
│  │  • Flutter Companion (`apps/mobile/lib`)                         │  │
│  │  • Zero-Install Web Companion (`apps/mobile/companion`)          │  │
│  │  • Native Android NotificationListenerService & Squircle Badges  │  │
│  │  • High-Speed Hotspot Downloader (30-60 MB/s) & SHA-256 Check    │  │
│  │  • Remote CLI Command Deck & Real-time ANSI Console              │  │
│  │  • Dual-Codec Low-Latency Mobile Audio Player                    │  │
│  │  • YouTube Music Now-Playing Card & Lockscreen MediaSession      │  │
│  │  • Android 14+ FGS Compliance & PowerManager WakeLock Sync       │  │
│  │  • HTML5 Camera QR Code Scanner & Instant Auto-Handshake         │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                          Android Smartphone                            │
└────────────────────────────────────────────────────────────────────────┘
```

Detailed architectural diagrams, protocols, and threat models can be reviewed in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [extra_audits/DESKTOP_UI_UX_AUDIT.md](extra_audits/DESKTOP_UI_UX_AUDIT.md).

---

## 🚀 Quick Start

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Linux (optional)**: `libgtk-3-dev`, `libnotify-dev`, `alsa-utils` / `pipewire`
- **Android**: Android 7.0 (Nougat, API 24) or newer

### 1. Clone the Repository
```bash
git clone https://github.com/Saurabh-singhx/soko.git
cd soko
```

### 2. Install Dependencies
```bash
npm install
npm --prefix apps/desktop install
```

### 3. Run the Desktop App (Development)
```bash
# Launch the local connection bridge daemon
npm run bridge

# In a separate terminal, launch the desktop HUD
npm run dev:desktop
```

Or launch the complete packaged desktop build directly with hardware acceleration:
```bash
# On Linux:
./run-desktop.sh

# On Windows (PowerShell / Command Prompt):
.\run-desktop.ps1
# or
run-desktop.bat
```

### 4. Background Service Installation (Optional)
To run Soko Bridge automatically in the background as an OS service:
```bash
# Install as Linux systemd user service, macOS launchd agent, or Windows scheduled task:
./scripts/manage_service.sh install

# Inspect status:
./scripts/manage_service.sh status
```

### 5. Connect Your Android Device
1. Install **`soko-mobile.apk`** on your Android device (or simply open `http://<YOUR_DESKTOP_IP>:8766` in your mobile browser for the zero-install Web Companion).
2. **Instant QR Pairing**: Click **"Pair via QR"** in the desktop Dynamic Island Connection Popover and scan the QR code with your mobile camera or companion app scanner for instant 1-tap connection.
3. **Manual SAS PIN**: Alternatively, enter the 6-digit confirmation PIN displayed on your desktop Dynamic Island.
4. Once paired, notifications, high-speed file transfers, desktop audio streaming, and remote CLI tools are instantly live!

---

## 🛠️ Building From Source

### Building Desktop Packages (Linux, Windows, macOS)
Soko uses Electron Builder to package production-grade distribution binaries:

```bash
# Compile desktop frontend
npm run build:desktop

# Package Linux targets (.AppImage, .deb, .rpm, .tar.gz)
npm run build:linux

# Package Windows targets (NSIS Setup .exe, Portable .exe, .zip)
npm run build:windows

# Package macOS targets (.dmg, .zip)
npm run build:macos

# Package all desktop targets simultaneously
npm run build:desktop:all
```
Generated artifacts will be placed in the `dist-desktop/` directory.

### Building Android APKs
Soko features an automated standalone Android build pipeline utilizing `aapt2`, `d8`, `zipalign`, and `apksigner` with persistent release keystore signing:

```bash
npm run build:apk
```
This generates:
- `apks/soko-mobile.apk`: Full companion with Android Notification Listener & FGS audio
- `apks/soko-mobile-lite.apk`: Lightweight companion with zero permission requirements
- `apks/soko-desktop.apk`: Dynamic Island HUD compiled for Android tablet displays

To build everything (Desktop + Android APKs) in one command:
```bash
npm run build:all
```

---

## 🔄 Continuous Builds & Gist Auto-Updates

Soko uses continuous monotonic build versioning and an atomic GitHub Gist feed for zero-rate-limit auto-updates.

### 1. Monotonic Build Versioning
- **Automatic Version Increments**: Every build pushed to `master`/`main` or triggered via GitHub Actions automatically bumps the build version (`1.0.<run_number>`), keeping desktop and mobile packages synchronized.
- **Manual Tags**: Pushing a tag (`git tag v1.0.3 && git push origin v1.0.3`) automatically releases that explicit version.

### 2. Setting Up the Gist Secret for Auto-Updates
To allow GitHub Actions to automatically update the client version feed on every build:

1. **Create a GitHub Token**: Go to [GitHub Settings > Developer Settings > Personal Access Tokens (Classic)](https://github.com/settings/tokens) and generate a token with the **`gist`** scope.
2. **Add Secret to Repository**:
   - Go to your repo: **Settings > Secrets and variables > Actions > New repository secret**.
   - Name: `GIST_SECRET`
   - Value: paste your GitHub Token.
3. *(Optional)* **Set GIST_ID**: If you already created a Gist for Soko, add `GIST_ID` as a repository secret or variable. If omitted, the workflow will automatically create one on the first run and output its ID in the build logs!

Desktop clients can configure their raw Gist feed URL directly in **Settings > Updates** to enjoy instantaneous update alerts and 1-click downloads.

---

## 🧪 Testing

Soko features a comprehensive, multi-layered automated test suite covering zero-trust security, dynamic window layouts, character validation, workspace resolution, and full-duplex integration. 

The test harness runs against an isolated port (`PORT 8799` by default) and auto-spawns an isolated bridge daemon to guarantee zero interference with active development environments or running desktop apps on port `8766`.

### Running All Test Suites (100% Pass Rate)
```bash
npm run test:all
```

### Individual Test Suites

| Suite | Scope | Command |
| :--- | :--- | :--- |
| **1. Modular Character System** | Validates essential states (`idle`, `thinking`, `music`), activation guardrails, dynamic SVG mounting, and 13 atmospheric state backgrounds. | `npm run test:characters` |
| **2. Zero-Trust Security & TLS** | Zero-trust authentication, SAS PIN pairing exchange, bearer token authorization, TLS socket multiplexing, rate limiting, and 30-day token rotation. | `npm run test:security` |
| **3. Zero-Config Discovery & QR** | Zero-configuration mDNS / DNS-SD wire encoding, HTTP `/api/discovery` endpoint, ISO/IEC 18004 QR SVG generation, and automated pairing handshake loop. | `npm run test:discovery` |
| **4. Device Scanning Guardrails** | Hardware BLE & LAN scanning: one-time auto scan, manual re-scan triggers, connection state preservation, and concurrency debouncing. | `npm run test:scanning` |
| **5. Workspace Resolution** | Active workspace & working folder resolution: SQLite trajectory inspection (`~/.gemini/antigravity*`, `~/.codex/sessions`), tool path extraction, and Dynamic Island badge fallbacks. | `npm run test:workspace` |
| **6. Display Server & Auto-Updater** | Desktop display server & multi-monitor robustness: workArea centering, fractional DPI scaling (1.25x, 1.5x), negative X offsets, disconnect clamping, Linux X11/Wayland platform resolution, and in-app auto-updater asset parsing. | `npm run test:display` |
| **7. Audio Pipeline & Resilience** | Audio pipeline, daemon services & observability: FFmpeg resolution hierarchy, Opus 96k / MP3 192k codec configuration, dynamic device switching hot-swap, rolling file logger (10MB bounds, 3 historical files), React `IslandErrorBoundary` crash recovery, and service configs (systemd, launchd, Windows). | `npm run test:audio` |
| **8. Dynamic Island & Token Badges** | Dynamic Island idle orb mode transitions, agent completion status badges, token formatting (`14.5k tokens`), layout clipping defense, and notification sizing. | `npm run test:island` |
| **9. Full Duplex Integration** | End-to-end integration: HTTP discovery, notification mirroring, high-speed file transfers, SHA-256 upload verification, WebSocket framing, PipeWire desktop audio stream, and multi-session CLI telemetry. | `npm test` |

---

## 🛡️ Security & Zero-Trust

Soko is engineered under a strict **Zero-Trust Local Network** security model:

1. **Whitelisted CLI Execution Only**: Soko rejects arbitrary command execution. Only pre-configured aliases registered in the desktop configuration (e.g., `sysinfo`, `git-status`, `antigravity`) can be executed. Attempts to execute unauthorized commands or shell injections (`rm -rf`, `;`, `&&`) are blocked with HTTP `403 Forbidden`.
2. **Path Sanitization & Sandbox Isolation**: All received files are stripped of directory paths (`../`) to their strict basename and stored inside a sandboxed `transfers/` directory with non-executable permissions (`0644`).
3. **Cryptographic Checksum Verification**: Transferred files compute and verify SHA-256 hashes on the fly. Corrupted or tampered files are purged immediately.
4. **Physical SAS Confirmation PIN & Rate Limiting**: Initial pairing requires manual entry of a 6-digit confirmation PIN displayed on the desktop HUD. Brute-force attacks trigger exponential delays, IP cooldowns, and automatic PIN re-generation.
5. **Persistent OS Trust Store**: Authorized devices are persisted in standard OS configuration directories (`0600` POSIX permissions) with 30-day token rotation and 1-click "Revoke All Sessions" controls.
6. **Strict Host & Origin Validation**: Prevents DNS rebinding and foreign web-based attacks by rejecting untrusted internet origins.

---

## 📖 Deep-Dive Documentation

Explore our comprehensive engineering logs and feature architecture documents:

| Topic | Document |
| :--- | :--- |
| **Global Architecture & Threat Model** | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| **Desktop UI/UX Audit & Clean Architecture** | [extra_audits/DESKTOP_UI_UX_AUDIT.md](extra_audits/DESKTOP_UI_UX_AUDIT.md) |
| **Production Readiness & Hardening Roadmap** | [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) |
| **Test Suites Specification & Guide** | [tests/README.md](tests/README.md) |
| **Dynamic Island HUD & X11/Wayland Physics** | [docs/features/01-dynamic-island-hud.md](docs/features/01-dynamic-island-hud.md) |
| **Bluetooth Low Energy vs Classic RFCOMM** | [docs/features/02-bluetooth-dual-protocol.md](docs/features/02-bluetooth-dual-protocol.md) |
| **Hotspot & LAN Zero-Cellular High-Speed Transfers** | [docs/features/03-hotspot-high-speed-transfer.md](docs/features/03-hotspot-high-speed-transfer.md) |
| **Remote CLI Agent Runner & PTY Security** | [docs/features/04-remote-cli-execution.md](docs/features/04-remote-cli-execution.md) |
| **Android NotificationListener Service & Filters** | [docs/features/05-notification-mirroring.md](docs/features/05-notification-mirroring.md) |
| **Zero-Trust Security Engine, TLS & Token Rotation** | [docs/features/06-security-and-pairing.md](docs/features/06-security-and-pairing.md) |
| **Grok Bot Living OLED Mascot Animation Engine** | [docs/features/07-grok-bot-monochrome-animation.md](docs/features/07-grok-bot-monochrome-animation.md) |
| **Low-Latency Desktop Audio Streaming (Dual Codec & Hot-Swap)** | [docs/features/08-desktop-audio-streaming.md](docs/features/08-desktop-audio-streaming.md) |
| **Mobile Dynamic Island & Fluid Cloud Technical Analysis** | [docs/features/09-mobile-dynamic-island-fluid-cloud.md](docs/features/09-mobile-dynamic-island-fluid-cloud.md) |
| **YouTube Music Offline Desktop Connector** | [docs/features/10-youtube-music-offline-connector.md](docs/features/10-youtube-music-offline-connector.md) |
| **Universal QR Pairing & Multi-Interface Fallback Engine** | [docs/features/11-universal-qr-pairing-engine.md](docs/features/11-universal-qr-pairing-engine.md) |
| **Real-Time Mobile Agent Terminal & Transcript Streaming** | [docs/features/12-agent-remote-terminal-streaming.md](docs/features/12-agent-remote-terminal-streaming.md) |
| **Multi-Agent KVM Fleet Orchestration & Hardened Dispatcher** | [docs/features/13-multi-agent-vm-orchestration.md](docs/features/13-multi-agent-vm-orchestration.md) |
| **Custom Character Creation Guide & AI Prompt (Mascots & Atmospheric Backgrounds)** | [docs/characters/README.md](docs/characters/README.md) |
| **Multi-Agent Orchestration Protocol & Execution Rules** | [AGENTS.md](AGENTS.md) |

---

## 🤝 Contributing

Contributions, bug reports, and suggestions are warmly welcomed!

1. Fork the repository
2. Create your feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more details.

---

<div align="center">
  <sub>Crafted with passion for a unified desktop and mobile developer workflow.</sub>
</div>
