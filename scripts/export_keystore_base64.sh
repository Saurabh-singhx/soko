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
CERT_SHA256="$(keytool -list -v -keystore "${KEYSTORE}" -storepass "${KEY_PASS}" 2>/dev/null | grep -E "SHA256:|SHA-256:" | head -n 1 | awk '{print $2}' || true)"

if [[ "$1" == "--write-env" || "$1" == "--env" ]]; then
  ENV_FILE="${PROJECT_ROOT}/.env.signing"
  cat <<EOF > "${ENV_FILE}"
# Soko Android APK Release Signing Secrets
# Synchronized with GitHub Actions and Local Builds
ANDROID_KEYSTORE_BASE64=${B64_KEYSTORE}
ANDROID_KEYSTORE_PASSWORD=${KEY_PASS}
ANDROID_KEY_ALIAS=${KEY_ALIAS}
ANDROID_KEY_PASSWORD=${KEY_PASS}
EOF
  echo "[SUCCESS] Generated local signing secrets file: ${ENV_FILE}"
  echo "Certificate SHA-256: ${CERT_SHA256}"
  exit 0
fi

echo "=============================================================================="
echo " Soko Android Production Keystore Base64 Encoded"
echo "=============================================================================="
echo "Keystore Path:   ${KEYSTORE}"
echo "Key Alias:       ${KEY_ALIAS}"
echo "Cert SHA-256:    ${CERT_SHA256}"
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
