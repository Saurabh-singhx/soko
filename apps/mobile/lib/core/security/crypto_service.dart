import 'dart:convert';
import 'dart:typed_data';
import 'package:crypto/crypto.dart';

/// Cryptographic service on mobile.
class MobileCryptoService {
  /// Computes a SHA-256 hash string for an arbitrary byte array.
  static String computeSha256(List<int> bytes) {
    final digest = sha256.convert(bytes);
    return digest.toString();
  }

  /// Derives the 6-digit confirmation PIN (SAS) from an ECDH shared secret.
  static String deriveSasPin(List<int> sharedSecret) {
    final prefix = utf8.encode('SOKO_SAS_DERIVATION_V1');
    final combined = Uint8List.fromList([...prefix, ...sharedSecret]);
    final hash = sha256.convert(combined).bytes;

    final num = (hash[0] << 24 | hash[1] << 16 | hash[2] << 8 | hash[3]) % 1000000;
    return num.abs().toString().padLeft(6, '0');
  }

  /// Generates a cryptographic nonce string for one-time download URLs.
  static String generateSessionToken() {
    final randomBytes = List<int>.generate(16, (i) => (DateTime.now().microsecondsSinceEpoch * (i + 1)) % 256);
    return sha256.convert(randomBytes).toString().substring(0, 16);
  }
}
