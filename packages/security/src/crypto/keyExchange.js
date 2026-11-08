/**
 * Ephemeral Diffie-Hellman Key Exchange & Key Derivation Subsystem.
 * 
 * Supports:
 * - X25519 (RFC 7748) modern high-speed curve
 * - P-256 (prime256v1 / SECP256R1) universal fallback for legacy Android WebViews
 * - HKDF-SHA256 (RFC 5869) key derivation with domain separation
 * - Safe export/import of public keys (SPKI DER & raw uncompressed format)
 */

const crypto = require('crypto');
const { CRYPTO_CONSTANTS } = require('./constants');
const { SasPin } = require('./sasPin');

class KeyExchange {
  /**
   * Generates an ephemeral keypair for an in-flight handshake session.
   * 
   * @param {'x25519'|'prime256v1'} [curve='x25519']
   * @returns {{
   *   curve: string,
   *   privateKey: crypto.KeyObject,
   *   publicKey: crypto.KeyObject,
   *   publicKeyDer: Buffer,
   *   publicKeyBase64: string,
   *   publicKeyHex: string
   * }}
   */
  static generateEphemeralKeypair(curve = CRYPTO_CONSTANTS.DEFAULT_CURVE) {
    let keypair;
    const selectedCurve = curve.toLowerCase() === 'prime256v1' || curve.toLowerCase() === 'p-256'
      ? 'prime256v1'
      : 'x25519';

    if (selectedCurve === 'prime256v1') {
      keypair = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    } else {
      keypair = crypto.generateKeyPairSync('x25519');
    }

    const publicKeyDer = keypair.publicKey.export({ type: 'spki', format: 'der' });

    return {
      curve: selectedCurve,
      privateKey: keypair.privateKey,
      publicKey: keypair.publicKey,
      publicKeyDer,
      publicKeyBase64: publicKeyDer.toString('base64'),
      publicKeyHex: publicKeyDer.toString('hex'),
    };
  }

  /**
   * Imports a remote peer's public key from DER (buffer or base64).
   * 
   * @param {Buffer|string} peerPublicKeyDer
   * @returns {crypto.KeyObject}
   */
  static importPeerPublicKey(peerPublicKeyDer) {
    const buf = typeof peerPublicKeyDer === 'string'
      ? Buffer.from(peerPublicKeyDer, 'base64')
      : peerPublicKeyDer;

    return crypto.createPublicKey({
      key: buf,
      format: 'der',
      type: 'spki',
    });
  }

  /**
   * Computes the Diffie-Hellman shared secret between local private key and remote public key.
   * 
   * @param {crypto.KeyObject} localPrivateKey
   * @param {crypto.KeyObject|Buffer|string} peerPublicKey
   * @returns {Buffer} 32-byte raw shared secret
   */
  static computeSharedSecret(localPrivateKey, peerPublicKey) {
    const peerKeyObj = (peerPublicKey instanceof crypto.KeyObject)
      ? peerPublicKey
      : KeyExchange.importPeerPublicKey(peerPublicKey);

    return crypto.diffieHellman({
      privateKey: localPrivateKey,
      publicKey: peerKeyObj,
    });
  }

  /**
   * Derives a 32-byte AES-256-GCM symmetric session key from a shared secret via HKDF-SHA256.
   * 
   * @param {Buffer} sharedSecret
   * @param {Object} [options]
   * @param {string} [options.salt] - Optional salt (e.g. SAS PIN or session nonce)
   * @param {string} [options.info] - HKDF domain separation info string
   * @returns {Buffer} 32-byte symmetric key
   */
  static deriveSessionKey(sharedSecret, options = {}) {
    const saltStr = options.salt || CRYPTO_CONSTANTS.HKDF_SALT;
    const infoStr = options.info || CRYPTO_CONSTANTS.HKDF_INFO_SESSION;

    const saltBuf = Buffer.from(saltStr, 'utf8');
    const infoBuf = Buffer.from(infoStr, 'utf8');

    const derived = crypto.hkdfSync(
      'sha256',
      sharedSecret,
      saltBuf,
      infoBuf,
      CRYPTO_CONSTANTS.KEY_LENGTH_BYTES
    );

    return Buffer.from(derived);
  }

  /**
   * Convenience helper to derive both the SAS PIN and the Session Key from a shared secret.
   * 
   * @param {Buffer} sharedSecret
   * @param {Object} [options]
   * @returns {{ sessionKey: Buffer, sasPin: string, formattedPin: string }}
   */
  static deriveSessionArtifacts(sharedSecret, options = {}) {
    const sasPin = SasPin.derive(sharedSecret);
    const sessionKey = KeyExchange.deriveSessionKey(sharedSecret, {
      salt: options.mixPinInKey ? `${CRYPTO_CONSTANTS.HKDF_SALT}:${sasPin}` : undefined,
      ...options,
    });

    return {
      sessionKey,
      sasPin,
      formattedPin: SasPin.format(sasPin),
    };
  }
}

module.exports = { KeyExchange };
