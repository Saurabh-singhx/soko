/// Dedicated Soko Universal QR Payload Parser (Dart / Flutter).
///
/// Implements Option 3 (Hybrid Universal Model):
/// - Parses Universal Web URLs (http://<ip>:8766/?pair=1&pin=...).
/// - Parses Native Soko URIs (soko://pair?host=...).
/// - Parses Wi-Fi Hotspot schemas (WIFI:S:...).
/// - Checks expiration timestamps ('exp') to prevent replay attacks.
/// - Extracts candidate fallback IPs ('alts') for multi-homed workstation networks.
library;

class ParsedQrPayload {
  final bool isValid;
  final String? host;
  final int port;
  final String? pin;
  final String? formattedPin;
  final String? certFingerprint;
  final String? workstationName;
  final bool isTls;
  final int? expiresAt;
  final bool isExpired;
  final List<String> candidateIps;
  final String? wifiSsid;
  final String? wifiPassword;
  final String? error;

  const ParsedQrPayload({
    required this.isValid,
    this.host,
    this.port = 8766,
    this.pin,
    this.formattedPin,
    this.certFingerprint,
    this.workstationName,
    this.isTls = false,
    this.expiresAt,
    this.isExpired = false,
    this.candidateIps = const [],
    this.wifiSsid,
    this.wifiPassword,
    this.error,
  });
}

class UniversalQrParser {
  /// Parses raw scanned text into structured pairing parameters.
  static ParsedQrPayload parse(String? raw) {
    if (raw == null || raw.trim().isEmpty) {
      return const ParsedQrPayload(
        isValid: false,
        error: 'Empty QR payload',
      );
    }

    final trimmed = raw.trim();
    final nowSec = DateTime.now().millisecondsSinceEpoch ~/ 1000;

    // 1. Check for raw numeric PIN (e.g. "482 195" or "482195")
    final pinRegex = RegExp(r'^(\d{3})\s?(\d{3})$');
    final pinMatch = pinRegex.firstMatch(trimmed);
    if (pinMatch != null) {
      final clean = '${pinMatch.group(1)}${pinMatch.group(2)}';
      return ParsedQrPayload(
        isValid: true,
        pin: clean,
        formattedPin: '${clean.substring(0, 3)} ${clean.substring(3, 6)}',
      );
    }

    // 2. Check for Wi-Fi Hotspot configuration
    if (trimmed.startsWith('WIFI:')) {
      final ssidMatch = RegExp(r'S:((?:\\;|[^;])+);').firstMatch(trimmed);
      final passMatch = RegExp(r'P:((?:\\;|[^;])*);').firstMatch(trimmed);

      if (ssidMatch != null) {
        final ssid = ssidMatch.group(1)?.replaceAll(r'\;', ';').replaceAll(r'\:', ':') ?? '';
        final pass = passMatch?.group(1)?.replaceAll(r'\;', ';').replaceAll(r'\:', ':') ?? '';
        return ParsedQrPayload(
          isValid: true,
          wifiSsid: ssid,
          wifiPassword: pass,
        );
      }
    }

    // 3. Check for Universal Web URL or Native Soko URI
    try {
      Uri uri;
      if (trimmed.startsWith('soko://pair')) {
        uri = Uri.parse(trimmed);
      } else if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        uri = Uri.parse(trimmed);
      } else if (trimmed.contains('pin=') || trimmed.contains('pair=')) {
        uri = Uri.parse('http://dummy/?${trimmed.startsWith('?') ? trimmed.substring(1) : trimmed}');
      } else {
        return const ParsedQrPayload(
          isValid: false,
          error: 'Unrecognized pairing schema',
        );
      }

      final params = uri.queryParameters;
      String? host = params['host'];
      if (host == null || host.isEmpty) {
        if (uri.host.isNotEmpty && uri.host != 'dummy') {
          host = uri.host;
        }
      }

      int port = 8766;
      if (params.containsKey('port')) {
        port = int.tryParse(params['port']!) ?? 8766;
      } else if (uri.port != 0 && uri.port != 80 && uri.port != 443) {
        port = uri.port;
      }

      final rawPin = params['pin'];
      final cleanPin = rawPin?.replaceAll(RegExp(r'\D'), '');
      if (cleanPin == null || cleanPin.length != 6) {
        return const ParsedQrPayload(
          isValid: false,
          error: 'Invalid or missing 6-digit PIN',
        );
      }

      final formattedPin = '${cleanPin.substring(0, 3)} ${cleanPin.substring(3, 6)}';
      final fp = params['fp'] ?? params['fingerprint'];
      final name = params['name'] != null ? Uri.decodeComponent(params['name']!) : null;
      final isTls = params['tls'] == '1' || uri.scheme == 'https';

      int? exp;
      bool isExpired = false;
      if (params.containsKey('exp')) {
        exp = int.tryParse(params['exp']!);
        if (exp != null && exp > 0) {
          isExpired = (nowSec - 30) > exp; // 30s clock-skew tolerance
        }
      }

      final altsList = <String>[];
      if (params.containsKey('alts') && params['alts']!.isNotEmpty) {
        altsList.addAll(params['alts']!.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty));
      }

      final candidateIps = <String>[];
      if (host != null && host.isNotEmpty) candidateIps.add(host);
      for (final alt in altsList) {
        if (!candidateIps.contains(alt)) candidateIps.add(alt);
      }

      return ParsedQrPayload(
        isValid: !isExpired,
        host: host,
        port: port,
        pin: cleanPin,
        formattedPin: formattedPin,
        certFingerprint: fp,
        workstationName: name,
        isTls: isTls,
        expiresAt: exp,
        isExpired: isExpired,
        candidateIps: candidateIps,
        error: isExpired ? 'Pairing QR code has expired' : null,
      );
    } catch (e) {
      return ParsedQrPayload(
        isValid: false,
        error: 'Failed to parse URI: $e',
      );
    }
  }
}
