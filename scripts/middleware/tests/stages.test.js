/**
 * Unit Tests for Individual Middleware Stages
 * Tests: CORS, RateLimit, BodyParser, Auth, Identity, RBAC, AuditLog
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { createCorsStage } = require('../stages/corsStage');
const { createRateLimitStage } = require('../stages/rateLimitStage');
const { createBodyParserStage } = require('../stages/bodyParserStage');
const { createAuthStage } = require('../stages/authStage');
const { createIdentityStage } = require('../stages/identityStage');
const { createRbacStage } = require('../stages/rbacStage');
const { createAuditLogStage } = require('../stages/auditLogStage');

const { createRequestContext } = require('../core/Context');
const { BadRequestError, UnauthorizedError, ForbiddenError, TooManyRequestsError } = require('../core/errors');

const { createMockRequest, createMockResponse, createMockSecurityServices } = require('./test_helpers');

describe('CORS and Host Hardening Stage', () => {
  it('blocks foreign Host header (DNS Rebinding protection) with 400', async () => {
    const services = createMockSecurityServices();
    const stage = createCorsStage({ corsHardener: services.corsHardener });

    const req = createMockRequest({
      headers: { host: 'evil-attacker.com' },
    });
    const res = createMockResponse();
    const ctx = createRequestContext(req, res);

    await assert.rejects(
      async () => {
        await stage(ctx, async () => {});
      },
      (err) => err instanceof BadRequestError && err.code === 'DNS_REBINDING_BLOCKED'
    );
  });

  it('handles OPTIONS preflight cleanly with 204 No Content and short-circuits', async () => {
    const services = createMockSecurityServices();
    const stage = createCorsStage({ corsHardener: services.corsHardener });

    const req = createMockRequest({
      method: 'OPTIONS',
      headers: {
        host: 'localhost:8766',
        origin: 'http://localhost:5173',
      },
    });
    const res = createMockResponse();
    const ctx = createRequestContext(req, res);

    let nextCalled = false;
    await stage(ctx, async () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 204);
    assert.strictEqual(res.getHeader('Access-Control-Allow-Origin'), 'http://localhost:5173');
    assert.strictEqual(ctx.sent, true);
  });

  it('rejects untrusted browser Origin with 403 Forbidden', async () => {
    const services = createMockSecurityServices();
    const stage = createCorsStage({ corsHardener: services.corsHardener });

    const req = createMockRequest({
      method: 'GET',
      headers: {
        host: 'localhost:8766',
        origin: 'https://malicious-phishing.org',
      },
    });
    const res = createMockResponse();
    const ctx = createRequestContext(req, res);

    await assert.rejects(
      async () => {
        await stage(ctx, async () => {});
      },
      (err) => err instanceof ForbiddenError && err.statusCode === 403
    );
  });
});

describe('Rate Limiting Stage', () => {
  it('permits requests when client is under rate limits', async () => {
    const services = createMockSecurityServices();
    const stage = createRateLimitStage({ rateLimiter: services.rateLimiter });

    const req = createMockRequest({
      method: 'POST',
      url: '/api/pair',
      remoteAddress: '192.168.1.55',
    });
    const res = createMockResponse();
    const ctx = createRequestContext(req, res);

    let nextCalled = false;
    await stage(ctx, async () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true);
    assert.strictEqual(ctx.rateLimit.allowed, true);
  });

  it('rejects client when rate limit threshold is exceeded with 429 Too Many Requests', async () => {
    const services = createMockSecurityServices();
    const clientIp = '10.0.0.99';

    // Record failures to exceed rate threshold
    for (let i = 0; i < 5; i++) {
      services.rateLimiter.recordFailure(clientIp);
    }

    const stage = createRateLimitStage({ rateLimiter: services.rateLimiter });

    const req = createMockRequest({
      method: 'POST',
      url: '/api/pair',
      headers: { 'x-simulate-remote-ip': clientIp },
    });
    const res = createMockResponse();
    const ctx = createRequestContext(req, res);

    await assert.rejects(
      async () => {
        await stage(ctx, async () => {});
      },
      (err) => err instanceof TooManyRequestsError && err.statusCode === 429 && err.retryAfter > 0
    );
  });
});

describe('Body Parser Stage', () => {
  it('parses valid JSON payloads on POST requests', async () => {
    const stage = createBodyParserStage();

    const req = createMockRequest({
      method: 'POST',
      url: '/api/notify',
      headers: { 'content-type': 'application/json' },
    });
    const res = createMockResponse();
    const ctx = createRequestContext(req, res);

    req.sendBody({ appName: 'Signal', title: 'Test', body: 'Hello' });

    let nextCalled = false;
    await stage(ctx, async () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true);
    assert.deepStrictEqual(ctx.body, { appName: 'Signal', title: 'Test', body: 'Hello' });
  });

  it('rejects invalid JSON payloads with 400 Bad Request', async () => {
    const stage = createBodyParserStage();

    const req = createMockRequest({
      method: 'POST',
      url: '/api/notify',
      headers: { 'content-type': 'application/json' },
    });
    const res = createMockResponse();
    const ctx = createRequestContext(req, res);

    req.sendBody('{ malformed json');

    await assert.rejects(
      async () => {
        await stage(ctx, async () => {});
      },
      (err) => err instanceof BadRequestError && err.code === 'INVALID_JSON'
    );
  });

  it('bypasses binary uploads without consuming body buffer', async () => {
    const stage = createBodyParserStage();

    const req = createMockRequest({
      method: 'POST',
      url: '/api/upload?filename=test.bin',
      headers: { 'content-type': 'application/octet-stream' },
    });
    const res = createMockResponse();
    const ctx = createRequestContext(req, res);

    let nextCalled = false;
    await stage(ctx, async () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true);
    assert.strictEqual(ctx.body, null);
  });
});

describe('Authentication & Identity Stages', () => {
  it('automatically authorizes local loopback requests with admin role', async () => {
    const services = createMockSecurityServices();
    const stage = createAuthStage({ tokenManager: services.tokenManager });

    const req = createMockRequest({ remoteAddress: '127.0.0.1' });
    const res = createMockResponse();
    const ctx = createRequestContext(req, res);

    await stage(ctx, async () => {});

    assert.strictEqual(ctx.auth.authenticated, true);
    assert.strictEqual(ctx.auth.authType, 'loopback');
    assert.strictEqual(ctx.auth.role, 'admin');
    assert(ctx.auth.permissions.has('*'));
  });

  it('authenticates remote client presenting valid Bearer token', async () => {
    const services = createMockSecurityServices();
    const testDeviceId = 'phone-device-123';
    const testToken = 'valid-token-hex-1234567890abcdef';

    services.devices.set(testDeviceId, {
      id: testDeviceId,
      name: 'Pixel 8',
      model: 'Google Pixel',
      token: testToken,
      expiresAt: Date.now() + 86400000,
    });
    services.validTokens.set(testToken, { deviceId: testDeviceId, expired: false });

    const authStage = createAuthStage({ tokenManager: services.tokenManager });
    const identityStage = createIdentityStage({ trustStore: services.trustStore });

    const req = createMockRequest({
      headers: {
        'x-simulate-remote-ip': '192.168.1.155',
        authorization: `Bearer ${testToken}`,
      },
    });
    const res = createMockResponse();
    const ctx = createRequestContext(req, res);

    await authStage(ctx, async () => {
      await identityStage(ctx, async () => {});
    });

    assert.strictEqual(ctx.auth.authenticated, true);
    assert.strictEqual(ctx.auth.authType, 'bearer');
    assert.strictEqual(ctx.auth.deviceId, testDeviceId);
    assert.strictEqual(ctx.device.name, 'Pixel 8');
  });

  it('detects expired Bearer token (> 30 days) and flags tokenExpired', async () => {
    const services = createMockSecurityServices();
    const testDeviceId = 'old-device-456';
    const expiredToken = 'expired-token-hex-000000000000';

    services.devices.set(testDeviceId, {
      id: testDeviceId,
      name: 'Old Phone',
      token: expiredToken,
      expiresAt: Date.now() - 1000,
    });
    services.validTokens.set(expiredToken, { deviceId: testDeviceId, expired: true });

    const stage = createAuthStage({ tokenManager: services.tokenManager });

    const req = createMockRequest({
      headers: {
        'x-simulate-remote-ip': '192.168.1.155',
        authorization: `Bearer ${expiredToken}`,
      },
    });
    const res = createMockResponse();
    const ctx = createRequestContext(req, res);

    await stage(ctx, async () => {});

    assert.strictEqual(ctx.auth.authenticated, false);
    assert.strictEqual(ctx.auth.tokenExpired, true);
  });

  it('marks caller unauthenticated when credentials are missing', async () => {
    const services = createMockSecurityServices();
    const stage = createAuthStage({ tokenManager: services.tokenManager });

    const req = createMockRequest({
      headers: { 'x-simulate-remote-ip': '192.168.1.155' },
    });
    const res = createMockResponse();
    const ctx = createRequestContext(req, res);

    await stage(ctx, async () => {});

    assert.strictEqual(ctx.auth.authenticated, false);
    assert.strictEqual(ctx.auth.authType, 'none');
  });
});

describe('RBAC & Route Authorization Stage', () => {
  it('allows access to PUBLIC endpoints even without credentials', async () => {
    const stage = createRbacStage();

    const req = createMockRequest({
      method: 'GET',
      url: '/api/status',
      headers: { 'x-simulate-remote-ip': '192.168.1.155' },
    });
    const res = createMockResponse();
    const ctx = createRequestContext(req, res);

    let nextCalled = false;
    await stage(ctx, async () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true);
  });

  it('blocks unauthenticated access to PROTECTED endpoints with 401 and requiresPairing: true', async () => {
    const stage = createRbacStage();

    const req = createMockRequest({
      method: 'GET',
      url: '/api/tokens',
      headers: { 'x-simulate-remote-ip': '192.168.1.155' },
    });
    const res = createMockResponse();
    const ctx = createRequestContext(req, res);
    ctx.auth.authenticated = false;

    await assert.rejects(
      async () => {
        await stage(ctx, async () => {});
      },
      (err) => err instanceof UnauthorizedError && err.statusCode === 401 && err.extra.requiresPairing === true
    );
  });

  it('returns 401 with tokenExpired: true on PROTECTED endpoint when token is expired', async () => {
    const stage = createRbacStage();

    const req = createMockRequest({
      method: 'GET',
      url: '/api/tokens',
      headers: { 'x-simulate-remote-ip': '192.168.1.155' },
    });
    const res = createMockResponse();
    const ctx = createRequestContext(req, res);
    ctx.auth.authenticated = false;
    ctx.auth.tokenExpired = true;

    await assert.rejects(
      async () => {
        await stage(ctx, async () => {});
      },
      (err) => err instanceof UnauthorizedError && err.statusCode === 401 && err.extra.tokenExpired === true
    );
  });

  it('blocks remote access to LOCAL_ONLY endpoint with 403 Forbidden', async () => {
    const stage = createRbacStage();

    const req = createMockRequest({
      method: 'POST',
      url: '/api/devices/pending-pin',
      headers: { 'x-simulate-remote-ip': '192.168.1.155' },
    });
    const res = createMockResponse();
    const ctx = createRequestContext(req, res);
    // Even if authenticated as a paired mobile companion, LOCAL_ONLY requires loopback
    ctx.auth.authenticated = true;
    ctx.auth.role = 'paired_device';

    await assert.rejects(
      async () => {
        await stage(ctx, async () => {});
      },
      (err) => err instanceof ForbiddenError && err.statusCode === 403 && err.code === 'LOCAL_ONLY_REQUIRED'
    );
  });

  it('enforces CLI command whitelist on /api/cli and rejects non-whitelisted command with 403', async () => {
    const stage = createRbacStage();

    const req = createMockRequest({
      method: 'POST',
      url: '/api/cli',
    });
    const res = createMockResponse();
    const ctx = createRequestContext(req, res);
    ctx.auth.authenticated = true;
    ctx.auth.role = 'paired_device';
    ctx.auth.permissions = new Set(['cli:execute']);
    ctx.body = { command: 'cat /etc/shadow' }; // Malicious command not in whitelist

    await assert.rejects(
      async () => {
        await stage(ctx, async () => {});
      },
      (err) => err instanceof ForbiddenError && err.statusCode === 403 && err.code === 'COMMAND_NOT_WHITELISTED'
    );
  });

  it('allows whitelisted CLI command on /api/cli', async () => {
    const stage = createRbacStage();

    const req = createMockRequest({
      method: 'POST',
      url: '/api/cli',
    });
    const res = createMockResponse();
    const ctx = createRequestContext(req, res);
    ctx.auth.authenticated = true;
    ctx.auth.role = 'paired_device';
    ctx.auth.permissions = new Set(['cli:execute']);
    ctx.body = { command: 'sysinfo' }; // Whitelisted command

    let nextCalled = false;
    await stage(ctx, async () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true);
  });
});

describe('Audit Logging Stage', () => {
  it('logs structured info on successful execution', async () => {
    const services = createMockSecurityServices();
    const stage = createAuditLogStage({ logger: services.logger });

    const req = createMockRequest({ method: 'GET', url: '/api/status' });
    const res = createMockResponse();
    const ctx = createRequestContext(req, res);

    await stage(ctx, async () => {});

    assert(services.logger.logs.some((l) => l.level === 'INFO' && l.msg.includes('/api/status')));
  });

  it('logs security warning when downstream throws UnauthorizedError', async () => {
    const services = createMockSecurityServices();
    const stage = createAuditLogStage({ logger: services.logger });

    const req = createMockRequest({ method: 'GET', url: '/api/tokens' });
    const res = createMockResponse();
    const ctx = createRequestContext(req, res);

    await assert.rejects(
      async () => {
        await stage(ctx, async () => {
          throw new UnauthorizedError('Rejected');
        });
      },
      (err) => err instanceof UnauthorizedError
    );

    assert(services.logger.logs.some((l) => l.level === 'WARN' && l.msg.includes('Security Rejection')));
  });
});
