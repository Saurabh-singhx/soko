#!/usr/bin/env bash
set -e

# ==============================================================================
# Soko Android Keystore Base64 Exporter for CI/CD Secrets
# Encodes scripts/keystore/soko.keystore into a Base64 string suitable for
# the GitHub Actions ANDROID_KEYSTORE_BASE64 secret.
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "${SCRIPT_DIR}")"
KEYSTORE_DIR="${PROJECT_ROOT}/scripts/keystore"
KEYSTORE="${KEYSTORE_DIR}/soko.keystore"
KEY_PASS="${ANDROID_KEYSTORE_PASSWORD:-sokopassword}"
KEY_ALIAS="${ANDROID_KEY_ALIAS:-soko-key}"

mkdir -p "${KEYSTORE_DIR}"

if [ ! -f "${KEYSTORE}" ]; then
  echo "Keystore not found. Generating persistent signing keystore at ${KEYSTORE}..."
  keytool -genkeypair -v \
    -keystore "${KEYSTORE}" \
    -alias "${KEY_ALIAS}" \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -storepass "${KEY_PASS}" \
    -keypass "${KEY_PASS}" \
    -dname "CN=Soko, OU=Mobile, O=Soko Ecosystem, L=San Francisco, ST=CA, C=US"
fi

B64_KEYSTORE="$(base64 -w 0 "${KEYSTORE}" 2>/dev/null || base64 "${KEYSTORE}" | tr -d '\n')"

echo "=============================================================================="
echo " Soko Android Production Keystore Base64 Encoded"
echo "=============================================================================="
echo "Keystore Path: ${KEYSTORE}"
echo "Key Alias:     ${KEY_ALIAS}"
echo "=============================================================================="
echo ""
echo "To configure GitHub Actions for persistent signing across all CI builds:"
echo "1. Go to your GitHub repository -> Settings -> Secrets and variables -> Actions"
echo "2. Add the following New Repository Secrets:"
echo "   - ANDROID_KEYSTORE_BASE64: (Copy and paste the Base64 string below)"
echo "   - ANDROID_KEYSTORE_PASSWORD: ${KEY_PASS}"
echo "   - ANDROID_KEY_ALIAS: ${KEY_ALIAS}"
echo "   - ANDROID_KEY_PASSWORD: ${KEY_PASS}"
echo ""
echo "--- BEGIN BASE64 KEYSTORE ---"
echo "${B64_KEYSTORE}"
echo "--- END BASE64 KEYSTORE ---"
