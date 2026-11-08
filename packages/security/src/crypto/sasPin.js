/**
 * Short Authentication String (SAS) Derivation & Constant-Time Verification.
 * 
 * Implements bank-grade visual pairing confirmation:
 * - Computes a 6-digit PIN from an ECDH shared secret using HKDF-SHA256
 * - Formats the PIN for human ergonomics ('482 195')
 * - Performs constant-time verification using crypto.timingSafeEqual to prevent side-channel attacks
 */

const crypto = require('crypto');
const { CRYPTO_CONSTANTS } = require('./constants');

class SasPin {
  /**
   * Derives a 6-digit SAS confirmation PIN from an ECDH shared secret.
   * 
   * @param {Buffer|Uint8Array} sharedSecret - Raw ECDH shared secret bytes
   * @returns {string} 6-digit zero-padded PIN string (e.g. '048219')
   */
  static derive(sharedSecret) {
    if (!sharedSecret || !(sharedSecret instanceof Uint8Array || Buffer.isBuffer(sharedSecret))) {
      throw new Error('Valid shared secret buffer is required to derive SAS PIN');
    }

    const secretBuf = Buffer.isBuffer(sharedSecret) ? sharedSecret : Buffer.from(sharedSecret);
    const salt = Buffer.from(CRYPTO_CONSTANTS.HKDF_SALT, 'utf8');
    const info = Buffer.from(CRYPTO_CONSTANTS.HKDF_INFO_SAS, 'utf8');

    // Derive 4 bytes via HKDF-SHA256
    const derived = Buffer.from(crypto.hkdfSync('sha256', secretBuf, salt, info, 4));
    const num = derived.readUInt32BE(0) % CRYPTO_CONSTANTS.SAS_PIN_MODULUS;
    return String(num).padStart(CRYPTO_CONSTANTS.SAS_PIN_LENGTH, '0');
  }

  /**
   * Formats a 6-digit PIN with a space separator for display on the Dynamic Island HUD.
   * @param {string} pin
   * @returns {string} e.g. '482 195'
   */
  static format(pin) {
    const clean = String(pin || '').replace(/\D/g, '').padStart(6, '0').slice(-6);
    return `${clean.slice(0, 3)} ${clean.slice(3, 6)}`;
  }

  /**
   * Verifies an entered PIN against the expected PIN in constant time.
   * Defends against timing side-channel attacks.
   * 
   * @param {string} enteredPin
   * @param {string} expectedPin
   * @returns {boolean}
   */
  static verifyConstantTime(enteredPin, expectedPin) {
    const cleanEntered = String(enteredPin || '').replace(/\D/g, '').padStart(6, '0').slice(-6);
    const cleanExpected = String(expectedPin || '').replace(/\D/g, '').padStart(6, '0').slice(-6);

    const bufEntered = Buffer.from(cleanEntered, 'utf8');
    const bufExpected = Buffer.from(cleanExpected, 'utf8');

    if (bufEntered.length !== bufExpected.length) {
      return false;
    }

    return crypto.timingSafeEqual(bufEntered, bufExpected);
  }
}

module.exports = { SasPin };
