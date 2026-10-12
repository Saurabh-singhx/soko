import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import '../../core/protocol/packet_models.dart';

/// Bluetooth connection states on mobile.
enum MobileBleStatus {
  disconnected,
  scanning,
  connecting,
  connected,
}

/// Mobile Bluetooth Low Energy Service.
class MobileBleService extends ChangeNotifier {
  MobileBleStatus _status = MobileBleStatus.disconnected;
  MobileBleStatus get status => _status;

  String? _connectedDeviceName;
  String? get connectedDeviceName => _connectedDeviceName;

  int _outgoingSeq = 1;
  final StreamController<SokoEnvelope> _inboundController =
      StreamController<SokoEnvelope>.broadcast();
  Stream<SokoEnvelope> get inboundStream => _inboundController.stream;

  /// Simulates / triggers device scanning.
  Future<void> startScan() async {
    _status = MobileBleStatus.scanning;
    notifyListeners();

    // In actual production: uses flutter_blue_plus to scan for SOKO_SERVICE_UUID
    await Future.delayed(const Duration(seconds: 1));
    _status = MobileBleStatus.connecting;
    notifyListeners();

    await Future.delayed(const Duration(milliseconds: 800));
    _status = MobileBleStatus.connected;
    _connectedDeviceName = "Saurabh's Linux Desktop";
    notifyListeners();
  }

  /// Disconnects from the current desktop companion.
  Future<void> disconnect() async {
    _status = MobileBleStatus.disconnected;
    _connectedDeviceName = null;
    notifyListeners();
  }

  /// Sends an application packet envelope over the BLE connection.
  Future<void> sendPacket(PacketType type, Map<String, dynamic> payload) async {
    if (_status != MobileBleStatus.connected) {
      debugPrint('[BLE] Cannot send packet: not connected.');
      return;
    }

    final envelope = SokoEnvelope(
      packetId: _outgoingSeq++,
      timestamp: DateTime.now().millisecondsSinceEpoch,
      packetType: type,
      payload: payload,
    );

    final rawJson = envelope.toSerializedJson();
    debugPrint('[BLE TX] Dispatched ${envelope.packetType.toWireString()} (#${envelope.packetId})');

    // In production: writes to GATT characteristic using flutter_blue_plus
  }

  @override
  void dispose() {
    _inboundController.close();
    super.dispose();
  }
}
