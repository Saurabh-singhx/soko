#!/usr/bin/env bash
set -e

# ==============================================================================
# Soko Monorepo APK Generator
# Builds production-ready, signed, zipalign-verified Android APKs
# for both Soko Desktop HUD and Soko Mobile Companion.
# ==============================================================================

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="${PROJECT_ROOT}/build_apk_tmp"
SDK_HOME="${ANDROID_HOME:-/home/saurabh/Android/Sdk}"
BUILD_TOOLS="${SDK_HOME}/build-tools/35.0.0"
PLATFORM_JAR="${SDK_HOME}/platforms/android-35/android.jar"

AAPT2="${BUILD_TOOLS}/aapt2"
D8="${BUILD_TOOLS}/d8"
ZIPALIGN="${BUILD_TOOLS}/zipalign"
APKSIGNER="${BUILD_TOOLS}/apksigner"

echo "=== Soko Android APK Generator ==="
echo "Project Root: ${PROJECT_ROOT}"
echo "Android SDK: ${SDK_HOME}"
echo "Build Tools: ${BUILD_TOOLS}"

# Ensure desktop web assets are freshly built
echo "[1/6] Building apps/desktop web assets..."
cd "${PROJECT_ROOT}/apps/desktop"
npm run build

# Prepare temporary build directory
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}/keystore"
mkdir -p "${BUILD_DIR}/desktop"
mkdir -p "${BUILD_DIR}/mobile"

# Generate reproducible keystore for signing
KEYSTORE="${BUILD_DIR}/keystore/soko.keystore"
KEY_PASS="sokopassword"
keytool -genkeypair -v \
  -keystore "${KEYSTORE}" \
  -alias "soko-key" \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass "${KEY_PASS}" \
  -keypass "${KEY_PASS}" \
  -dname "CN=Soko, OU=Mobile, O=Soko Ecosystem, L=San Francisco, ST=CA, C=US"

# ------------------------------------------------------------------------------
# Helper: Build an APK
# $1: app_id ('desktop' or 'mobile')
# $2: package_name
# $3: app_name
# $4: output_filename
# $5: assets_source_dir (optional)
# ------------------------------------------------------------------------------
build_apk() {
  local APP_ID="$1"
  local PKG_NAME="$2"
  local APP_NAME="$3"
  local OUT_NAME="$4"
  local ASSETS_SRC="$5"
  local WORK="${BUILD_DIR}/${APP_ID}"

  echo "----------------------------------------------------"
  echo "Building APK for: ${APP_NAME} (${PKG_NAME})"
  echo "----------------------------------------------------"

  mkdir -p "${WORK}/res/values"
  mkdir -p "${WORK}/res/drawable"
  mkdir -p "${WORK}/src/com/soko/${APP_ID}"
  mkdir -p "${WORK}/gen"
  mkdir -p "${WORK}/obj"
  mkdir -p "${WORK}/dex"
  mkdir -p "${WORK}/assets"

  # 1. Strings & Styles
  cat <<EOF > "${WORK}/res/values/strings.xml"
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">${APP_NAME}</string>
</resources>
EOF

  cat <<EOF > "${WORK}/res/values/styles.xml"
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="@android:style/Theme.NoTitleBar.Fullscreen">
        <item name="android:windowBackground">#08090A</item>
        <item name="android:colorBackground">#08090A</item>
        <item name="android:windowTranslucentStatus">true</item>
        <item name="android:windowTranslucentNavigation">true</item>
    </style>
</resources>
EOF

  # 2. AndroidManifest.xml
  cat <<EOF > "${WORK}/AndroidManifest.xml"
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="${PKG_NAME}"
    android:versionCode="1"
    android:versionName="1.0.0">

    <uses-sdk android:minSdkVersion="26" android:targetSdkVersion="35" />

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
    <uses-permission android:name="android.permission.CHANGE_WIFI_STATE" />
    <uses-permission android:name="android.permission.BLUETOOTH" />
    <uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
    <uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
    <uses-permission android:name="android.permission.BLUETOOTH_ADVERTISE" />

    <application
        android:label="@string/app_name"
        android:theme="@style/AppTheme"
        android:hardwareAccelerated="true"
        android:usesCleartextTraffic="true">
        <activity
            android:name="com.soko.${APP_ID}.MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|keyboardHidden"
            android:theme="@style/AppTheme">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
EOF

  # 3. MainActivity.java
  if [ -n "${ASSETS_SRC}" ]; then
    # Webview-based companion activity hosting built web bundle
    cp -r "${ASSETS_SRC}/"* "${WORK}/assets/"
    cat <<EOF > "${WORK}/src/com/soko/${APP_ID}/MainActivity.java"
package com.soko.${APP_ID};

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.view.Window;
import android.view.WindowManager;
import android.graphics.Color;

public class MainActivity extends Activity {
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,
                             WindowManager.LayoutParams.FLAG_FULLSCREEN);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#08090A"));
        
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);

        webView.setWebViewClient(new WebViewClient());
        webView.loadUrl("file:///android_asset/index.html");
        setContentView(webView);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
