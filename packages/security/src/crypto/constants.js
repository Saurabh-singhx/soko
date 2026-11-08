/**
 * Cryptographic Constants and Invariants for Soko Protocol.
 * 
 * Defines standard algorithms, key lengths, nonce sizes, and zero-trust parameters
 * for communication between Desktop Dynamic Island and Mobile Companion APK.
 */

const CRYPTO_CONSTANTS = {
  // Cipher specifications
  CIPHER_ALGORITHM: 'aes-256-gcm',
  KEY_LENGTH_BYTES: 32,         // 256 bits
  IV_LENGTH_BYTES: 12,          // 96 bits for AES-GCM
  AUTH_TAG_LENGTH_BYTES: 16,    // 128 bits authentication tag

  // Key exchange curves
  DEFAULT_CURVE: 'x25519',
  FALLBACK_CURVE: 'prime256v1', // P-256 for older Android WebViews

  // HKDF domain-separation info strings
  HKDF_SALT: 'SOKO_ZERO_TRUST_SALT_V1',
  HKDF_INFO_SESSION: 'SOKO_SESSION_KEY_V1',
  HKDF_INFO_SAS: 'SOKO_SAS_DERIVATION_V1',
  HKDF_INFO_STORAGE: 'SOKO_LOCAL_STORAGE_KEY_V1',

  // Replay protection & timestamp bounds
  MAX_TIMESTAMP_DRIFT_MS: 60 * 1000, // 60 seconds maximum allowed clock drift
  REPLAY_WINDOW_CAPACITY: 1024,      // Sliding window capacity for packet sequence IDs

  // SAS Short Authentication String PIN bounds
  SAS_PIN_LENGTH: 6,
  SAS_PIN_MODULUS: 1000000,          // 6-digit PIN space (000000 - 999999)

  // Packet protocol wire tags
  ENVELOPE_MAGIC: 'SK',
  ENVELOPE_VERSION: 1,
  PACKET_TYPE_ENCRYPTED: 'ENCRYPTED_PACKET',
  PACKET_TYPE_PAIR_INIT: 'PAIR_INIT',
  PACKET_TYPE_PAIR_RESP: 'PAIR_RESP',
};

module.exports = { CRYPTO_CONSTANTS };
