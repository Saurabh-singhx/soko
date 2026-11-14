/**
 * In-Memory Mock Test Harness for Middleware Unit Tests
 *
 * Provides headless, zero-socket mock HTTP request/response objects
 * and mock security service dependencies.
 */

const { EventEmitter } = require('events');

function createMockRequest(options = {}) {
  const req = new EventEmitter();
  req.method = options.method || 'GET';
  req.url = options.url || '/api/status';

  const rawHeaders = options.headers || {};
  req.headers = {};
  for (const [key, value] of Object.entries(rawHeaders)) {
    req.headers[key.toLowerCase()] = value;
  }

  req.socket = {
    remoteAddress: options.remoteAddress || '127.0.0.1',
    destroy() {},
  };

  // Helper to push body chunks asynchronously
  req.sendBody = function (data) {
    process.nextTick(() => {
      if (typeof data === 'string') {
        req.emit('data', Buffer.from(data));
      } else if (Buffer.isBuffer(data)) {
        req.emit('data', data);
      } else if (data !== undefined && data !== null) {
        req.emit('data', Buffer.from(JSON.stringify(data)));
      }
      req.emit('end');
    });
  };

  return req;
}

function createMockResponse() {
  const res = {
    statusCode: 200,
    headers: {},
    body: '',
    writableEnded: false,
    headersSent: false,

    setHeader(name, value) {
      this.headers[name.toLowerCase()] = String(value);
      return this;
    },

    getHeader(name) {
      return this.headers[name.toLowerCase()];
    },

    removeHeader(name) {
      delete this.headers[name.toLowerCase()];
      return this;
    },

    writeHead(statusCode, headers = {}) {
      this.statusCode = statusCode;
      this.headersSent = true;
      for (const [name, value] of Object.entries(headers)) {
        this.setHeader(name, value);
      }
      return this;
    },

    write(chunk) {
      if (chunk) {
        this.body += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
      }
      return true;
    },

    end(chunk) {
      if (chunk) {
        this.write(chunk);
      }
      this.writableEnded = true;
      return this;
    },

    getJson() {
      try {
        return JSON.parse(this.body);
      } catch {
        return null;
      }
    },
  };

  return res;
}

function createMockSecurityServices(overrides = {}) {
  const devices = new Map();
  const validTokens = new Map(); // token -> { deviceId, expired }

  const mockTrustStore = {
    get: (id) => devices.get(id),
    set: (id, record) => {
      devices.set(id, record);
      return record;
    },
    delete: (id) => devices.delete(id),
    findByToken: (token) => {
      const entry = validTokens.get(token);
      return entry ? devices.get(entry.deviceId) : null;
    },
  };

  const mockTokenManager = {
    trustStore: mockTrustStore,
    validateToken: (token) => {
      const entry = validTokens.get(token);
      if (!entry) {
        return { valid: false, expired: false, device: null };
      }
      const device = devices.get(entry.deviceId);
      if (entry.expired) {
        return { valid: false, expired: true, device };
      }
      return { valid: true, expired: false, device };
    },
  };

  const mockRateLimiter = {
    records: new Map(),
    normalizeIp: (ip) => {
      if (!ip) return '127.0.0.1';
      let s = String(ip).trim();
      if (s.startsWith('::ffff:')) s = s.slice(7);
      if (s === '::1') s = '127.0.0.1';
      return s;
    },
    checkLimit: (ip) => {
      const norm = mockRateLimiter.normalizeIp(ip);
      const attempts = mockRateLimiter.records.get(norm) || 0;
      if (attempts >= 4) {
        return { allowed: false, retryAfter: 15, reason: 'RATE_LIMITED', attempts, blocked: false };
      }
      return { allowed: true, retryAfter: 0, reason: null, attempts, blocked: false };
    },
    recordFailure: (ip) => {
      const norm = mockRateLimiter.normalizeIp(ip);
      const current = mockRateLimiter.records.get(norm) || 0;
      mockRateLimiter.records.set(norm, current + 1);
    },
    recordSuccess: (ip) => {
      const norm = mockRateLimiter.normalizeIp(ip);
      mockRateLimiter.records.delete(norm);
    },
  };

  const mockCorsHardener = {
    isHostAllowed: (host) => {
      if (!host) return true;
      const clean = host.split(':')[0].toLowerCase();
      return clean === 'localhost' || clean === '127.0.0.1' || clean === '::1' || clean === '192.168.1.100';
    },
    isOriginAllowed: (origin) => {
      if (!origin) return true;
      if (origin === 'null' || origin.startsWith('tauri://') || origin.startsWith('file://')) return true;
      try {
        const u = new URL(origin);
        return u.hostname === 'localhost' || u.hostname === '127.0.0.1';
      } catch {
        return false;
      }
    },
    getCorsHeaders: (req) => {
      const origin = req.headers['origin'];
      const headers = {
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-simulate-remote-ip',
        'Vary': 'Origin',
      };
      if (origin && mockCorsHardener.isOriginAllowed(origin)) {
        headers['Access-Control-Allow-Origin'] = origin;
      }
      return headers;
    },
  };

  const mockLogger = {
    logs: [],
    info(msg) { this.logs.push({ level: 'INFO', msg }); },
    warn(msg) { this.logs.push({ level: 'WARN', msg }); },
    error(msg) { this.logs.push({ level: 'ERROR', msg }); },
  };

  return {
    trustStore: mockTrustStore,
    tokenManager: mockTokenManager,
    rateLimiter: mockRateLimiter,
    corsHardener: mockCorsHardener,
    logger: mockLogger,
    devices,
    validTokens,
    ...overrides,
  };
}

module.exports = {
  createMockRequest,
  createMockResponse,
  createMockSecurityServices,
};
