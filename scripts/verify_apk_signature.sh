#!/usr/bin/env bash
set -e

# ==============================================================================
# Soko APK Signature Parity Verifier
# Compares an APK's signing certificate with the canonical repository keystore
# ==============================================================================

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_APK="${1:-${PROJECT_ROOT}/apks/soko-mobile.apk}"

if [ ! -f "${TARGET_APK}" ]; then
  echo "[ERROR] Target APK not found: ${TARGET_APK}"
  echo "Usage: $0 [path/to/app.apk]"
  exit 1
fi

SDK_HOME="${ANDROID_HOME:-}"
if [ -z "${SDK_HOME}" ] || [ ! -d "${SDK_HOME}" ]; then
  if [ -d "${HOME}/Android/Sdk" ]; then
    SDK_HOME="${HOME}/Android/Sdk"
  elif [ -d "/home/saurabh/Android/Sdk" ]; then
    SDK_HOME="/home/saurabh/Android/Sdk"
  fi
fi

APKSIGNER=""
if [ -n "${SDK_HOME}" ] && [ -d "${SDK_HOME}/build-tools" ]; then
  for dir in $(find "${SDK_HOME}/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -Vr); do
    if [ -f "${dir}/apksigner" ]; then
      APKSIGNER="${dir}/apksigner"
      break
    fi
  done
fi

if [ -z "${APKSIGNER}" ]; then
  APKSIGNER="$(which apksigner 2>/dev/null || true)"
fi

if [ -z "${APKSIGNER}" ]; then
  echo "[ERROR] apksigner tool not found."
  exit 1
fi

KEYSTORE="${PROJECT_ROOT}/scripts/keystore/soko.keystore"
EXPECTED_SHA256="$(keytool -list -v -keystore "${KEYSTORE}" -storepass "sokopassword" 2>/dev/null | grep -E "SHA256:|SHA-256:" | head -n 1 | awk '{print $2}' | tr -d ' ' | tr '[:upper:]' '[:lower:]' | tr -d ':')"

APK_INFO="$("${APKSIGNER}" verify --print-certs "${TARGET_APK}" 2>/dev/null)"
APK_SHA256="$(echo "${APK_INFO}" | grep -i "certificate SHA-256 digest" | head -n 1 | awk '{print $NF}' | tr -d ' ' | tr '[:upper:]' '[:lower:]' | tr -d ':')"

echo "=============================================================================="
echo " Soko APK Signature Verification"
echo "=============================================================================="
echo "Target APK:        ${TARGET_APK}"
echo "Keystore Expected: ${EXPECTED_SHA256}"
echo "APK Digest:        ${APK_SHA256}"
echo "------------------------------------------------------------------------------"

if [ -n "${APK_SHA256}" ] && [ "${APK_SHA256}" == "${EXPECTED_SHA256}" ]; then
  echo "✓ [PASS] Signature Matches Canonical Soko Release Key!"
  echo "  Certificate: A4:EB:D2:EB:82:85:A6:B4:A0:89:91:EC:81:AD:CF:F9:E0:49:B9:A2:7E:2C:00:42:BE:05:65:21:E4:50:DB:84"
  exit 0
else
  echo "✗ [FAIL] Signature MISMATCH! APK was signed with a different key."
  exit 1
fi
