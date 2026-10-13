# Soko Android Packages (APKs)

This folder contains pre-built, signed, and zipalign-verified Android packages for the Soko monorepo.

| APK File | Package Name | Application Label | Description |
| :--- | :--- | :--- | :--- |
| **[`soko-desktop.apk`](./soko-desktop.apk)** | `com.soko.desktop` | Soko HUD | Linear-styled Dynamic Island HUD featuring the Grok Bot OLED mascot, notification interactive tester, settings, and CLI remote bridge. |
| **[`soko-mobile.apk`](./soko-mobile.apk)** | `com.soko.mobile` | Soko Mobile | Mobile companion controller, BLE scanner, Hotspot APK receiver, and remote command runner. |
| **[`soko-release.apk`](./soko-release.apk)** | `com.soko.desktop` | Soko HUD (Release) | Production signed release build of the Soko HUD. |
| **[`soko-debug.apk`](./soko-debug.apk)** | `com.soko.mobile` | Soko Mobile (Debug) | Debug signed companion controller build. |

---

### Installation via ADB

Connect your Android phone via USB (with USB Debugging enabled) and run:

```bash
# Install Soko Desktop HUD
adb install apks/soko-desktop.apk

# Install Soko Mobile Companion
adb install apks/soko-mobile.apk
```

---

### Regenerating APKs

To rebuild these APKs at any time from the root directory:

```bash
npm run build:apk
```
