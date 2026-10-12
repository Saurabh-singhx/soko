# Feature Research & Engineering: Notification Mirroring & Dynamic Island Cards

> **Feature Goal**: Intercept incoming notifications on Android, stream them instantaneously over BLE, and render animated notification cards in the desktop Dynamic Island with action buttons (Dismiss, Copy, Open).

---

## 1. Technical Requirements

1. **Low-Latency Mirroring**: Android notifications must reflect on desktop in sub-80ms.
2. **Contextual Expansion**: The Dynamic Island expands from compact pill to an actionable card showing app icon, sender, message text, and quick action buttons.
3. **Smart Deduplication**: Avoid repeated alerts for persistent notifications (e.g., music player media controls, ongoing downloads, step counters).
4. **Privacy Controls**: Blacklist sensitive apps (e.g., authenticator apps, banking, private messages) from mirroring to the desktop screen.

---

## 2. Research & Exploration History

### Attempt 1: Polling Notification Database (Failed)
- **Concept**: Periodically query Android's notification state every 2 seconds.
- **Why it Failed**:
  - Polling drains battery and introduces up to 2 seconds of lag.
  - Android security architecture strictly forbids querying active notifications via polling.

### Attempt 2: Android `NotificationListenerService` (Selected Architecture)
- **Concept**: Implement Android's official event-driven `NotificationListenerService`.
- **Why it Succeeded**:
  - **Zero CPU overhead at idle**: Android OS wakes your service only when a new notification is posted or dismissed.
  - **Full Rich Metadata**: Provides app package name, title, body text, big picture attachments, and action buttons.

---

## 3. Handling Android Notification Spam & Ongoing Notifications

Many Android apps post "ongoing" notifications that must not trigger island expansions:
```dart
// Mobile notification filter logic in Dart
bool shouldMirrorNotification(StatusBarNotification sbn) {
  final notification = sbn.notification;
  
  // 1. Skip ongoing/foreground service notifications (e.g. Spotify, downloads)
  if (sbn.isOngoing || (notification.flags & Notification.FLAG_ONGOING_EVENT) != 0) {
    return false;
  }
  
  // 2. Filter out user blacklisted apps (Banking, 2FA)
  final packageName = sbn.packageName;
  if (blacklistedPackages.contains(packageName)) {
    return false;
  }
  
  // 3. Prevent duplicate notifications with identical keys within 3 seconds
  final key = sbn.key;
  if (recentCache.isRecentDuplicate(key)) {
    return false;
  }
  
  return true;
}
```

---

## 4. Notification Packet Payload Schema

Notifications are serialized into a lightweight JSON packet:
```json
{
  "type": "NOTIFICATION_POST",
  "id": "com.whatsapp:1024",
  "app_name": "WhatsApp",
  "package_name": "com.whatsapp",
  "title": "Sarah Jenkins",
  "body": "Hey, the new APK build is ready for testing!",
  "timestamp": 1728801943000,
  "has_reply_action": true
}
```

---

## 5. Dynamic Island Notification UX Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Notification arrives on phone -> sent over BLE           │
│ 2. Desktop Island receives packet:                          │
│    • Mascot's eyes widen and head rotates toward message    │
│    • Island smoothly animates: 180px -> 380px width         │
│    • Renders app badge, sender title, and body snippet      │
│    • Renders buttons: [Copy] [Dismiss]                      │
│ 3. If untouched: Auto-collapses after 6 seconds             │
│ 4. If hovered: Remains open until mouse moves away          │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. iOS Platform Constraints (ANCS)

While Android provides full access via `NotificationListenerService`, iOS restricts third-party apps from reading notifications directly.
- **For iOS Support**: The desktop app acts as an **Apple Notification Center Service (ANCS)** BLE peripheral. The iPhone pairs with the desktop as an accessory (smartwatch profile).
- **Limitation on iOS**: Cannot filter by app package name programmatically; iOS decides which notifications are forwarded based on system Focus modes.
- **Current Architecture**: Optimized first for Android with full two-way control, with ANCS hooks ready for future iOS expansions.
