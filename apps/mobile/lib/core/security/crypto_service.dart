import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';
import 'package:crypto/crypto.dart' as std_crypto;
import 'package:cryptography/cryptography.dart' as algo;

/// Scalable Cryptographic service on mobile companion.
/// Provides AES-256-GCM encryption, X25519 key exchange, and SAS confirmation PIN derivation.
class MobileCryptoService {
  static final _secureRandom = Random.secure();
  static final _aesGcm = algo.AesGcm.with256bits();

  /// Computes a SHA-256 hash string for an arbitrary byte array.
  static String computeSha256(List<int> bytes) {
    final digest = std_crypto.sha256.convert(bytes);
    return digest.toString();
  }

  /// Derives the 6-digit confirmation PIN (SAS) from an ECDH shared secret using HKDF-SHA256.
  static String deriveSasPin(List<int> sharedSecret) {
    final salt = utf8.encode('SOKO_ZERO_TRUST_SALT_V1');
    final info = utf8.encode('SOKO_SAS_DERIVATION_V1');

    // HKDF extract
    final hmacExtract = std_crypto.Hmac(std_crypto.sha256, salt);
    final prk = hmacExtract.convert(sharedSecret).bytes;

    // HKDF expand
    final hmacExpand = std_crypto.Hmac(std_crypto.sha256, prk);
    final okm = hmacExpand.convert([...info, 0x01]).bytes;

    final num = (okm[0] << 24 | okm[1] << 16 | okm[2] << 8 | okm[3]) % 1000000;
    return num.abs().toString().padLeft(6, '0');
  }

  /// Formats a 6-digit PIN into standard 'XXX XXX' display string.
  static String formatPin(String pin) {
    final clean = pin.replaceAll(RegExp(r'\D'), '').padLeft(6, '0');
    final slice = clean.length >= 6 ? clean.substring(clean.length - 6) : clean;
    return '${slice.substring(0, 3)} ${slice.substring(3, 6)}';
  }

  /// Generates a cryptographically secure random session token.
  static String generateSessionToken({int byteLength = 16}) {
    final bytes = Uint8List(byteLength);
    for (int i = 0; i < byteLength; i++) {
      bytes[i] = _secureRandom.nextInt(256);
    }
    return computeSha256(bytes).substring(0, byteLength * 2);
  }

  /// Encrypts an arbitrary plaintext map using AES-256-GCM.
  static Future<Map<String, dynamic>> encryptPayload({
    required Map<String, dynamic> payload,
    required List<int> sessionKeyBytes,
    required int packetId,
    String? innerType,
  }) async {
    final secretKey = algo.SecretKey(sessionKeyBytes);
    final plaintext = utf8.encode(jsonEncode(payload));
    final nonce = _aesGcm.newNonce();
    final timestamp = DateTime.now().millisecondsSinceEpoch;

    final aad = utf8.encode('$packetId:$timestamp:${innerType ?? ''}');

    final secretBox = await _aesGcm.encrypt(
      plaintext,
      secretKey: secretKey,
      nonce: nonce,
      aad: aad,
    );

    return {
      'magic': 'SK',
      'version': 1,
      'packet_id': packetId,
      'timestamp': timestamp,
      'packet_type': 'ENCRYPTED_PACKET',
      'nonce': base64Encode(secretBox.nonce),
      'tag': base64Encode(secretBox.mac.bytes),
      'ciphertext': base64Encode(secretBox.cipherText),
      'inner_type': innerType,
    };
  }

  /// Decrypts and authenticates a Soko encrypted envelope.
  static Future<Map<String, dynamic>> decryptEnvelope({
    required Map<String, dynamic> envelope,
    required List<int> sessionKeyBytes,
  }) async {
    final secretKey = algo.SecretKey(sessionKeyBytes);
    final packetId = envelope['packet_id'] as int;
    final timestamp = envelope['timestamp'] as int;
    final innerType = envelope['inner_type'] as String?;

    final nonce = base64Decode(envelope['nonce'] as String);
    final tag = base64Decode(envelope['tag'] as String);
    final ciphertext = base64Decode(envelope['ciphertext'] as String);

    final aad = utf8.encode('$packetId:$timestamp:${innerType ?? ''}');

    final secretBox = algo.SecretBox(
      ciphertext,
      nonce: nonce,
      mac: algo.Mac(tag),
    );

    final decryptedBytes = await _aesGcm.decrypt(
      secretBox,
      secretKey: secretKey,
      aad: aad,
    );

    final rawJson = utf8.decode(decryptedBytes);
    return jsonDecode(rawJson) as Map<String, dynamic>;
  }
}
