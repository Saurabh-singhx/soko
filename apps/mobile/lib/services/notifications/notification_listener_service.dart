import 'package:flutter/foundation.dart';
import '../../core/protocol/packet_models.dart';
import '../bluetooth/ble_service.dart';

/// Service intercepting and filtering Android notifications for desktop mirroring.
class SokoNotificationListenerService {
  final MobileBleService bleService;

  // Set of blacklisted app packages (Banking, Authenticator apps, etc.)
  final Set<String> _blacklist = {
    'com.google.android.apps.authenticator2',
    'com.duosecurity.duomobile',
    'com.chase.sig.android',
    'org.thoughtcrime.securesms',
  };

  SokoNotificationListenerService({required this.bleService});

  /// Processes an intercepted Android notification.
  Future<void> onNotificationReceived({
    required String id,
    required String packageName,
    required String appName,
    required String title,
    required String body,
    bool isOngoing = false,
  }) async {
    // 1. Skip ongoing/foreground system notifications (e.g. music, downloads)
    if (isOngoing) return;

    // 2. Filter out blacklisted apps
    if (_blacklist.contains(packageName)) return;

    // 3. Construct packet and dispatch to desktop Dynamic Island
    final payload = {
      'id': id,
      'package_name': packageName,
      'app_name': appName,
      'title': title,
      'body': body,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    };

    await bleService.sendPacket(PacketType.notificationPost, payload);
    debugPrint('[Notif Service] Mirrored notification from $appName: $title');
  }
}
