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
EOF

  if [ "${APP_ID}" = "mobile" ]; then
    cat <<EOF >> "${WORK}/AndroidManifest.xml"
        <!-- Real Android System Notification Interceptor Service -->
        <service
            android:name="com.soko.mobile.SokoNotificationListener"
            android:label="Soko Notification Mirror"
            android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE"
            android:exported="true">
            <intent-filter>
                <action android:name="android.service.notification.NotificationListenerService" />
            </intent-filter>
        </service>
EOF
  fi

  cat <<EOF >> "${WORK}/AndroidManifest.xml"
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
import android.webkit.WebChromeClient;
import android.webkit.ValueCallback;
import android.webkit.JavascriptInterface;
import android.net.Uri;
import android.content.ClipData;
import android.view.Window;
import android.view.WindowManager;
import android.graphics.Color;
import android.content.Intent;
import android.content.SharedPreferences;
import android.provider.Settings;
import android.util.Log;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;

public class MainActivity extends Activity {
    private static final int FILECHOOSER_RESULTCODE = 1001;
    private ValueCallback<Uri[]> uploadMessage = null;
    private WebView webView;

    public class SokoNativeBridge {
        @JavascriptInterface
        public boolean isNotificationAccessGranted() {
            try {
                String pkg = getPackageName();
                String listeners = Settings.Secure.getString(
                    getContentResolver(), "enabled_notification_listeners"
                );
                return listeners != null && listeners.contains(pkg);
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public void openNotificationAccess() {
            try {
                Intent intent = new Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS");
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
            } catch (Exception e) {
                Log.e("SokoApp", "Error opening notification settings", e);
            }
        }

        @JavascriptInterface
        public void saveBridgeIp(String ip) {
            try {
                SharedPreferences prefs = getSharedPreferences("soko_prefs", MODE_PRIVATE);
                prefs.edit().putString("bridge_ip", ip).apply();
            } catch (Exception e) {
                Log.e("SokoApp", "Error saving bridge IP", e);
            }
        }

        @JavascriptInterface
        public String getSavedBridgeIp() {
            try {
                SharedPreferences prefs = getSharedPreferences("soko_prefs", MODE_PRIVATE);
                return prefs.getString("bridge_ip", "");
            } catch (Exception e) {
                return "";
            }
        }
    }

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
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);

        webView.addJavascriptInterface(new SokoNativeBridge(), "SokoNative");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                Log.e("SokoApp", "Resource error on " + failingUrl + ": " + description);
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (uploadMessage != null) {
                    uploadMessage.onReceiveValue(null);
                    uploadMessage = null;
                }
                uploadMessage = filePathCallback;

                Intent intent = null;
                try {
                    if (fileChooserParams != null) {
                        intent = fileChooserParams.createIntent();
                    }
                } catch (Exception e) {
                    intent = null;
                }

                if (intent == null) {
                    intent = new Intent(Intent.ACTION_GET_CONTENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("*/*");
                }

                try {
                    startActivityForResult(Intent.createChooser(intent, "Select File to Send"), FILECHOOSER_RESULTCODE);
                    return true;
                } catch (Exception e) {
                    Log.e("SokoApp", "Cannot start file chooser", e);
                    if (uploadMessage != null) {
                        uploadMessage.onReceiveValue(null);
                        uploadMessage = null;
                    }
                    return false;
                }
            }
        });

        try {
            InputStream is = getAssets().open("index.html");
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            byte[] buf = new byte[4096];
            int read;
            while ((read = is.read(buf)) != -1) {
                baos.write(buf, 0, read);
            }
            is.close();
            String htmlContent = baos.toString("UTF-8");
            webView.loadDataWithBaseURL("file:///android_asset/", htmlContent, "text/html", "UTF-8", null);
        } catch (Exception e) {
            webView.loadUrl("file:///android_asset/index.html");
        }

        setContentView(webView);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILECHOOSER_RESULTCODE) {
            if (uploadMessage == null) return;
            Uri[] results = null;
            if (resultCode == Activity.RESULT_OK && data != null) {
                String dataString = data.getDataString();
                ClipData clipData = data.getClipData();
                if (clipData != null && clipData.getItemCount() > 0) {
                    results = new Uri[clipData.getItemCount()];
                    for (int i = 0; i < clipData.getItemCount(); i++) {
                        results[i] = clipData.getItemAt(i).getUri();
                    }
                } else if (dataString != null) {
                    results = new Uri[]{ Uri.parse(dataString) };
                } else if (data.getData() != null) {
                    results = new Uri[]{ data.getData() };
                }
            }
            uploadMessage.onReceiveValue(results);
            uploadMessage = null;
        }
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

  if [ "${APP_ID}" = "mobile" ]; then
    cat <<EOF > "${WORK}/src/com/soko/mobile/SokoNotificationListener.java"
