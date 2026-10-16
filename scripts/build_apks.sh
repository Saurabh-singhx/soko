#!/usr/bin/env bash
set -e

# ==============================================================================
# Soko Monorepo APK Generator
# Builds production-ready, signed, zipalign-verified Android APKs
# for both Soko Desktop HUD and Soko Mobile Companion.
# ==============================================================================

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="${PROJECT_ROOT}/build_apk_tmp"

# Detect Android SDK Home
SDK_HOME="${ANDROID_HOME:-/home/saurabh/Android/Sdk}"
if [ ! -d "${SDK_HOME}" ] && [ -d "/usr/local/lib/android/sdk" ]; then
  SDK_HOME="/usr/local/lib/android/sdk"
fi

# Detect Build Tools (pick highest version installed)
BUILD_TOOLS_DIR="${SDK_HOME}/build-tools"
if [ -d "${BUILD_TOOLS_DIR}" ]; then
  BUILD_TOOLS="$(find "${BUILD_TOOLS_DIR}" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -n 1)"
else
  BUILD_TOOLS="${SDK_HOME}/build-tools/35.0.0"
fi

# Detect Platform JAR (pick highest API platform)
PLATFORMS_DIR="${SDK_HOME}/platforms"
if [ -d "${PLATFORMS_DIR}" ]; then
  PLATFORM_DIR="$(find "${PLATFORMS_DIR}" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -n 1)"
  PLATFORM_JAR="${PLATFORM_DIR}/android.jar"
else
  PLATFORM_JAR="${SDK_HOME}/platforms/android-35/android.jar"
fi

AAPT2="${BUILD_TOOLS}/aapt2"
D8="${BUILD_TOOLS}/d8"
ZIPALIGN="${BUILD_TOOLS}/zipalign"
APKSIGNER="${BUILD_TOOLS}/apksigner"

# ==============================================================================
# Dynamic Version Resolution & Auto-Incrementing Build Counter
# ==============================================================================
BUILD_COUNTER_FILE="${PROJECT_ROOT}/.build_number"
GIT_COUNT="$(git -C "${PROJECT_ROOT}" rev-list --count HEAD 2>/dev/null || echo "44")"

if [ -f "${BUILD_COUNTER_FILE}" ]; then
  LAST_BUILD="$(cat "${BUILD_COUNTER_FILE}" | tr -d '[:space:]')"
  if ! [[ "${LAST_BUILD}" =~ ^[0-9]+$ ]]; then
    LAST_BUILD="${GIT_COUNT}"
  fi
else
  LAST_BUILD="${GIT_COUNT}"
fi

# Ensure build number is always strictly greater than git count and strictly increasing
if [ "${LAST_BUILD}" -lt "${GIT_COUNT}" ]; then
  LAST_BUILD="${GIT_COUNT}"
fi

NEW_BUILD=$(( LAST_BUILD + 1 ))
echo "${NEW_BUILD}" > "${BUILD_COUNTER_FILE}"
VERSION_CODE="${SOKO_BUILD_NUMBER:-${NEW_BUILD}}"

BASE_VERSION="$(node -p "require('${PROJECT_ROOT}/package.json').version" 2>/dev/null || echo "1.0.1")"
VERSION_NAME="${SOKO_VERSION:-${BASE_VERSION}.${VERSION_CODE}}"

echo "=== Soko Android APK Generator ==="
echo "Project Root: ${PROJECT_ROOT}"
echo "Android SDK: ${SDK_HOME}"
echo "Build Tools: ${BUILD_TOOLS}"
echo "Target Platform: ${PLATFORM_JAR}"
echo "Build Version: ${VERSION_NAME} (code: ${VERSION_CODE})"

# Ensure desktop web assets are freshly built
echo "[1/6] Building apps/desktop web assets..."
cd "${PROJECT_ROOT}/apps/desktop"
npm run build

# Generate Soko Bot Mascot launcher icons if needed
if [ ! -f "${PROJECT_ROOT}/apps/mobile/res/mipmap-xxxhdpi/ic_launcher.png" ]; then
  echo "[1b/6] Generating Soko Bot mascot icons for Android launcher..."
  python3 "${PROJECT_ROOT}/scripts/generate_apk_icon.py" || true
fi

