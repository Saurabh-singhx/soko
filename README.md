# Soko (そ小)

<div align="center">

**Dynamic Island Desktop HUD & Mobile Companion for Windows, Linux, and Android**

*Seamless Bluetooth Pairing • Reactive Mascot Avatar • High-Speed Hotspot APK Transfers • Remote CLI Agent Control*

</div>

---

## 📖 Overview

**Soko** connects your desktop environment (Windows & Linux) with your Android phone into a unified workstation experience.

- **Dynamic Island HUD**: A top-center floating HUD on desktop featuring an animated emoji character mascot that reacts to phone notifications, running CLI agent tasks, and file transfers with Apple-inspired spring physics.
- **Dual-Channel Connectivity**:
  - **Bluetooth Low Energy (BLE)**: Zero-drain background signaling for notifications, heartbeats, and remote command execution.
  - **Mobile Hotspot / Wi-Fi LAN**: Zero-config high-speed file transfers (30–60 MB/s) enabling 50MB+ build APK transfers in under 2 seconds without burning mobile cellular data.
- **Remote Developer Agent Terminal**: Trigger and monitor command-line developer tools (like `antigravity-cli` / `agy`, Git status, or system controls) from your mobile phone with live streamed stdout.
- **Glassmorphic Mobile UI**: Sleek mobile companion designed with frosted glass cards, glow shaders, and local biometric security.

---

## 🏗️ System Architecture

Detailed global architecture and data flows are documented in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

```
┌─────────────────────────────────┐          Bluetooth LE (GATT)          ┌──────────────────────────────────┐
│          Desktop (Soko)         │ <───────────────────────────────────> │           Mobile (Soko)          │
│ • Dynamic Island (React/Motion) │   [Pings, Notifications, CLI Triggers]│ • Glassmorphism UI (Flutter)     │
│ • Settings Multi-Window (Tauri) │                                       │ • NotificationListenerService    │
│ • Rust Backend Daemon (Tokio)   │ ═════════════════════════════════════ │ • Embedded Hotspot HTTP Server   │
└─────────────────────────────────┘      High-Speed Wi-Fi LAN (50 MB/s)    └──────────────────────────────────┘
                                          [APKs, Media, Direct Pull Stream]
```

---

## 📂 Project Structure

```
soko/
├── docs/                                 # Research, benchmarks & engineering logs
│   ├── ARCHITECTURE.md                   # Global system design & threat model
│   └── features/
│       ├── 01-dynamic-island-hud.md      # Top-center HUD, transparent click-through & mascot
│       ├── 02-bluetooth-dual-protocol.md # BLE GATT vs Classic RFCOMM trade-offs
│       ├── 03-hotspot-high-speed-transfer.md # Zero-config BLE handoff to Hotspot HTTP
│       ├── 04-remote-cli-execution.md    # Safe PTY execution for Antigravity CLI
│       ├── 05-notification-mirroring.md  # Android NotificationListenerService & filters
│       └── 06-security-and-pairing.md    # ECDH, 6-digit confirmation PINs & replay guards
│
├── apps/
│   ├── desktop/                          # Desktop application (Windows & Linux)
│   │   ├── src-tauri/                    # Rust backend daemon
│   │   │   ├── src/bluetooth/            # BLE service & packet deserializer
│   │   │   ├── src/cli/                  # Whitelisted PTY process spawner
│   │   │   ├── src/transfer/             # High-speed file pull client & sandbox
│   │   │   ├── src/windows/              # Multi-window controller (Island + Settings)
│   │   │   └── src/security/             # AES-256-GCM crypto & trust store
│   │   └── src/                          # Frontend UI (React + Tailwind + Framer Motion)
│   │       ├── components/island/        # Dynamic Island, Reactive Mascot, Widgets
│   │       └── components/settings/      # Full settings management window
│   │
│   └── mobile/                           # Mobile application (Flutter)
│       └── lib/
│           ├── core/                     # Glassmorphic tokens, crypto, packet models
│           ├── services/                 # BLE service, Hotspot HTTP file server, CLI runner
│           └── ui/                       # Glassmorphic dashboard, terminal deck, file share
│
└── packages/
    └── protocol/                         # Shared JSON Schemas & packet specifications
        └── schema/
            ├── packet.json
            ├── notification.json
            ├── cli_command.json
            └── file_transfer.json
```

---

## 📚 Feature Research & Engineering Logs

Each core feature contains a dedicated `.md` file detailing research, failed attempts, and the production solution:

1. [Dynamic Island HUD & Reactive Mascot](docs/features/01-dynamic-island-hud.md) - Research on Wayland vs X11 window placement, transparent click-through hit-testing, and mascot emotion state machines.
2. [Bluetooth Dual-Protocol Strategy](docs/features/02-bluetooth-dual-protocol.md) - Analysis of why BLE-only fails for bulk files and how dual-mode standby preserves battery.
3. [Hotspot / LAN High-Speed File Transfer](docs/features/03-hotspot-high-speed-transfer.md) - Why mobile hotspot connections allow zero-data 50 MB/s transfers and bypass Windows Defender public network blocking.
4. [Remote CLI Agent Runner](docs/features/04-remote-cli-execution.md) - Safe PTY process spawning without raw shell injection risks for Antigravity CLI (`agy`).
5. [Notification Mirroring](docs/features/05-notification-mirroring.md) - Event-driven Android `NotificationListenerService` and deduplication algorithms.
6. [Security, Pairing & Threat Model](docs/features/06-security-and-pairing.md) - ECDH key exchange, 6-digit confirmation codes, and monotonic replay attack prevention.

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18+) & npm
- Rust & Cargo (for compiling the Tauri desktop backend)
- Flutter SDK (for building the mobile companion app)

### 2. Desktop Frontend Preview
You can test the Dynamic Island UI, reactive mascot animations, and full Settings window right in your browser:
```bash
cd apps/desktop
npm install
npm run dev
```
- Open `http://localhost:5173` to test the Dynamic Island and click the test buttons (`+ Test Notif`, `+ Run agy`, `+ Send APK`).
- Open `http://localhost:5173/#settings` to inspect the full desktop management view.

### 3. Desktop Application Run (Tauri)
```bash
cd apps/desktop
cargo tauri dev
```

### 4. Mobile Application Run (Flutter)
```bash
cd apps/mobile
flutter pub get
flutter run
```

---

## 🛡️ Security Guarantees
- **No Unrestricted RCE**: Mobile triggers invoke only pre-configured aliases registered in the desktop whitelist.
- **Anti-Directory Traversal**: All received files are sanitized and confined to `~/Downloads/SokoFiles/`.
- **Replay Protection**: Packets with duplicate or backwards sequence IDs are rejected immediately.
- **MITM Defense**: 6-digit cryptographic confirmation PIN ensures physical human verification during initial setup.