package com.soko.mobile;

import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.app.Notification;
import android.os.Bundle;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ApplicationInfo;
import android.util.Log;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class SokoNotificationListener extends NotificationListenerService {
    private static final String TAG = "SokoNotifListener";

    @Override
    public void onListenerConnected() {
        super.onListenerConnected();
        Log.i(TAG, "Soko Notification Listener connected and active!");
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null) return;

        // Skip ongoing system notifications (e.g. music playback, active calls)
        if (sbn.isOngoing()) return;

        String packageName = sbn.getPackageName();
        if (packageName == null || packageName.equals(getPackageName())) {
            return;
        }

        Notification notification = sbn.getNotification();
        if (notification == null) return;

        Bundle extras = notification.extras;
        if (extras == null) return;

        CharSequence titleCs = extras.getCharSequence(Notification.EXTRA_TITLE);
        CharSequence textCs = extras.getCharSequence(Notification.EXTRA_TEXT);
        CharSequence bigTextCs = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);

        String title = titleCs != null ? titleCs.toString() : "";
        String body = bigTextCs != null ? bigTextCs.toString() : (textCs != null ? textCs.toString() : "");

        if (title.isEmpty() && body.isEmpty()) {
            return;
        }

        PackageManager pm = getPackageManager();
        String appName = packageName;
        try {
            ApplicationInfo ai = pm.getApplicationInfo(packageName, 0);
            appName = pm.getApplicationLabel(ai).toString();
        } catch (Exception ignored) {}

        SharedPreferences prefs = getSharedPreferences("soko_prefs", MODE_PRIVATE);
        String bridgeIp = prefs.getString("bridge_ip", "192.168.31.210:8766");
        if (bridgeIp == null || bridgeIp.trim().isEmpty()) {
            bridgeIp = "192.168.31.210:8766";
        }
        if (!bridgeIp.startsWith("http://") && !bridgeIp.startsWith("https://")) {
            bridgeIp = "http://" + bridgeIp;
        }

        final String endpoint = bridgeIp + "/api/notify";
        final String jsonPayload = "{"
            + "\"id\":\"" + escapeJson(sbn.getKey() != null ? sbn.getKey() : packageName + "_" + System.currentTimeMillis()) + "\","
            + "\"appName\":\"" + escapeJson(appName) + "\","
            + "\"packageName\":\"" + escapeJson(packageName) + "\","
            + "\"title\":\"" + escapeJson(title) + "\","
            + "\"body\":\"" + escapeJson(body) + "\""
            + "}";

        final String finalAppName = appName;
        final String finalTitle = title;

        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    URL url = new URL(endpoint);
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
                    conn.setConnectTimeout(3000);
                    conn.setReadTimeout(3000);
                    conn.setDoOutput(true);

                    byte[] bytes = jsonPayload.getBytes("UTF-8");
                    OutputStream os = conn.getOutputStream();
                    os.write(bytes);
                    os.flush();
                    os.close();

                    int code = conn.getResponseCode();
                    Log.i(TAG, "Mirrored notification to desktop [" + code + "]: " + finalAppName + " - " + finalTitle);
                    conn.disconnect();
                } catch (Exception e) {
                    Log.w(TAG, "Failed sending notification to " + endpoint + ": " + e.getMessage());
                }
            }
        }).start();
    }

    private String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\\\", "\\\\\\\\")
                .replace("\"", "\\\\\"")
                .replace("\n", "\\\\n")
                .replace("\r", "\\\\r")
                .replace("\t", "\\\\t");
    }
}
EOF
  fi

  # 4. Compile Resources with AAPT2
  local AAPT_ASSETS=""
  if [ -d "${WORK}/assets" ] && [ "$(ls -A "${WORK}/assets")" ]; then
    AAPT_ASSETS="-A ${WORK}/assets"
  fi

  "${AAPT2}" compile --dir "${WORK}/res" -o "${WORK}/res.zip"
  "${AAPT2}" link -I "${PLATFORM_JAR}" \
    --auto-add-overlay \
    -R "${WORK}/res.zip" \
    --manifest "${WORK}/AndroidManifest.xml" \
    ${AAPT_ASSETS} \
    --java "${WORK}/gen" \
    -o "${WORK}/unaligned.apk"

  # 5. Compile Java Sources
  javac -source 8 -target 8 -d "${WORK}/obj" \
    -cp "${PLATFORM_JAR}" \
    "${WORK}/gen/com/soko/${APP_ID}/R.java" \
    $(find "${WORK}/src" -name "*.java")

  # 6. Convert Classes to DEX with D8
  "${D8}" --min-api 26 \
    --lib "${PLATFORM_JAR}" \
    --output "${WORK}/dex" \
    $(find "${WORK}/obj" -name "*.class")

  # 7. Add DEX to APK
  cd "${WORK}/dex"
  zip -u "${WORK}/unaligned.apk" classes.dex

  # 8. Align APK with Zipalign
  cd "${WORK}"
  "${ZIPALIGN}" -p -f 4 "${WORK}/unaligned.apk" "${WORK}/aligned.apk"

  # 9. Sign APK with apksigner
  local FINAL_OUT="${OUTPUT_DIR}/${OUT_NAME}"
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