# Prepare temporary build directory
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}/desktop"
mkdir -p "${BUILD_DIR}/mobile"

# Persistent keystore for signing (ensures signature compatibility across updates)
KEYSTORE_DIR="${PROJECT_ROOT}/scripts/keystore"
mkdir -p "${KEYSTORE_DIR}"
KEYSTORE="${KEYSTORE_DIR}/soko.keystore"
KEY_PASS="sokopassword"

if [ ! -f "${KEYSTORE}" ]; then
  echo "Generating persistent signing keystore at ${KEYSTORE}..."
  keytool -genkeypair -v \
    -keystore "${KEYSTORE}" \
    -alias "soko-key" \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -storepass "${KEY_PASS}" \
    -keypass "${KEY_PASS}" \
    -dname "CN=Soko, OU=Mobile, O=Soko Ecosystem, L=San Francisco, ST=CA, C=US"
fi

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
  mkdir -p "${WORK}/res/mipmap-mdpi"
  mkdir -p "${WORK}/res/mipmap-hdpi"
  mkdir -p "${WORK}/res/mipmap-xhdpi"
  mkdir -p "${WORK}/res/mipmap-xxhdpi"
  mkdir -p "${WORK}/res/mipmap-xxxhdpi"
  mkdir -p "${WORK}/src/com/soko/${APP_ID}"
  mkdir -p "${WORK}/gen"
  mkdir -p "${WORK}/obj"
  mkdir -p "${WORK}/dex"
  mkdir -p "${WORK}/assets"

  # Copy Soko Bot Mascot launcher icons
  if [ -d "${PROJECT_ROOT}/apps/mobile/res" ]; then
    cp -r "${PROJECT_ROOT}/apps/mobile/res/"* "${WORK}/res/"
  fi

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
    <style name="AppTheme" parent="@android:style/Theme.NoTitleBar">
        <item name="android:windowBackground">#090B10</item>
        <item name="android:colorBackground">#090B10</item>
        <item name="android:statusBarColor">#090B10</item>
        <item name="android:navigationBarColor">#090B10</item>
        <item name="android:windowDrawsSystemBarBackgrounds">true</item>
    </style>
</resources>
EOF

  # 2. AndroidManifest.xml
  cat <<EOF > "${WORK}/AndroidManifest.xml"
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="${PKG_NAME}"
    android:versionCode="${VERSION_CODE}"
    android:versionName="${VERSION_NAME}">

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
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
    <uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />

    <application
        android:label="@string/app_name"
        android:icon="@drawable/ic_launcher"
        android:roundIcon="@drawable/ic_launcher_round"
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
        <!-- Persistent Foreground Service to prevent background process kill -->
        <service
            android:name="com.soko.mobile.SokoBackgroundService"
            android:label="Soko Link Service"
            android:foregroundServiceType="connectedDevice"
            android:exported="false" />

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

        <!-- Boot Receiver to auto-start daemon on phone reboot -->
        <receiver
            android:name="com.soko.mobile.BootReceiver"
            android:enabled="true"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.QUICKBOOT_POWERON" />
            </intent-filter>
        </receiver>
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
import android.webkit.DownloadListener;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.JavascriptInterface;
import android.net.Uri;
import android.content.ClipData;
import android.app.DownloadManager;
import android.os.Environment;
import android.view.Window;
import android.view.WindowManager;
import android.view.View;
import android.graphics.Color;
import android.content.Intent;
import android.content.SharedPreferences;
import android.provider.Settings;
import android.util.Log;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.media.MediaMetadata;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.IntentFilter;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.net.URL;
import java.net.HttpURLConnection;

public class MainActivity extends Activity {
    private static final int FILECHOOSER_RESULTCODE = 1001;
    private static final String MEDIA_CHANNEL_ID = "soko_media_playback";
    private static final int MEDIA_NOTIF_ID = 9001;
    private ValueCallback<Uri[]> uploadMessage = null;
    private WebView webView;
    private MediaSession mediaSession;
    private Bitmap currentCoverBitmap = null;
    private String currentCoverUrl = null;
    private String currentTitle = "YouTube Track";
    private String currentArtist = "Soko Music";
    private boolean currentIsPlaying = false;

