/**
 * Secure Trust Store & Device Credential Repository.
 * 
 * Manages authorized companion devices and persistent cryptographic tokens.
 * Features:
 * - Standard OS configuration path storage (XDG / AppData / Application Support)
 * - Strict POSIX file permissions (0600: read/write by owner only)
 * - Safe atomic writes using temporary swap files
 * - Seamless automatic migration from legacy transfers/.trust_store.json
 * - Token enrichment with 30-day TTL and refresh tokens
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { ensureConfigDir, getSecurityPaths, DEFAULT_TOKEN_TTL_MS } = require('./config');

class TrustStore {
  /**
   * @param {Object} options
   * @param {string} [options.configDir] - Custom config directory
   * @param {string} [options.legacyTransfersDir] - Path to legacy transfers directory
   */
  constructor(options = {}) {
    this.configDir = ensureConfigDir(options.configDir);
    this.paths = getSecurityPaths(this.configDir);
    this.legacyTransfersDir = options.legacyTransfersDir || path.resolve(process.cwd(), 'transfers');
    this.store = new Map();
    this.load();
  }

  /**
   * Loads trust store from disk, migrating legacy records if necessary.
   */
  load() {
    this.store.clear();
    const filePath = this.paths.trustStorePath;

    // Check if new store exists
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(raw);
        for (const [id, record] of Object.entries(data)) {
          this.store.set(id, this._normalizeRecord(id, record));
        }
        this._ensureFilePermissions(filePath);
        return this.store;
      } catch (err) {
        console.warn('[TrustStore] Error loading trust store, attempting fallback:', err.message);
      }
    }

    // Check for legacy trust store in transfers/
    const legacyPath = path.join(this.legacyTransfersDir, '.trust_store.json');
    if (fs.existsSync(legacyPath)) {
      try {
        console.log(`[TrustStore] Migrating legacy trust store from ${legacyPath} to ${filePath}...`);
        const raw = fs.readFileSync(legacyPath, 'utf8');
        const data = JSON.parse(raw);
        for (const [id, record] of Object.entries(data)) {
          this.store.set(id, this._normalizeRecord(id, record));
        }
        this.save();
        console.log(`[TrustStore] Successfully migrated ${this.store.size} device(s) to secure trust store.`);
        return this.store;
      } catch (err) {
        console.warn('[TrustStore] Failed to migrate legacy trust store:', err.message);
      }
    }

    return this.store;
  }

  /**
   * Enriches/normalizes device records with expiration and refresh token fields.
   */
  _normalizeRecord(deviceId, record) {
    const now = Date.now();
    const pairedAt = record.pairedAt || record.createdAt || now;
    const createdAt = record.createdAt || pairedAt;
    const expiresAt = record.expiresAt || (createdAt + DEFAULT_TOKEN_TTL_MS);
    const token = record.token || crypto.randomBytes(16).toString('hex');
    const refreshToken = record.refreshToken || crypto.randomBytes(16).toString('hex');
    const sessionKey = record.sessionKey || crypto.randomBytes(32).toString('hex');

    return {
      id: deviceId,
      name: record.name || 'Mobile Companion',
      model: record.model || 'Companion Device',
      token,
      refreshToken,
      sessionKey,
      createdAt,
      pairedAt,
      expiresAt,
      lastSeen: record.lastSeen || now,
    };
  }

  /**
   * Atomically saves trust store to disk with 0600 permissions.
   */
  save() {
    try {
      ensureConfigDir(this.configDir);
      const filePath = this.paths.trustStorePath;
      const tmpPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
      const obj = Object.fromEntries(this.store);
      const json = JSON.stringify(obj, null, 2);

      // Write to temp file with 0600 mode
      fs.writeFileSync(tmpPath, json, {
        encoding: 'utf8',
        mode: 0o600,
      });

      // Set explicit permissions before atomic rename (POSIX)
      this._ensureFilePermissions(tmpPath);

      // Atomic replace
      fs.renameSync(tmpPath, filePath);
      this._ensureFilePermissions(filePath);
      return true;
    } catch (e) {
      console.warn('[TrustStore] Failed to atomically save trust store:', e.message);
      return false;
    }
  }

  /**
   * Sets strict file permissions (0600: read/write by owner only).
   */
  _ensureFilePermissions(filePath) {
    if (os.platform() !== 'win32' && fs.existsSync(filePath)) {
      try {
        fs.chmodSync(filePath, 0o600);
      } catch {}
    }
  }

  get(deviceId) {
    return this.store.get(deviceId);
  }

  set(deviceId, record) {
    const normalized = this._normalizeRecord(deviceId, record);
    this.store.set(deviceId, normalized);
    this.save();
    return normalized;
  }

  delete(deviceId) {
    const deleted = this.store.delete(deviceId);
    if (deleted) {
      this.save();
    }
    return deleted;
  }

  has(deviceId) {
    return this.store.has(deviceId);
  }

  clear() {
    this.store.clear();
    this.save();
  }

  entries() {
    return this.store.entries();
  }

  values() {
    return this.store.values();
  }

  keys() {
    return this.store.keys();
  }

  get size() {
    return this.store.size;
  }

  /**
   * Finds a device record by Bearer token.
   */
  findByToken(token) {
    if (!token) return null;
    for (const [id, dev] of this.store.entries()) {
      if (dev && dev.token === token) {
        return dev;
      }
    }
    return null;
  }

  /**
   * Finds a device record by refresh token.
   */
  findByRefreshToken(refreshToken) {
    if (!refreshToken) return null;
    for (const [id, dev] of this.store.entries()) {
      if (dev && dev.refreshToken === refreshToken) {
        return dev;
      }
    }
    return null;
  }

  getAll() {
    return Object.fromEntries(this.store);
  }
}

module.exports = { TrustStore };
