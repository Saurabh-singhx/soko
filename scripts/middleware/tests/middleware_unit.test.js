#!/usr/bin/env node

/**
 * Master Middleware Unit Test Suite Runner
 *
 * Runs all middleware unit tests in-memory with sub-millisecond latency
 * using Node.js built-in test runner (node:test).
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

// Import sub-suites
require('./pipeline.test');
require('./stages.test');

const { createHttpPipeline } = require('../index');
const { createRequestContext } = require('../core/Context');
const { createMockRequest, createMockResponse, createMockSecurityServices } = require('./test_helpers');

describe('Full Integrated HTTP Pipeline (In-Memory E2E)', () => {
  it('processes authorized remote request across all 7 stages to route handler', async () => {
    const services = createMockSecurityServices();
    const token = 'valid-integrated-token-123456';
    const deviceId = 'companion-device-1';

    services.devices.set(deviceId, {
      id: deviceId,
      name: 'Android Companion',
      model: 'SM-G998B',
      token,
      expiresAt: Date.now() + 10000000,
    });
    services.validTokens.set(token, { deviceId, expired: false });

    const pipeline = createHttpPipeline(services);

    const req = createMockRequest({
      method: 'GET',
      url: '/api/tokens',
      headers: {
        host: 'localhost:8766',
        origin: 'http://localhost:5173',
        authorization: `Bearer ${token}`,
        'x-simulate-remote-ip': '192.168.1.188',
      },
    });
    const res = createMockResponse();
    const ctx = createRequestContext(req, res);

    await pipeline.execute(ctx, async (c) => {
      c.sendJson(200, { totalTokens: 42500 });
    });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.getHeader('Access-Control-Allow-Origin'), 'http://localhost:5173');
    assert.strictEqual(res.getHeader('X-Request-Id'), ctx.reqId);
    const json = res.getJson();
    assert.strictEqual(json.totalTokens, 42500);
  });

  it('rejects unauthenticated remote request to protected endpoint with 401 JSON and CORS headers', async () => {
    const services = createMockSecurityServices();
    const pipeline = createHttpPipeline(services);

    const req = createMockRequest({
      method: 'GET',
      url: '/api/tokens',
      headers: {
        host: 'localhost:8766',
        origin: 'http://localhost:5173',
        'x-simulate-remote-ip': '192.168.1.188',
      },
    });
    const res = createMockResponse();
    const ctx = createRequestContext(req, res);

    let routeHandlerCalled = false;
    await pipeline.execute(ctx, async () => {
      routeHandlerCalled = true;
    });

    assert.strictEqual(routeHandlerCalled, false);
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.getHeader('Access-Control-Allow-Origin'), 'http://localhost:5173');
    const json = res.getJson();
    assert.strictEqual(json.code, 401);
    assert.strictEqual(json.requiresPairing, true);
    assert.strictEqual(json.tokenExpired, false);
  });

  it('rejects foreign Host header at CORS stage before route handler or auth checks', async () => {
    const services = createMockSecurityServices();
    const pipeline = createHttpPipeline(services);

    const req = createMockRequest({
      method: 'GET',
      url: '/api/status',
      headers: {
        host: 'attacker-site.com',
      },
    });
    const res = createMockResponse();
    const ctx = createRequestContext(req, res);

    await pipeline.execute(ctx, async (c) => {
      c.sendJson(200, { ok: true });
    });

    assert.strictEqual(res.statusCode, 400);
    const json = res.getJson();
    assert.strictEqual(json.code, 400);
    assert(json.error.includes('DNS Rebinding'));
  });

  it('rejects rate-limited caller at rateLimitStage with 429 and Retry-After header', async () => {
    const services = createMockSecurityServices();
    const attackerIp = '10.99.88.77';

    for (let i = 0; i < 5; i++) {
      services.rateLimiter.recordFailure(attackerIp);
    }

    const pipeline = createHttpPipeline(services);

    const req = createMockRequest({
      method: 'POST',
      url: '/api/pair',
      headers: {
        host: 'localhost:8766',
        'x-simulate-remote-ip': attackerIp,
        'content-type': 'application/json',
      },
    });
    const res = createMockResponse();
    const ctx = createRequestContext(req, res);

    req.sendBody({ deviceId: 'attacker', pin: '000000' });

    await pipeline.execute(ctx, async (c) => {
      c.sendJson(200, { success: true });
    });

    assert.strictEqual(res.statusCode, 429);
    assert.strictEqual(res.getHeader('Retry-After'), '15');
    const json = res.getJson();
    assert.strictEqual(json.status, 'rejected');
    assert.strictEqual(json.error, 'RATE_LIMITED');
  });
});
