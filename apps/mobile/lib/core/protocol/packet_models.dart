import 'dart:convert';

/// High-level packet types recognized by the Soko protocol.
enum PacketType {
  heartbeatPing,
  heartbeatPong,
  pairRequest,
  pairConfirm,
  notificationPost,
  notificationDismiss,
  cliExecute,
  cliOutputStream,
  cliTerminated,
  fileOffer,
  fileProgress,
  fileCompleted,
}

extension PacketTypeExtension on PacketType {
  String toWireString() {
    switch (this) {
      case PacketType.heartbeatPing:
        return 'HEARTBEAT_PING';
      case PacketType.heartbeatPong:
        return 'HEARTBEAT_PONG';
      case PacketType.pairRequest:
        return 'PAIR_REQUEST';
      case PacketType.pairConfirm:
        return 'PAIR_CONFIRM';
      case PacketType.notificationPost:
        return 'NOTIFICATION_POST';
      case PacketType.notificationDismiss:
        return 'NOTIFICATION_DISMISS';
      case PacketType.cliExecute:
        return 'CLI_EXECUTE';
      case PacketType.cliOutputStream:
        return 'CLI_OUTPUT_STREAM';
      case PacketType.cliTerminated:
        return 'CLI_TERMINATED';
      case PacketType.fileOffer:
        return 'FILE_OFFER';
      case PacketType.fileProgress:
        return 'FILE_PROGRESS';
      case PacketType.fileCompleted:
        return 'FILE_COMPLETED';
    }
  }

  static PacketType fromWireString(String val) {
    return PacketType.values.firstWhere(
      (e) => e.toWireString() == val,
      orElse: () => PacketType.heartbeatPing,
    );
  }
}

/// Standardized envelope model matching SokoPacketEnvelope schema.
class SokoEnvelope {
  final String magic;
  final int version;
  final int packetId;
  final int timestamp;
  final PacketType packetType;
  final Map<String, dynamic> payload;

  SokoEnvelope({
    this.magic = 'SK',
    this.version = 1,
    required this.packetId,
    required this.timestamp,
    required this.packetType,
    required this.payload,
  });

  Map<String, dynamic> toJson() => {
        'magic': magic,
        'version': version,
        'packet_id': packetId,
        'timestamp': timestamp,
        'packet_type': packetType.toWireString(),
        'payload': payload,
      };

  factory SokoEnvelope.fromJson(Map<String, dynamic> json) {
    return SokoEnvelope(
      magic: json['magic'] as String? ?? 'SK',
      version: json['version'] as int? ?? 1,
      packetId: json['packet_id'] as int? ?? 0,
      timestamp: json['timestamp'] as int? ?? 0,
      packetType: PacketTypeExtension.fromWireString(json['packet_type'] as String? ?? ''),
      payload: json['payload'] as Map<String, dynamic>? ?? {},
    );
  }

  String toSerializedJson() => jsonEncode(toJson());
}

/// Payload model for high-speed file transfers (APKs, images).
class FileTransferOffer {
  final String transferId;
  final String filename;
  final int sizeBytes;
  final String downloadUrl;
  final String sha256;
  final String mimeType;

  FileTransferOffer({
    required this.transferId,
    required this.filename,
    required this.sizeBytes,
    required this.downloadUrl,
    required this.sha256,
    this.mimeType = 'application/vnd.android.package-archive',
  });

  Map<String, dynamic> toJson() => {
        'transfer_id': transferId,
        'filename': filename,
        'size_bytes': sizeBytes,
        'download_url': downloadUrl,
        'sha256': sha256,
        'mime_type': mimeType,
      };
}

/// Payload model for remote CLI agent triggers.
class CliExecutePayload {
  final String commandId;
  final String requestId;
  final List<String>? customArgs;
  final String? biometricToken;

  CliExecutePayload({
    required this.commandId,
    required this.requestId,
    this.customArgs,
    this.biometricToken,
  });

  Map<String, dynamic> toJson() => {
        'command_id': commandId,
        'request_id': requestId,
        if (customArgs != null) 'custom_args': customArgs,
        if (biometricToken != null) 'biometric_token': biometricToken,
      };
}