OUTPUT_DIR="${PROJECT_ROOT}/apks"
mkdir -p "${OUTPUT_DIR}"

# Build Soko Desktop (Dynamic Island HUD for Android)
build_apk "desktop" "com.soko.desktop" "Soko HUD" "soko-desktop.apk" "${PROJECT_ROOT}/apps/desktop/dist"

# Build Soko Mobile (Mobile Companion Controller with native notification listener)
build_apk "mobile" "com.soko.mobile" "Soko Mobile" "soko-mobile.apk" "${PROJECT_ROOT}/apps/mobile/companion"

# Build Soko Mobile Lite (Clean companion without BIND_NOTIFICATION_LISTENER_SERVICE - 0 Play Protect warnings)
build_apk "companion" "com.soko.companion" "Soko Companion Lite" "soko-mobile-lite.apk" "${PROJECT_ROOT}/apps/mobile/companion"

# Also create release & debug alias copies in the apks directory and copy to project root
cd "${OUTPUT_DIR}"
cp soko-desktop.apk soko-release.apk
cp soko-mobile.apk soko-debug.apk
cp soko-desktop.apk "${PROJECT_ROOT}/soko-desktop.apk"
cp soko-mobile.apk "${PROJECT_ROOT}/soko-mobile.apk"
cp soko-mobile-lite.apk "${PROJECT_ROOT}/soko-mobile-lite.apk"

echo "----------------------------------------------------"
echo "ALL APKS SUCCESSFULLY GENERATED IN apks/ AND ROOT:"
echo "----------------------------------------------------"
ls -lh "${OUTPUT_DIR}"/*.apk
ls -lh "${PROJECT_ROOT}"/*.apk

# Cleanup temp files
rm -rf "${BUILD_DIR}"
echo "Done!"
