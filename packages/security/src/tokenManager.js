/**
 * Bearer Token Lifecycle & Rotation Engine.
 * 
 * Implements:
 * - 30-Day TTL (Time-To-Live) for bearer authentication tokens
 * - Automated Refresh Token rotation cycle
 * - Zero-downtime token renewal endpoint (/api/auth/refresh)
 * - Complete session revocation ("Revoke All Sessions")
 */

const crypto = require('crypto');
const { DEFAULT_TOKEN_TTL_MS } = require('./config');

class TokenManager {
  /**
   * @param {import('./trustStore').TrustStore} trustStore
   * @param {Object} [options]
   * @param {number} [options.tokenTtlMs]
   */
  constructor(trustStore, options = {}) {
    this.trustStore = trustStore;
    this.tokenTtlMs = options.tokenTtlMs || DEFAULT_TOKEN_TTL_MS;
  }

  /**
   * Generates a pair of cryptographically secure bearer token & refresh token.
   * @returns {{ token: string, refreshToken: string, createdAt: number, expiresAt: number }}
   */
  createTokenPair() {
    const now = Date.now();
    return {
      token: crypto.randomBytes(16).toString('hex'),
      refreshToken: crypto.randomBytes(16).toString('hex'),
      createdAt: now,
      expiresAt: now + this.tokenTtlMs,
    };
  }

  /**
   * Validates a bearer token. Checks presence and expiration.
   * @param {string} token
   * @returns {{ valid: boolean, expired: boolean, device: Object | null }}
   */
  validateToken(token) {
    if (!token) {
      return { valid: false, expired: false, device: null };
    }

    const device = this.trustStore.findByToken(token);
    if (!device) {
      return { valid: false, expired: false, device: null };
    }

    const now = Date.now();
    if (device.expiresAt && now > device.expiresAt) {
      return { valid: false, expired: true, device };
    }

    // Touch lastSeen timestamp
    device.lastSeen = now;
    return { valid: true, expired: false, device };
  }

  /**
   * Rotates tokens using a valid refresh token.
   * @param {string} refreshToken
   * @param {string} [deviceId]
   * @returns {{ success: boolean, token?: string, refreshToken?: string, expiresAt?: number, error?: string }}
   */
  rotateToken(refreshToken, deviceId) {
    if (!refreshToken) {
      return { success: false, error: 'MISSING_REFRESH_TOKEN' };
    }

    const device = this.trustStore.findByRefreshToken(refreshToken);
    if (!device) {
      return { success: false, error: 'INVALID_REFRESH_TOKEN' };
    }

    if (deviceId && device.id !== deviceId) {
      return { success: false, error: 'DEVICE_MISMATCH' };
    }

    // Rotate: generate new token and new refresh token
    const newPair = this.createTokenPair();
    device.token = newPair.token;
    device.refreshToken = newPair.refreshToken;
    device.expiresAt = newPair.expiresAt;
    device.lastSeen = Date.now();

    this.trustStore.set(device.id, device);

    return {
      success: true,
      token: newPair.token,
      refreshToken: newPair.refreshToken,
      expiresAt: newPair.expiresAt,
      deviceId: device.id,
    };
  }

  /**
   * Revokes a specific device session.
   * @param {string} deviceId
   */
  revokeSession(deviceId) {
    return this.trustStore.delete(deviceId);
  }

  /**
   * Revokes all paired device sessions.
   * @returns {number} Count of revoked sessions
   */
  revokeAllSessions() {
    const count = this.trustStore.size;
    this.trustStore.clear();
    return count;
  }

  /**
   * Returns metadata about active sessions.
   */
  getActiveSessions() {
    const now = Date.now();
    const sessions = [];
    for (const [id, dev] of this.trustStore.entries()) {
      const isExpired = Boolean(dev.expiresAt && now > dev.expiresAt);
      sessions.push({
        deviceId: id,
        name: dev.name,
        model: dev.model,
        pairedAt: dev.pairedAt || dev.createdAt,
        expiresAt: dev.expiresAt,
        lastSeen: dev.lastSeen,
        isExpired,
      });
    }
    return sessions;
  }
}

module.exports = { TokenManager };