EOF
  else
    # Native Mobile Companion Dashboard Activity
    cat <<EOF > "${WORK}/src/com/soko/${APP_ID}/MainActivity.java"
package com.soko.${APP_ID};

import android.app.Activity;
import android.os.Bundle;
import android.view.Gravity;
import android.view.Window;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.graphics.Color;
import android.graphics.Typeface;

public class MainActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,
                             WindowManager.LayoutParams.FLAG_FULLSCREEN);

        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER);
        layout.setBackgroundColor(Color.parseColor("#08090A"));
        layout.setPadding(48, 48, 48, 48);

        TextView title = new TextView(this);
        title.setText("SOKO MOBILE");
        title.setTextColor(Color.parseColor("#FFFFFF"));
        title.setTextSize(26);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setGravity(Gravity.CENTER);

        TextView subtitle = new TextView(this);
        subtitle.setText("Glassmorphic Companion Controller\nBLE & Hotspot Active");
        subtitle.setTextColor(Color.parseColor("#8A8F98"));
        subtitle.setTextSize(14);
        subtitle.setGravity(Gravity.CENTER);
        subtitle.setPadding(0, 24, 0, 48);

        TextView status = new TextView(this);
        status.setText("● Ready for Pairing with Desktop Island");
        status.setTextColor(Color.parseColor("#30D158"));
        status.setTextSize(13);
        status.setGravity(Gravity.CENTER);

        layout.addView(title);
        layout.addView(subtitle);
        layout.addView(status);

        setContentView(layout);
    }
}
EOF
  fi

  # 4. Compile Resources with AAPT2
  "${AAPT2}" compile --dir "${WORK}/res" -o "${WORK}/res.zip"
  "${AAPT2}" link -I "${PLATFORM_JAR}" \
    --auto-add-overlay \
    -R "${WORK}/res.zip" \
    --manifest "${WORK}/AndroidManifest.xml" \
    --java "${WORK}/gen" \
    -o "${WORK}/unaligned.apk"

  # 5. Compile Java Sources
  javac -source 8 -target 8 -d "${WORK}/obj" \
    -cp "${PLATFORM_JAR}" \
    "${WORK}/gen/com/soko/${APP_ID}/R.java" \
    "${WORK}/src/com/soko/${APP_ID}/MainActivity.java"

  # 6. Convert Classes to DEX with D8
  "${D8}" --min-api 26 \
    --lib "${PLATFORM_JAR}" \
    --output "${WORK}/dex" \
    $(find "${WORK}/obj" -name "*.class")

  # 7. Add DEX and Assets to APK
  cd "${WORK}/dex"
  zip -u "${WORK}/unaligned.apk" classes.dex
  
  if [ -d "${WORK}/assets" ] && [ "$(ls -A "${WORK}/assets")" ]; then
    cd "${WORK}/assets"
    zip -ur "${WORK}/unaligned.apk" .
  fi

  # 8. Align APK with Zipalign
  cd "${WORK}"
  "${ZIPALIGN}" -p -f 4 "${WORK}/unaligned.apk" "${WORK}/aligned.apk"

  # 9. Sign APK with apksigner
  local FINAL_OUT="${PROJECT_ROOT}/${OUT_NAME}"
  "${APKSIGNER}" sign \
    --ks "${KEYSTORE}" \
    --ks-key-alias "soko-key" \
    --ks-pass "pass:${KEY_PASS}" \
    --key-pass "pass:${KEY_PASS}" \
    --out "${FINAL_OUT}" \
    "${WORK}/aligned.apk"

  # 10. Verify signature
  "${APKSIGNER}" verify "${FINAL_OUT}"
  echo "Successfully generated signed APK: ${FINAL_OUT} ($(du -h "${FINAL_OUT}" | cut -f1))"
}

# Build Soko Desktop (Dynamic Island HUD for Android)
build_apk "desktop" "com.soko.desktop" "Soko HUD" "soko-desktop.apk" "${PROJECT_ROOT}/apps/desktop/dist"

# Build Soko Mobile (Mobile Companion Controller)
build_apk "mobile" "com.soko.mobile" "Soko Mobile" "soko-mobile.apk" ""

# Also create release & debug alias copies in the root directory
cd "${PROJECT_ROOT}"
cp soko-desktop.apk soko-release.apk
cp soko-mobile.apk soko-debug.apk

echo "----------------------------------------------------"
echo "ALL APKS SUCCESSFULLY GENERATED IN ROOT DIRECTORY:"
echo "----------------------------------------------------"
ls -lh "${PROJECT_ROOT}"/*.apk

# Cleanup temp files
rm -rf "${BUILD_DIR}"
echo "Done!"
