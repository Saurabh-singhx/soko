/**
 * PIN Brute-Force Defense & Progressive Rate Limiter.
 * 
 * Protects Soko Bridge SAS PIN pairing endpoints (/api/pair, PAIR_REQUEST) against
 * automated offline/LAN dictionary and brute-force attacks.
 * 
 * Rules:
 * - Attempts 1-2: Normal verification (no delay)
 * - Attempt 3-4: 15s progressive delay / cooldown
 * - Attempt 5-9: 60s cooldown
 * - Attempt 10+: Immediate active SAS PIN regeneration and 10-minute (600s) IP block.
 * - Emits security alerts on HUD when multiple invalid attempts are detected.
 */

const { RATE_LIMIT_CONFIG } = require('./config');

class RateLimiter {
  constructor(config = {}) {
    this.config = { ...RATE_LIMIT_CONFIG, ...config };
    // Map of normalizedIp -> { attempts: number, lastAttempt: number, blockedUntil: number, cooldownUntil: number }
    this.ipRecords = new Map();
    this.alertListeners = new Set();

    // Start periodic background cleanup
    this.cleanupTimer = setInterval(() => this.cleanupStaleRecords(), this.config.CLEANUP_INTERVAL_MS);
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Normalizes client IP addresses (strips IPv4-mapped IPv6 prefix).
   */
  normalizeIp(ip) {
    if (!ip) return '127.0.0.1';
    let s = String(ip).trim();
    if (s.startsWith('::ffff:')) s = s.slice(7);
    if (s === '::1') s = '127.0.0.1';
    return s;
  }

  /**
   * Checks if an IP is currently rate-limited or blocked before attempting PIN entry.
   * @param {string} rawIp
   * @returns {{ allowed: boolean, retryAfter: number, reason: string | null, attempts: number, blocked: boolean }}
   */
  checkLimit(rawIp) {
    const ip = this.normalizeIp(rawIp);
    const record = this.ipRecords.get(ip);
    const now = Date.now();

    if (!record) {
      return { allowed: true, retryAfter: 0, reason: null, attempts: 0, blocked: false };
    }

    // Check if hard-blocked (10+ failed attempts)
    if (record.blockedUntil && now < record.blockedUntil) {
      const retryAfter = Math.ceil((record.blockedUntil - now) / 1000);
      return {
        allowed: false,
        retryAfter,
        reason: 'IP_BLOCKED',
        attempts: record.attempts,
        blocked: true,
      };
    }

    // Check if in cooldown (3+ or 5+ failed attempts)
    if (record.cooldownUntil && now < record.cooldownUntil) {
      const retryAfter = Math.ceil((record.cooldownUntil - now) / 1000);
      return {
        allowed: false,
        retryAfter,
        reason: 'RATE_LIMITED',
        attempts: record.attempts,
        blocked: false,
      };
    }

    return {
      allowed: true,
      retryAfter: 0,
      reason: null,
      attempts: record.attempts,
      blocked: false,
    };
  }

  /**
   * Records a failed PIN entry attempt and applies backoff/block thresholds.
   * @param {string} rawIp
   * @returns {{
   *   attempts: number,
   *   retryAfter: number,
   *   shouldRegeneratePin: boolean,
   *   shouldAlert: boolean,
   *   alertType: string | null,
   *   message: string
   * }}
   */
  recordFailure(rawIp) {
    const ip = this.normalizeIp(rawIp);
    const now = Date.now();
    let record = this.ipRecords.get(ip);

    if (!record) {
      record = {
        attempts: 0,
        lastAttempt: now,
        blockedUntil: 0,
        cooldownUntil: 0,
      };
      this.ipRecords.set(ip, record);
    }

    record.attempts += 1;
    record.lastAttempt = now;

    let retryAfter = 0;
    let shouldRegeneratePin = false;
    let shouldAlert = false;
    let alertType = null;
    let message = '';

    if (record.attempts >= this.config.STAGE_3_ATTEMPTS) {
      // 10 failed attempts: 10 minute block & regenerate PIN
      record.blockedUntil = now + this.config.STAGE_3_BLOCK_MS;
      retryAfter = Math.ceil(this.config.STAGE_3_BLOCK_MS / 1000);
      shouldRegeneratePin = true;
      shouldAlert = true;
      alertType = 'BRUTE_FORCE_BLOCKED';
      message = `High security alert: IP ${ip} blocked for 10 minutes following ${record.attempts} failed PIN attempts. Active PIN has been automatically regenerated.`;
    } else if (record.attempts >= this.config.STAGE_2_ATTEMPTS) {
      // 5 failed attempts: 60s cooldown
      record.cooldownUntil = now + this.config.STAGE_2_DELAY_MS;
      retryAfter = Math.ceil(this.config.STAGE_2_DELAY_MS / 1000);
      shouldAlert = true;
      alertType = 'BRUTE_FORCE_WARNING';
      message = `Warning: ${record.attempts} invalid PIN attempts detected from ${ip}. Rate limiting applied for ${retryAfter}s.`;
    } else if (record.attempts >= this.config.STAGE_1_ATTEMPTS) {
      // 3 failed attempts: 15s delay
      record.cooldownUntil = now + this.config.STAGE_1_DELAY_MS;
      retryAfter = Math.ceil(this.config.STAGE_1_DELAY_MS / 1000);
      shouldAlert = true;
      alertType = 'BRUTE_FORCE_DELAY';
      message = `Notice: Multiple failed PIN attempts from ${ip}. Progressive backoff applied for ${retryAfter}s.`;
    } else {
      message = `Invalid PIN attempt (${record.attempts}/${this.config.STAGE_1_ATTEMPTS}).`;
    }

    const result = {
      ip,
      attempts: record.attempts,
      retryAfter,
      shouldRegeneratePin,
      shouldAlert,
      alertType,
      message,
    };

    if (shouldAlert) {
      this._emitAlert(result);
    }

    return result;
  }

  /**
   * Resets failure counter upon successful verification.
   * @param {string} rawIp
   */
  recordSuccess(rawIp) {
    const ip = this.normalizeIp(rawIp);
    this.ipRecords.delete(ip);
  }

  /**
   * Registers an alert event listener.
   */
  onAlert(listener) {
    this.alertListeners.add(listener);
    return () => this.alertListeners.delete(listener);
  }

  _emitAlert(alertData) {
    for (const listener of this.alertListeners) {
      try {
        listener(alertData);
      } catch (err) {
        console.warn('[RateLimiter] Error in alert listener:', err.message);
      }
    }
  }

  /**
   * Cleans up stale records older than RECORD_TTL_MS.
   */
  cleanupStaleRecords() {
    const now = Date.now();
    for (const [ip, record] of this.ipRecords.entries()) {
      if (now - record.lastAttempt > this.config.RECORD_TTL_MS && now > record.blockedUntil) {
        this.ipRecords.delete(ip);
      }
    }
  }

  /**
   * Resets all rate-limiting state (useful for tests).
   */
  reset() {
    this.ipRecords.clear();
  }

  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.alertListeners.clear();
    this.ipRecords.clear();
  }
}

module.exports = { RateLimiter };
