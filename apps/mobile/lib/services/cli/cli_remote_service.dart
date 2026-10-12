import 'package:flutter/foundation.dart';
import '../../core/protocol/packet_models.dart';
import '../bluetooth/ble_service.dart';

/// Service managing remote CLI execution requests.
class CliRemoteService {
  final MobileBleService bleService;

  CliRemoteService({required this.bleService});

  /// Dispatches a whitelisted CLI command execution request to Desktop.
  Future<void> executeCommand({
    required String commandId,
    List<String>? customArgs,
    bool requiresBiometrics = false,
  }) async {
    // 1. If biometric confirmation is required, perform local authentication
    if (requiresBiometrics) {
      debugPrint('[CLI Service] Prompting for local biometric authentication...');
      // In production: local_auth.authenticate(localizedReason: 'Authenticate to run $commandId');
    }

    final requestId = 'req-${DateTime.now().millisecondsSinceEpoch}';

    final payload = CliExecutePayload(
      commandId: commandId,
      requestId: requestId,
      customArgs: customArgs,
      biometricToken: requiresBiometrics ? 'biometric_valid_token' : null,
    );

    await bleService.sendPacket(PacketType.cliExecute, payload.toJson());
    debugPrint('[CLI Service] Sent command trigger: $commandId ($requestId)');
  }
}
