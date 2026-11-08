/**
 * AES-256-GCM Application-Layer Packet Envelope Cipher.
 * 
 * Provides end-to-end authenticated payload encryption for WebSocket & BLE conduits:
 * - 256-bit symmetric key encryption (AES-256-GCM)
 * - 96-bit (12-byte) cryptographically secure random IV generated per frame
 * - 128-bit (16-byte) authentication tag verifying ciphertext integrity
 * - Full protection against bit-flipping, truncation, tampering, and replay attacks
 */

const crypto = require('crypto');
const { CRYPTO_CONSTANTS } = require('./constants');
const { ReplayGuard } = require('./replayGuard');

class EnvelopeCipher {
  /**
   * @param {Buffer|Uint8Array|string} sessionKey - 32-byte symmetric session key
   * @param {Object} [options]
   * @param {ReplayGuard} [options.replayGuard] - Optional ReplayGuard instance
   * @param {string} [options.deviceId] - Peer device identifier for replay tracking
   */
  constructor(sessionKey, options = {}) {
    if (!sessionKey) {
      throw new Error('32-byte sessionKey is required to initialize EnvelopeCipher');
    }

    const keyBuf = Buffer.isBuffer(sessionKey)
      ? sessionKey
      : (typeof sessionKey === 'string' ? Buffer.from(sessionKey, 'hex') : Buffer.from(sessionKey));

    if (keyBuf.length !== CRYPTO_CONSTANTS.KEY_LENGTH_BYTES) {
      throw new Error(`Session key must be exactly ${CRYPTO_CONSTANTS.KEY_LENGTH_BYTES} bytes, got ${keyBuf.length}`);
    }

    this.sessionKey = keyBuf;
    this.replayGuard = options.replayGuard || new ReplayGuard();
    this.deviceId = options.deviceId || 'peer-default';
    this.outgoingSequence = 0;
  }