    private BroadcastReceiver mediaActionReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (intent == null || intent.getAction() == null) return;
            String action = intent.getAction();
            final String mappedAction;
            if ("com.soko.mobile.ACTION_TOGGLE".equals(action)) {
                mappedAction = "toggle";
            } else if ("com.soko.mobile.ACTION_NEXT".equals(action)) {
                mappedAction = "next";
            } else if ("com.soko.mobile.ACTION_PREV".equals(action)) {
                mappedAction = "prev";
            } else {
                return;
            }
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (webView != null) webView.evaluateJavascript("handleNativeMediaAction('" + mappedAction + "')", null);
                }
            });
        }
    };

    private void createMediaNotificationChannel() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                MEDIA_CHANNEL_ID,
                "Soko Music Playback",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Shows active playback controls in Quick Settings and lock screen.");
            channel.setShowBadge(false);
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.createNotificationChannel(channel);
            }
        }
    }

    private void postMediaNotification(String title, String artist, boolean isPlaying) {
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }

            Intent openIntent = new Intent(this, MainActivity.class);
            openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent openPendingIntent = PendingIntent.getActivity(this, 0, openIntent, flags);

            PendingIntent toggleIntent = PendingIntent.getBroadcast(
                this, 1, new Intent("com.soko.mobile.ACTION_TOGGLE").setPackage(getPackageName()), flags
            );
            PendingIntent prevIntent = PendingIntent.getBroadcast(
                this, 2, new Intent("com.soko.mobile.ACTION_PREV").setPackage(getPackageName()), flags
            );
            PendingIntent nextIntent = PendingIntent.getBroadcast(
                this, 3, new Intent("com.soko.mobile.ACTION_NEXT").setPackage(getPackageName()), flags
            );

            Notification.Builder builder;
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                builder = new Notification.Builder(this, MEDIA_CHANNEL_ID);
            } else {
                builder = new Notification.Builder(this);
            }

            Notification.MediaStyle style = new Notification.MediaStyle();
            if (mediaSession != null) {
                style.setMediaSession(mediaSession.getSessionToken());
            }
            style.setShowActionsInCompactView(0, 1, 2);

            builder.setStyle(style)
                .setSmallIcon(android.R.drawable.ic_media_play)
                .setContentTitle(title != null && !title.isEmpty() ? title : "YouTube Track")
                .setContentText(artist != null && !artist.isEmpty() ? artist : "Soko Music")
                .setContentIntent(openPendingIntent)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setOngoing(isPlaying);

            builder.addAction(new Notification.Action.Builder(
                android.R.drawable.ic_media_previous, "Previous", prevIntent
            ).build());

            builder.addAction(new Notification.Action.Builder(
                isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
                isPlaying ? "Pause" : "Play",
                toggleIntent
            ).build());

            builder.addAction(new Notification.Action.Builder(
                android.R.drawable.ic_media_next, "Next", nextIntent
            ).build());

            if (currentCoverBitmap != null) {
                builder.setLargeIcon(currentCoverBitmap);
            }

            nm.notify(MEDIA_NOTIF_ID, builder.build());
        } catch (Exception e) {
            Log.e("SokoApp", "Error posting media notification: " + e.getMessage());
        }
    }

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

        @JavascriptInterface
        public void savePairToken(String token) {
            try {
                SharedPreferences prefs = getSharedPreferences("soko_prefs", MODE_PRIVATE);
                prefs.edit().putString("pair_token", token).apply();
            } catch (Exception e) {
                Log.e("SokoApp", "Error saving pair token", e);
            }
        }

        @JavascriptInterface
        public String getSavedPairToken() {
            try {
                SharedPreferences prefs = getSharedPreferences("soko_prefs", MODE_PRIVATE);
                return prefs.getString("pair_token", "");
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface
        public boolean isBatteryOptimizationIgnored() {
            try {
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                    android.os.PowerManager pm = (android.os.PowerManager) getSystemService(POWER_SERVICE);
                    return pm != null && pm.isIgnoringBatteryOptimizations(getPackageName());
                }
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public void requestIgnoreBatteryOptimization() {
            try {
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                    String pkg = getPackageName();
                    android.os.PowerManager pm = (android.os.PowerManager) getSystemService(POWER_SERVICE);
                    if (pm != null && !pm.isIgnoringBatteryOptimizations(pkg)) {
                        Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                        intent.setData(Uri.parse("package:" + pkg));
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                    }
                }
            } catch (Exception e) {
                try {
                    Intent intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(intent);
                } catch (Exception ex) {
                    Log.e("SokoApp", "Error requesting battery optimization exemption", ex);
                }
            }
        }

        @JavascriptInterface
        public void downloadFile(String fileUrl, String filename, String mimeType) {
            try {
                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(fileUrl));
                if (mimeType != null && !mimeType.isEmpty()) {
                    request.setMimeType(mimeType);
                }
                String name = (filename != null && !filename.isEmpty()) ? filename : "soko-transfer.bin";
                request.setTitle(name);
                request.setDescription("Saved from Soko Desktop link");
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);

                DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                if (dm != null) {
                    dm.enqueue(request);
                }
            } catch (Exception e) {
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW);
                    intent.setDataAndType(Uri.parse(fileUrl), (mimeType != null && !mimeType.isEmpty()) ? mimeType : "*/*");
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(intent);
                } catch (Exception ex) {
                    Log.e("SokoApp", "Error downloading file", ex);
                }
            }
        }

        @JavascriptInterface
        public String getAppVersion() {
            return "__VERSION_NAME__ (Build __VERSION_CODE__)";
        }

        @JavascriptInterface
        public void updateNativePlayer(final String title, final String artist, final boolean isPlaying, final int durationSec, final int positionSec, final String coverUrl) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    currentTitle = (title != null && !title.isEmpty()) ? title : "YouTube Track";
                    currentArtist = (artist != null && !artist.isEmpty()) ? artist : "Soko Music";
                    currentIsPlaying = isPlaying;

                    if (mediaSession != null) {
                        try {
                            PlaybackState.Builder stateBuilder = new PlaybackState.Builder();
                            stateBuilder.setActions(
                                PlaybackState.ACTION_PLAY |
                                PlaybackState.ACTION_PAUSE |
                                PlaybackState.ACTION_PLAY_PAUSE |
                                PlaybackState.ACTION_SKIP_TO_NEXT |
                                PlaybackState.ACTION_SKIP_TO_PREVIOUS |
                                PlaybackState.ACTION_SEEK_TO
                            );
                            stateBuilder.setState(
                                isPlaying ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED,
                                positionSec * 1000L,
                                isPlaying ? 1.0f : 0.0f
                            );
                            mediaSession.setPlaybackState(stateBuilder.build());

                            MediaMetadata.Builder metaBuilder = new MediaMetadata.Builder();
                            metaBuilder.putString(MediaMetadata.METADATA_KEY_TITLE, currentTitle);
                            metaBuilder.putString(MediaMetadata.METADATA_KEY_ARTIST, currentArtist);
                            metaBuilder.putString(MediaMetadata.METADATA_KEY_ALBUM, "Soko Music Library");
                            metaBuilder.putLong(MediaMetadata.METADATA_KEY_DURATION, durationSec * 1000L);

                            if (currentCoverBitmap != null) {
                                metaBuilder.putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, currentCoverBitmap);
                                metaBuilder.putBitmap(MediaMetadata.METADATA_KEY_ART, currentCoverBitmap);
                            }

                            mediaSession.setMetadata(metaBuilder.build());
                            mediaSession.setActive(true);
                        } catch (Exception e) {
                            Log.e("SokoApp", "Error updating MediaSession state: " + e.getMessage());
                        }
                    }

                    postMediaNotification(currentTitle, currentArtist, currentIsPlaying);
                }
            });

            if (coverUrl != null && !coverUrl.isEmpty() && !coverUrl.equals(currentCoverUrl)) {
                currentCoverUrl = coverUrl;
                new Thread(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            URL url = new URL(coverUrl);
                            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                            conn.setDoInput(true);
                            conn.setConnectTimeout(4000);
                            conn.setReadTimeout(6000);
                            conn.connect();
                            InputStream input = conn.getInputStream();
                            final Bitmap bmp = BitmapFactory.decodeStream(input);
                            if (bmp != null) {
                                currentCoverBitmap = bmp;
                                runOnUiThread(new Runnable() {
                                    @Override
                                    public void run() {
                                        if (mediaSession != null && mediaSession.isActive()) {
                                            try {
                                                MediaMetadata currentMeta = mediaSession.getController().getMetadata();
                                                MediaMetadata.Builder mb = currentMeta != null ? new MediaMetadata.Builder(currentMeta) : new MediaMetadata.Builder();
                                                mb.putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, bmp);
                                                mb.putBitmap(MediaMetadata.METADATA_KEY_ART, bmp);
                                                mediaSession.setMetadata(mb.build());
                                            } catch (Exception e) {}
                                        }
                                        postMediaNotification(currentTitle, currentArtist, currentIsPlaying);
                                    }
                                });
                            }
                        } catch (Exception ex) {
                            Log.w("SokoApp", "Could not load album art bitmap: " + ex.getMessage());
                        }
                    }
                }).start();
            }
        }

        @JavascriptInterface
        public void releaseNativePlayer() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (mediaSession != null) {
                        try {
                            mediaSession.setActive(false);
                        } catch (Exception e) {}
                    }
                    try {
                        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                        if (nm != null) {
                            nm.cancel(MEDIA_NOTIF_ID);
                        }
                    } catch (Exception e) {}
                }
            });
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);

        // Safe Area View: System status bar & navigation bar theme
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS | WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            getWindow().setStatusBarColor(Color.parseColor("#090B10"));
            getWindow().setNavigationBarColor(Color.parseColor("#090B10"));
        }

        // Support display cutouts / notches safely on Android 9+
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
            getWindow().getAttributes().layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }

        if ("mobile".equals("${APP_ID}")) {
            try {
                Intent serviceIntent = new Intent();
                serviceIntent.setClassName(this, "com.soko.mobile.SokoBackgroundService");
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    startForegroundService(serviceIntent);
                } else {
                    startService(serviceIntent);
                }
            } catch (Exception e) {
                Log.w("SokoApp", "Could not start Soko background service: " + e.getMessage());
            }

            if (android.os.Build.VERSION.SDK_INT >= 33) {
                if (checkSelfPermission("android.permission.POST_NOTIFICATIONS") != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 102);
                }
            }
        }

        createMediaNotificationChannel();
        try {
            IntentFilter filter = new IntentFilter();
            filter.addAction("com.soko.mobile.ACTION_TOGGLE");
            filter.addAction("com.soko.mobile.ACTION_NEXT");
            filter.addAction("com.soko.mobile.ACTION_PREV");
            if (android.os.Build.VERSION.SDK_INT >= 33) {
                registerReceiver(mediaActionReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
            } else {
                registerReceiver(mediaActionReceiver, filter);
            }
        } catch (Exception e) {
            Log.w("SokoApp", "Error registering mediaActionReceiver: " + e.getMessage());
        }

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
            try {
                mediaSession = new MediaSession(this, "SokoMusicPlayer");
                mediaSession.setCallback(new MediaSession.Callback() {
                    @Override
                    public void onPlay() {
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                if (webView != null) webView.evaluateJavascript("handleNativeMediaAction('play')", null);
                            }
                        });
                    }
                    @Override
                    public void onPause() {
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                if (webView != null) webView.evaluateJavascript("handleNativeMediaAction('pause')", null);
                            }
                        });
                    }
                    @Override
                    public void onSkipToNext() {
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                if (webView != null) webView.evaluateJavascript("handleNativeMediaAction('next')", null);
                            }
                        });
                    }
                    @Override
                    public void onSkipToPrevious() {
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                if (webView != null) webView.evaluateJavascript("handleNativeMediaAction('prev')", null);
                            }
                        });
                    }
                    @Override
                    public void onSeekTo(final long pos) {
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                if (webView != null) webView.evaluateJavascript("seekConnectorTrack(" + (pos / 1000) + ")", null);
                            }
                        });
                    }
                });
                mediaSession.setFlags(MediaSession.FLAG_HANDLES_MEDIA_BUTTONS | MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS);
            } catch (Exception e) {
                Log.e("SokoApp", "Error initializing MediaSession: " + e.getMessage());
            }
        }

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#090B10"));
        webView.setFitsSystemWindows(true);

        // Remove all scrollbars completely and disable overscroll glow
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);
        webView.setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        
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
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.JELLY_BEAN_MR1) {
            settings.setMediaPlaybackRequiresUserGesture(false);
        }

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

        webView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimeType, long contentLength) {
                try {
                    DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                    if (mimeType != null && !mimeType.isEmpty()) {
                        request.setMimeType(mimeType);
                    }
                    String filename = URLUtil.guessFileName(url, contentDisposition, mimeType);
                    request.setTitle(filename);
                    request.setDescription("Saved from Soko Desktop");
                    request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                    request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename);

                    DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                    if (dm != null) {
                        dm.enqueue(request);
                    }
                } catch (Exception e) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW);
                        intent.setDataAndType(Uri.parse(url), (mimeType != null && !mimeType.isEmpty()) ? mimeType : "*/*");
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                    } catch (Exception ex) {
                        Log.e("SokoApp", "Download listener error", ex);
                    }
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

    @Override
    protected void onDestroy() {
        if (mediaSession != null) {
            try {
                mediaSession.setActive(false);
                mediaSession.release();
                mediaSession = null;
            } catch (Exception e) {}
        }
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.cancel(MEDIA_NOTIF_ID);
        } catch (Exception e) {}
        try {
            unregisterReceiver(mediaActionReceiver);
        } catch (Exception e) {}
        super.onDestroy();
    }
}
EOF
    sed -i "s/__VERSION_NAME__/${VERSION_NAME}/g" "${WORK}/src/com/soko/${APP_ID}/MainActivity.java"
    sed -i "s/__VERSION_CODE__/${VERSION_CODE}/g" "${WORK}/src/com/soko/${APP_ID}/MainActivity.java"
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
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS | WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            getWindow().setStatusBarColor(Color.parseColor("#090B10"));
            getWindow().setNavigationBarColor(Color.parseColor("#090B10"));
        }

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
    cat <<EOF > "${WORK}/src/com/soko/mobile/SokoBackgroundService.java"
