/**
 * RequestContext Abstraction for Soko Middleware Pipeline
 *
 * Encapsulates the complete lifecycle state for an incoming HTTP request:
 * correlation tracing, monotonic timing, normalized client IP, parsed URL,
 * authentication identity, rate limit tracking, and standardized response helpers.
 */

const crypto = require('crypto');

/**
 * Normalizes raw socket IP addresses.
 * Strips IPv4-mapped IPv6 prefixes and maps loopback notations.
 *
 * @param {string} rawIp
 * @returns {string}
 */
function normalizeIp(rawIp) {
  if (!rawIp) return '127.0.0.1';
  let ip = String(rawIp).trim();
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  if (ip === '::1') {
    ip = '127.0.0.1';
  }
  return ip;
}

class RequestContext {
  /**
   * @param {import('http').IncomingMessage} req
   * @param {import('http').ServerResponse} res
   * @param {object} options
   */
  constructor(req, res, options = {}) {
    this.req = req;
    this.res = res;
    this.options = options;

    // 1. Correlation & Monotonic High-Resolution Timing
    this.reqId = options.reqId || ('req_' + crypto.randomBytes(8).toString('hex'));
    this.startTime = process.hrtime.bigint();

    // 2. Client IP Resolution & Loopback Detection
    const rawRemoteAddress = (req.socket && req.socket.remoteAddress) || '';
    const simulatedIp = req.headers && req.headers['x-simulate-remote-ip'];

    if (simulatedIp) {
      this.clientIp = normalizeIp(simulatedIp);
      this.isLoopback = false;
      this.isSimulatedRemote = true;
    } else {
      const normalizedRemote = options.rateLimiter && typeof options.rateLimiter.normalizeIp === 'function'
        ? options.rateLimiter.normalizeIp(rawRemoteAddress)
        : normalizeIp(rawRemoteAddress);

      this.clientIp = normalizedRemote;
      const isLocalIp = rawRemoteAddress === '127.0.0.1' ||
                        rawRemoteAddress === '::1' ||
                        rawRemoteAddress === '::ffff:127.0.0.1' ||
                        normalizedRemote === '127.0.0.1';
      this.isLoopback = isLocalIp;
      this.isSimulatedRemote = false;
    }

    // 3. HTTP Request Decomposition
    this.method = (req.method || 'GET').toUpperCase();
    const hostHeader = (req.headers && req.headers.host) || '127.0.0.1';
    try {
      this.url = new URL(req.url || '/', `http://${hostHeader}`);
    } catch {
      this.url = new URL('/', 'http://127.0.0.1');
    }
    this.pathname = this.url.pathname;
    this.query = this.url.searchParams;
    this.headers = req.headers || {};
    this.body = null; // Populated by bodyParserStage

    // 4. Centralized Authentication State
    this.auth = {
      authenticated: false,
      authType: 'none', // 'loopback' | 'bearer' | 'none'
      token: null,
      tokenExpired: false,
      deviceId: null,
      role: 'anonymous', // 'admin' | 'paired_device' | 'anonymous'
      permissions: new Set(),
    };

    // 5. Associated Device Record from TrustStore
    this.device = null;

    // 6. Rate Limiting State
    this.rateLimit = {
      checked: false,
      allowed: true,
      attempts: 0,
      retryAfter: 0,
    };

    // 7. Internal Lifecycle Flags & Storage
    this.sent = false;
    this._corsHeaders = {};
  }

  /**
   * Helper to set response headers safely
   */
  setHeader(name, value) {
    if (!this.res.writableEnded && typeof this.res.setHeader === 'function') {
      this.res.setHeader(name, value);
    }
  }

  /**
   * Sends a standardized JSON HTTP response with strict CORS and correlation ID headers.
   *
   * @param {number} statusCode
   * @param {any} data
   * @param {Record<string, string>} [extraHeaders]
   */
  sendJson(statusCode = 200, data = {}, extraHeaders = {}) {
    if (this.sent || this.res.writableEnded) {
      return;
    }
    this.sent = true;

    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    const headers = {
      'Content-Type': 'application/json',
      'X-Request-Id': this.reqId,
      ...this._corsHeaders,
      ...extraHeaders,
    };

    // Strict CORS Guarantee: Ensure wildcard '*' is NEVER emitted
    if (headers['Access-Control-Allow-Origin'] === '*') {
      const origin = this.headers['origin'];
      if (origin && origin !== 'null') {
        headers['Access-Control-Allow-Origin'] = origin;
      } else {
        delete headers['Access-Control-Allow-Origin'];
      }
    }

    if (typeof this.res.writeHead === 'function') {
      this.res.writeHead(statusCode, headers);
    }
    if (typeof this.res.end === 'function') {
      this.res.end(payload);
    }
  }

  /**
   * Formats and emits a standardized Soko error response.
   * Strictly matches existing Soko error payloads expected by desktop and companion clients.
   *
   * @param {number} statusCode
   * @param {string} [message]
   * @param {string} [code]
   * @param {Record<string, any>} [extra]
   */
  sendError(statusCode = 500, message = '', code = '', extra = {}) {
    if (this.sent || this.res.writableEnded) {
      return;
    }

    const extraHeaders = {};

    let payload;
    switch (statusCode) {
      case 400:
        payload = {
          error: message || 'Bad Request',
          code: 400,
          ...extra,
        };
        break;

      case 401: {
        const isExpired = Boolean(extra.tokenExpired ?? this.auth?.tokenExpired);
        payload = {
          error: message || (isExpired
            ? 'Unauthorized: Bearer token has expired after 30 days. Complete PIN pairing on Desktop Island first.'
            : 'Unauthorized: Remote device is not paired or missing valid bearer token. Complete PIN pairing on Desktop Island first.'),
          code: 401,
          tokenExpired: isExpired,
          requiresPairing: true,
          ...extra,
        };
        break;
      }

      case 403:
        payload = {
          error: message || 'Forbidden: Access denied by security policy',
          code: 403,
          ...extra,
        };
        break;

      case 429: {
        const retryAfter = Number(extra.retryAfter ?? this.rateLimit?.retryAfter) || 15;
        extraHeaders['Retry-After'] = String(retryAfter);
        payload = {
          status: 'rejected',
          error: code || extra.error || 'RATE_LIMITED',
          retryAfter,
          message: message || 'Too Many Requests: Rate limit cooldown active.',
          ...extra,
        };
        break;
      }

      case 500:
      default:
        payload = {
          error: message || 'Internal Server Error',
          code: statusCode,
          reqId: this.reqId,
          ...extra,
        };
        break;
    }

    this.sendJson(statusCode, payload, extraHeaders);
  }
}

/**
 * Factory for creating a RequestContext
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {object} [options]
 * @returns {RequestContext}
 */
function createRequestContext(req, res, options = {}) {
  return new RequestContext(req, res, options);
}

module.exports = {
  RequestContext,
  createRequestContext,
  normalizeIp,
};
