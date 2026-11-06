# Soko Android Packages (APKs)

Android packages for Soko can be downloaded directly from [GitHub Releases](https://github.com/Saurabh-singhx/soko/releases) or generated locally using the automated build script.

| Package | Package Name | Application Label | Description |
| :--- | :--- | :--- | :--- |
| **`soko-mobile.apk`** | `com.soko.mobile` | Soko Mobile | Full mobile companion controller: Real-time notification mirroring service, high-speed hotspot transfer receiver, low-latency desktop audio streaming player, native OnePlus Fluid Cloud & Dynamic Island punch-hole integration, and remote CLI terminal deck. |
| **`soko-mobile-lite.apk`** | `com.soko.companion` | Soko Mobile Lite | Lightweight companion without notification listener service (zero Play Protect warnings, standalone high-speed transfer, wireless desktop audio player, & CLI control). |
| **`soko-desktop.apk`** | `com.soko.desktop` | Soko HUD (Android) | Dynamic Island HUD compiled for Android displays with interactive Grok Bot OLED mascot, desktop audio streaming telemetry, and testbed. |


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
# Rebuild all Android APKs locally
npm run build:apk

# Verify APK signature matches canonical release key
bash scripts/verify_apk_signature.sh apks/soko-mobile.apk
```

---

### 🔐 APK Release Signing Parity & Verification

To ensure seamless in-place updates without Android "App not installed as package conflicts with an existing package" errors:
1. **Canonical Keystore**: `scripts/keystore/soko.keystore` is the authoritative signing key.
2. **Local Environment Secrets**: Run `bash scripts/export_keystore_base64.sh --write-env` to generate `.env.signing` (gitignored).
3. **CI/CD Parity**: GitHub Actions CI uses the identical `ANDROID_KEYSTORE_BASE64` secret to sign release artifacts.
4. **Hardware Permissions**: Android APK manifests include `android.permission.CAMERA` with origin-restricted runtime permissions for the Universal QR pairing scanner.