package com.soko.mobile;

import android.app.Service;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.IBinder;
import android.os.Build;
import android.util.Log;

public class SokoBackgroundService extends Service {
    private static final String TAG = "SokoBgService";
    public static final String CHANNEL_ID = "soko_foreground_link";
    public static final int NOTIF_ID = 8766;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        startInForeground();
        Log.i(TAG, "Soko Persistent Foreground Service started.");
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Soko Dynamic Island Link",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Maintains background connectivity and notification mirroring to Desktop Dynamic Island.");
            channel.setShowBadge(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) {
                nm.createNotificationChannel(channel);
            }
        }
    }

    private void startInForeground() {
        Intent launchIntent = new Intent(this, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(this, CHANNEL_ID);
        } else {
            builder = new Notification.Builder(this);
        }

        builder.setContentTitle("Soko Link Active")
               .setContentText("Mirroring phone alerts to Desktop Dynamic Island")
               .setSmallIcon(android.R.drawable.stat_notify_sync)
               .setContentIntent(pendingIntent)
               .setOngoing(true);

        Notification notification = builder.build();
        startForeground(NOTIF_ID, notification);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startInForeground();
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
EOF

    cat <<EOF > "${WORK}/src/com/soko/mobile/BootReceiver.java"
package com.soko.mobile;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

public class BootReceiver extends BroadcastReceiver {
    private static final String TAG = "SokoBootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action) ||
            "android.intent.action.QUICKBOOT_POWERON".equals(action)) {
            Log.i(TAG, "Device booted. Starting Soko background service...");
            Intent serviceIntent = new Intent(context, SokoBackgroundService.class);
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent);
                } else {
                    context.startService(serviceIntent);
                }
            } catch (Exception e) {
                Log.e(TAG, "Failed starting Soko background service on boot", e);
            }
        }
    }
}
EOF

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
        String pairToken = prefs.getString("pair_token", "");
        if (bridgeIp == null || bridgeIp.trim().isEmpty()) {
            bridgeIp = "192.168.31.210:8766";
        }
        if (!bridgeIp.startsWith("http://") && !bridgeIp.startsWith("https://")) {
            bridgeIp = "http://" + bridgeIp;
        }

        final String endpoint = bridgeIp + "/api/notify";
        final String finalPairToken = pairToken;
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
                    if (finalPairToken != null && !finalPairToken.trim().isEmpty()) {
                        conn.setRequestProperty("Authorization", "Bearer " + finalPairToken.trim());
                    }
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
