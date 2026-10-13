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

---

## 7. Authentic App Brand Icon System & Linear Dark Integration

To preserve authentic brand identity while maintaining Linear's strict `#08090A` dark aesthetic:

| Supported App | Official Brand Color | Squircle Badge Tint | Icon Glyphs |
| :--- | :--- | :--- | :--- |
| **WhatsApp** | `#25D366` (Neon Green) | `rgba(37, 211, 102, 0.12)` | Authentic speech bubble & phone receiver |
| **Telegram** | `#229ED9` (Sky Blue) | `rgba(34, 158, 217, 0.14)` | Circular paper airplane vector |
| **Slack** | `#ECB22E` (Gold / Multicolor) | `rgba(74, 21, 75, 0.35)` | Official 4-color hashtag octothorpe |
| **Discord** | `#5865F2` (Blurple) | `rgba(88, 101, 242, 0.16)` | Clyde controller face |
| **GitHub** | `#F0F6FC` (Titanium White) | `rgba(240, 246, 252, 0.10)` | Invertocat silhouette |
| **Linear** | `#5E6AD2` (Linear Indigo) | `rgba(94, 106, 210, 0.16)` | Stylized circle ribbon |
| **Gmail** | `#EA4335` (Google Red) | `rgba(234, 67, 53, 0.14)` | 4-color M-envelope |
| **Twitter / X** | `#FFFFFF` (Pure White) | `rgba(255, 255, 255, 0.10)` | Minimalist X glyph |
| **Instagram** | `#E1306C` (Sunset Pink) | `rgba(225, 48, 108, 0.14)` | Sunset gradient camera outline |
| **Spotify** | `#1DB954` (Spotify Green) | `rgba(29, 185, 84, 0.14)` | 3 audio frequency soundwaves |
| **YouTube** | `#FF0000` (YouTube Red) | `rgba(255, 0, 0, 0.14)` | Red play button |
| **Antigravity CLI** | `#00E5FF` (Cyan Accent) | `rgba(0, 229, 255, 0.14)` | Terminal diamond runner glyph |
| **Messages / SMS** | `#1A73E8` (Google Blue) | `rgba(26, 115, 232, 0.14)` | Material chat bubble |

### Theme Integration Strategy
1. **Glassmorphic Squircles**: Icons are housed in a `w-7 h-7` rounded squircle (`border border-white/12`) with a subtle dark brand tint backdrop. This prevents harsh neon clash against the `#08090A` dark canvas.
2. **Typography Coupling**: The app name in the header is dynamically colored with the app's official brand accent (`style={{ color: brand.color }}`) in uppercase monospace tracking, providing instant cognitive recognition.

---

## 8. Whole-Pill Click Target & Multi-Line Large Notification Reading

### Frictionless Pill Tap Target
- In compact idle mode (`mode === 'compact'`), clicking **anywhere** on the Dynamic Island pill triggers the full notification preview, eliminating the micro-target friction of having to click solely on the mascot's small head.
- Internal control elements (`Settings`, `Bluetooth`) utilize event isolation (`e.stopPropagation()`) so configuration dialogs open without accidental notification expansion.

### Responsive Reader Layout for Large Notifications
- **Adaptive Container Dimensions**: The Dynamic Island smoothly expands from 410px width up to 530px width and up to 134px height based on notification payload length (`body.length > 100` / `body.length > 200`).
- **Unrestricted Multi-Line Wrapping**: Text truncation (`truncate`) is removed from notification body text; multi-sentence messages wrap naturally with `break-words whitespace-pre-wrap select-text` and custom Linear slim scrollbars for long content.
- **Dedicated Expand/Reader Mode**: For long emails or extensive chat messages, a Maximize/Minimize toggle button (`Maximize2` / `Minimize2`) expands the card to an expansive 540x168px reading canvas.
- **Hover-Aware Auto-Dismiss**: Mouse hover (`onMouseEnter`/`onMouseLeave`) pauses the auto-collapse timer indefinitely, ensuring users are never interrupted or rushed while reading long notifications.


