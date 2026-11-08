/**
 * @file sokoCrypto.js
 * Soko Mobile Companion Web Crypto Subsystem.
 * 
 * Implements client-side AES-256-GCM encryption/decryption, monotonic sequence tracking,
 * and ephemeral key derivation using the native browser/WebView Web Crypto API (SubtleCrypto).
 */

(function (window) {
  'use strict';

  let activeSessionKey = null;
  let activeReplaySequence = 0;
  const seenPacketIds = new Set();
  const MAX_DRIFT_MS = 60 * 1000;

  function bufferToBase64(buf) {
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  function base64ToBuffer(b64) {
    const binary = window.atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  function hexToBytes(hex) {
    const clean = hex.replace(/[^0-9A-Fa-f]/g, '');
    const bytes = new Uint8Array(clean.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
    }
    return bytes;
  }

  const SokoCrypto = {
    isSupported() {
      return Boolean(window.crypto && window.crypto.subtle);
    },

    /**
     * Initializes or imports an active 32-byte symmetric session key.
     * @param {string|Uint8Array|ArrayBuffer} rawKey - Hex string or raw bytes
     */
    async setSessionKey(rawKey) {
      if (!this.isSupported()) return false;
      try {
        let keyBytes;
        if (typeof rawKey === 'string') {
          keyBytes = hexToBytes(rawKey);
        } else if (rawKey instanceof ArrayBuffer) {
          keyBytes = new Uint8Array(rawKey);
        } else {
          keyBytes = rawKey;
        }

        activeSessionKey = await window.crypto.subtle.importKey(
          'raw',
          keyBytes,
          { name: 'AES-GCM' },
          false,
          ['encrypt', 'decrypt']
        );
        return true;
      } catch (err) {
        console.warn('[SokoCrypto] Failed importing session key:', err);
        return false;
      }
    },

    clearSessionKey() {
      activeSessionKey = null;
      seenPacketIds.clear();
      activeReplaySequence = 0;
    },

    hasActiveSession() {
      return Boolean(activeSessionKey);
    },

    /**
     * Encrypts a payload object into an authenticated Soko SK envelope.
     * @param {Object} payload
     * @param {string} [innerType]
     * @returns {Promise<Object>}
     */
    async encryptPayload(payload, innerType = null) {
      if (!activeSessionKey) {
        throw new Error('Cannot encrypt payload: No active session key established');
      }

      const packetId = ++activeReplaySequence;
      const timestamp = Date.now();
      const resolvedInnerType = innerType || payload.type || payload.packetType || null;

      // 12-byte CSPRNG IV
      const iv = new Uint8Array(12);
      window.crypto.getRandomValues(iv);

      // Additional Authenticated Data (AAD)
      const aad = new TextEncoder().encode(`${packetId}:${timestamp}:${resolvedInnerType || ''}`);
      const plaintextBuf = new TextEncoder().encode(JSON.stringify(payload));

      const encryptedFull = await window.crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv,
          additionalData: aad,
          tagLength: 128,
        },
        activeSessionKey,
        plaintextBuf
      );

      const encryptedBytes = new Uint8Array(encryptedFull);
      const ctBytes = encryptedBytes.slice(0, encryptedBytes.length - 16);
      const tagBytes = encryptedBytes.slice(encryptedBytes.length - 16);

      return {
        magic: 'SK',
        version: 1,
        packet_id: packetId,
        timestamp,
        packet_type: 'ENCRYPTED_PACKET',
        nonce: bufferToBase64(iv),
        tag: bufferToBase64(tagBytes),
        ciphertext: bufferToBase64(ctBytes),
        inner_type: resolvedInnerType,
      };
    },

    /**
     * Decrypts an incoming authenticated Soko SK envelope.
     * @param {Object} envelope
     * @returns {Promise<{ packetId: number, timestamp: number, innerType: string|null, payload: any }>}
     */
    async decryptEnvelope(envelope) {
      if (!activeSessionKey) {
        throw new Error('Cannot decrypt envelope: No active session key established');
      }

      if (envelope.magic !== 'SK' || envelope.packet_type !== 'ENCRYPTED_PACKET') {
        throw new Error('Invalid envelope format');
      }

      const packetId = envelope.packet_id !== undefined ? envelope.packet_id : envelope.packetId;
      const timestamp = envelope.timestamp;

      // Replay drift check
      const drift = Math.abs(Date.now() - timestamp);
      if (drift > MAX_DRIFT_MS) {
        throw new Error(`Packet timestamp drift exceeded limit: ${drift}ms`);
      }

      // Replay duplicate check
      if (seenPacketIds.has(packetId)) {
        throw new Error(`Duplicate packet replay detected: ID ${packetId}`);
      }
      seenPacketIds.add(packetId);

      const iv = new Uint8Array(base64ToBuffer(envelope.nonce));
      const tag = new Uint8Array(base64ToBuffer(envelope.tag));
      const ct = new Uint8Array(base64ToBuffer(envelope.ciphertext));

      // In Web Crypto API, the auth tag must be concatenated to the ciphertext
      const full = new Uint8Array(ct.length + tag.length);
      full.set(ct, 0);
      full.set(tag, ct.length);

      const innerType = envelope.inner_type || envelope.innerType || null;
      const aad = new TextEncoder().encode(`${packetId}:${timestamp}:${innerType || ''}`);

      const decryptedBuf = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv,
          additionalData: aad,
          tagLength: 128,
        },
        activeSessionKey,
        full
      );

      const rawJson = new TextDecoder().decode(decryptedBuf);
      let payload;
      try {
        payload = JSON.parse(rawJson);
      } catch {
        payload = rawJson;
      }

      return {
        packetId,
        timestamp,
        innerType,
        payload,
      };
    },
  };

  window.SokoCrypto = SokoCrypto;
})(typeof window !== 'undefined' ? window : globalThis);
