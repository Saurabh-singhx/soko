/**
 * SHA-256 Certificate Fingerprint Utilities for Zero-Trust Pinning.
 * 
 * Provides:
 * - SHA-256 fingerprint extraction from X.509 PEM or DER buffers
 * - Standardized format output: 'SHA256:XX:XX:...'
 * - Constant-time fingerprint verification against MITM attacks
 */

const crypto = require('crypto');

class CertFingerprint {
  /**
   * Computes a standardized SHA-256 fingerprint from an X.509 PEM string or DER buffer.
   * 
   * @param {string|Buffer} cert - PEM string or DER certificate buffer
   * @returns {string} Formatted fingerprint 'SHA256:XX:XX:...'
   */
  static compute(cert) {
    if (!cert) {
      throw new Error('Certificate data is required to compute fingerprint');
    }

    let der;
    if (typeof cert === 'string') {
      try {
        const x509 = new crypto.X509Certificate(cert);
        const hex = x509.fingerprint256.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
        return `SHA256:${hex.match(/.{2}/g).join(':')}`;
      } catch {
        // Strip PEM armor and parse base64 DER
        const b64 = cert
          .replace(/-----BEGIN CERTIFICATE-----/g, '')
          .replace(/-----END CERTIFICATE-----/g, '')
          .replace(/\s+/g, '');
        der = Buffer.from(b64, 'base64');
      }
    } else if (Buffer.isBuffer(cert)) {
      der = cert;
    } else {
      der = Buffer.from(cert);
    }

    const hash = crypto.createHash('sha256').update(der).digest('hex').toUpperCase();
    return `SHA256:${hash.match(/.{2}/g).join(':')}`;
  }

  /**
   * Normalizes a fingerprint string for comparison (strips prefixes and colons).
   * @param {string} fp
   * @returns {string}
   */
  static normalize(fp) {
    if (!fp) return '';
    return String(fp).replace(/^SHA256:/i, '').replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
  }

  /**
   * Constant-time comparison between presenting certificate and pinned fingerprint.
   * 
   * @param {string} actualFingerprint
   * @param {string} pinnedFingerprint
   * @returns {boolean}
   */
  static verifyConstantTime(actualFingerprint, pinnedFingerprint) {
    const a = CertFingerprint.normalize(actualFingerprint);
    const p = CertFingerprint.normalize(pinnedFingerprint);

    if (!a || !p || a.length !== 64 || p.length !== 64) {
      return false;
    }

    return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(p, 'utf8'));
  }
}

module.exports = { CertFingerprint };