  /**
   * Encrypts an arbitrary JSON-serializable payload into a standardized Soko encrypted envelope.
   * 
   * @param {Object} payload - Decrypted message body (e.g. { title, body } for NOTIFICATION_POST)
   * @param {Object} [options]
   * @param {number} [options.packetId] - Explicit sequence number override
   * @param {string} [options.innerType] - Type identifier of the inner message
   * @returns {{
   *   magic: string,
   *   version: number,
   *   packet_id: number,
   *   timestamp: number,
   *   packet_type: string,
   *   nonce: string,
   *   tag: string,
   *   ciphertext: string,
   *   inner_type: string|null
   * }}
   */
  encrypt(payload, options = {}) {
    const packetId = typeof options.packetId === 'number'
      ? options.packetId
      : ++this.outgoingSequence;

    const timestamp = Date.now();
    const iv = crypto.randomBytes(CRYPTO_CONSTANTS.IV_LENGTH_BYTES);
    const innerType = options.innerType || payload.type || payload.packetType || null;

    const plaintextStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const plaintextBuf = Buffer.from(plaintextStr, 'utf8');

    const cipher = crypto.createCipheriv(CRYPTO_CONSTANTS.CIPHER_ALGORITHM, this.sessionKey, iv);
    
    // Additional Authenticated Data (AAD): bind packetId, timestamp, and innerType into authentication tag
    const aadBuf = Buffer.from(`${packetId}:${timestamp}:${innerType || ''}`, 'utf8');
    cipher.setAAD(aadBuf);

    const ciphertext = Buffer.concat([cipher.update(plaintextBuf), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      magic: CRYPTO_CONSTANTS.ENVELOPE_MAGIC,
      version: CRYPTO_CONSTANTS.ENVELOPE_VERSION,
      packet_id: packetId,
      timestamp,
      packet_type: CRYPTO_CONSTANTS.PACKET_TYPE_ENCRYPTED,
      nonce: iv.toString('base64'),
      tag: tag.toString('base64'),
      ciphertext: ciphertext.toString('base64'),
      inner_type: innerType,
    };
  }

  /**
   * Decrypts and authenticates an incoming Soko encrypted envelope.
   * 
   * @param {Object} envelope - Raw incoming wire envelope
   * @param {Object} [options]
   * @param {boolean} [options.skipReplayCheck=false] - Testing override
   * @param {string} [options.deviceId] - Specific device ID override for replay tracking
   * @returns {{
   *   packetId: number,
   *   timestamp: number,
   *   innerType: string|null,
   *   payload: any
   * }}
   */
  decrypt(envelope, options = {}) {
    if (!envelope || typeof envelope !== 'object') {
      throw new Error('Invalid envelope structure: envelope must be a non-null object');
    }

    // 1. Invariants check
    if (envelope.magic !== CRYPTO_CONSTANTS.ENVELOPE_MAGIC) {
      throw new Error(`Invalid protocol magic: expected "${CRYPTO_CONSTANTS.ENVELOPE_MAGIC}", got "${envelope.magic}"`);
    }

    if (envelope.version !== CRYPTO_CONSTANTS.ENVELOPE_VERSION) {
      throw new Error(`Unsupported protocol version: ${envelope.version}`);
    }

    if (envelope.packet_type !== CRYPTO_CONSTANTS.PACKET_TYPE_ENCRYPTED) {
      throw new Error(`Unexpected packet type: expected "${CRYPTO_CONSTANTS.PACKET_TYPE_ENCRYPTED}", got "${envelope.packet_type}"`);
    }

    const packetId = envelope.packet_id !== undefined ? envelope.packet_id : envelope.packetId;
    const timestamp = envelope.timestamp;

    // 2. Replay & clock drift check
    if (!options.skipReplayCheck && this.replayGuard) {
      const devId = options.deviceId || this.deviceId;
      const replayCheck = this.replayGuard.checkAndRecord(devId, packetId, timestamp);
      if (!replayCheck.valid) {
        throw new Error(`Replay protection rejected packet: ${replayCheck.reason}`);
      }
    }

    // 3. Extract and validate crypto fields
    if (!envelope.nonce || !envelope.tag || !envelope.ciphertext) {
      throw new Error('Malformed envelope: missing nonce, tag, or ciphertext');
    }

    const iv = Buffer.from(envelope.nonce, 'base64');
    const tag = Buffer.from(envelope.tag, 'base64');
    const ciphertext = Buffer.from(envelope.ciphertext, 'base64');

    if (iv.length !== CRYPTO_CONSTANTS.IV_LENGTH_BYTES) {
      throw new Error(`Invalid IV length: expected ${CRYPTO_CONSTANTS.IV_LENGTH_BYTES} bytes, got ${iv.length}`);
    }

    if (tag.length !== CRYPTO_CONSTANTS.AUTH_TAG_LENGTH_BYTES) {
      throw new Error(`Invalid auth tag length: expected ${CRYPTO_CONSTANTS.AUTH_TAG_LENGTH_BYTES} bytes, got ${tag.length}`);
    }

    // 4. Decrypt and verify authenticated data
    const decipher = crypto.createDecipheriv(CRYPTO_CONSTANTS.CIPHER_ALGORITHM, this.sessionKey, iv);
    decipher.setAuthTag(tag);

    const innerType = envelope.inner_type || envelope.innerType || null;
    const aadBuf = Buffer.from(`${packetId}:${timestamp}:${innerType || ''}`, 'utf8');
    decipher.setAAD(aadBuf);

    let decryptedBuf;
    try {
      decryptedBuf = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    } catch (err) {
      throw new Error(`Authenticated decryption failed: ciphertext has been tampered with or tag mismatch (${err.message})`);
    }

    // 5. Parse JSON payload
    let payload;
    const rawDecrypted = decryptedBuf.toString('utf8');
    try {
      payload = JSON.parse(rawDecrypted);
    } catch {
      payload = rawDecrypted;
    }

    return {
      packetId,
      timestamp,
      innerType,
      payload,
    };
  }
}

module.exports = { EnvelopeCipher };
