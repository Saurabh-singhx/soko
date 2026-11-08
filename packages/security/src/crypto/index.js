/**
 * @file packages/security/src/crypto/index.js
 * Soko Modular Cryptographic Subsystem.
 * 
 * Scalable facade organizing all cryptographic primitives:
 * - Constants & Invariants
 * - Ephemeral Key Exchange (X25519 & P-256)
 * - AES-256-GCM Envelope Cipher
 * - SAS 6-digit confirmation PIN derivation & timing-safe verification
 * - SHA-256 TLS Certificate Fingerprinting
 * - Monotonic Replay Protection Guard
 */

const { CRYPTO_CONSTANTS } = require('./constants');
const { ReplayGuard } = require('./replayGuard');
const { SasPin } = require('./sasPin');
const { CertFingerprint } = require('./certFingerprint');
const { KeyExchange } = require('./keyExchange');
const { EnvelopeCipher } = require('./envelopeCipher');

module.exports = {
  CRYPTO_CONSTANTS,
  ReplayGuard,
  SasPin,
  CertFingerprint,
  KeyExchange,
  EnvelopeCipher,
};
