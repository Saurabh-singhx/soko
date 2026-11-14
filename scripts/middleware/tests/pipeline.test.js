/**
 * Unit Tests for Pipeline Engine and RequestContext
 * Uses Node.js native test runner (node:test) and assertions (node:assert)
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { Pipeline } = require('../core/Pipeline');
const { RequestContext, createRequestContext, normalizeIp } = require('../core/Context');
const {
  HttpError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  TooManyRequestsError,
  InternalServerError,
} = require('../core/errors');

const { createMockRequest, createMockResponse } = require('./test_helpers');

describe('Pipeline Engine Unit Tests', () => {
  it('executes middleware stages in asynchronous onion order', async () => {
    const pipeline = new Pipeline();
    const trace = [];

    pipeline.use(async (ctx, next) => {
      trace.push('stage1:enter');
      await next();
      trace.push('stage1:exit');
    });

    pipeline.use(async (ctx, next) => {
      trace.push('stage2:enter');
      await next();
      trace.push('stage2:exit');
    });

    const req = createMockRequest();
    const res = createMockResponse();
    const ctx = createRequestContext(req, res);

    await pipeline.execute(ctx, async () => {
      trace.push('finalHandler');
    });

    assert.deepStrictEqual(trace, [
      'stage1:enter',
      'stage2:enter',
      'finalHandler',
      'stage2:exit',
      'stage1:exit',
    ]);
  });

  it('short-circuits pipeline if a stage does not call next()', async () => {
    const pipeline = new Pipeline();
    const trace = [];

    pipeline.use(async (ctx, next) => {
      trace.push('stage1');
      ctx.sendJson(200, { halted: true });
      // next() intentionally omitted
    });

    pipeline.use(async (ctx, next) => {
      trace.push('stage2');
      await next();
    });

    const req = createMockRequest();
    const res = createMockResponse();
    const ctx = createRequestContext(req, res);

    await pipeline.execute(ctx, async () => {
      trace.push('finalHandler');
    });

    assert.deepStrictEqual(trace, ['stage1']);
    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(res.getJson(), { halted: true });
  });

  it('rejects multiple next() invocations within the same stage', async () => {
    const pipeline = new Pipeline();

    pipeline.use(async (ctx, next) => {
      await next();
      await next(); // Illegal second call
    });

    const req = createMockRequest();
    const res = createMockResponse();
    const ctx = createRequestContext(req, res);

    await pipeline.execute(ctx);
    assert.strictEqual(res.statusCode, 500);
    const json = res.getJson();
    assert.strictEqual(json.code, 500);
    assert(json.message && json.message.includes('multiple times'));
  });

  it('catches HttpError in error boundary and formats standard response', async () => {
    const pipeline = new Pipeline();

    pipeline.use(async () => {
      throw new UnauthorizedError('Custom unauthorized message', 'AUTH_FAILED', {
        requiresPairing: true,
      });
    });

    const req = createMockRequest();
    const res = createMockResponse();
    const ctx = createRequestContext(req, res);

    await pipeline.execute(ctx);

    assert.strictEqual(res.statusCode, 401);
    const json = res.getJson();
    assert.strictEqual(json.code, 401);
    assert.strictEqual(json.error, 'Custom unauthorized message');
    assert.strictEqual(json.requiresPairing, true);
  });

  it('catches generic Error in error boundary and produces sanitized 500', async () => {
    const pipeline = new Pipeline();

    pipeline.use(async () => {
      throw new Error('Database connection failed');
    });

    const req = createMockRequest();
    const res = createMockResponse();
    const ctx = createRequestContext(req, res);

    await pipeline.execute(ctx);

    assert.strictEqual(res.statusCode, 500);
    const json = res.getJson();
    assert.strictEqual(json.code, 500);
    assert.strictEqual(json.error, 'Internal Server Error');
    assert.strictEqual(json.reqId, ctx.reqId);
  });
});

describe('RequestContext Unit Tests', () => {
  it('assigns unique reqId and monotonic startTime', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const ctx = createRequestContext(req, res);

    assert(typeof ctx.reqId === 'string');
    assert(ctx.reqId.startsWith('req_'));
    assert(typeof ctx.startTime === 'bigint');
  });

  it('normalizes loopback IP addresses', () => {
    assert.strictEqual(normalizeIp('::ffff:127.0.0.1'), '127.0.0.1');
    assert.strictEqual(normalizeIp('::1'), '127.0.0.1');
    assert.strictEqual(normalizeIp('127.0.0.1'), '127.0.0.1');
    assert.strictEqual(normalizeIp('::ffff:192.168.1.5'), '192.168.1.5');
  });

  it('identifies local loopback requests without simulated IP', () => {
    const req = createMockRequest({ remoteAddress: '127.0.0.1' });
    const res = createMockResponse();
    const ctx = createRequestContext(req, res);

    assert.strictEqual(ctx.clientIp, '127.0.0.1');
    assert.strictEqual(ctx.isLoopback, true);
  });

  it('overrides loopback trust when x-simulate-remote-ip is present', () => {
    const req = createMockRequest({
      remoteAddress: '127.0.0.1',
      headers: { 'x-simulate-remote-ip': '192.168.31.250' },
    });
    const res = createMockResponse();
    const ctx = createRequestContext(req, res);

    assert.strictEqual(ctx.clientIp, '192.168.31.250');
    assert.strictEqual(ctx.isLoopback, false);
    assert.strictEqual(ctx.isSimulatedRemote, true);
  });

  it('sendJson attaches correlation ID and prevents wildcard * origin', () => {
    const req = createMockRequest({
      headers: { origin: 'http://localhost:5173' },
    });
    const res = createMockResponse();
    const ctx = createRequestContext(req, res);

    // Explicitly test wildcard prevention
    ctx.sendJson(200, { ok: true }, { 'Access-Control-Allow-Origin': '*' });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.getHeader('X-Request-Id'), ctx.reqId);
    assert.strictEqual(res.getHeader('Access-Control-Allow-Origin'), 'http://localhost:5173');
    assert.strictEqual(res.getHeader('Content-Type'), 'application/json');
  });

  it('sendError formats 401 with tokenExpired and requiresPairing flags', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const ctx = createRequestContext(req, res);
    ctx.auth.tokenExpired = true;

    ctx.sendError(401);

    assert.strictEqual(res.statusCode, 401);
    const json = res.getJson();
    assert.strictEqual(json.code, 401);
    assert.strictEqual(json.tokenExpired, true);
    assert.strictEqual(json.requiresPairing, true);
    assert(json.error.includes('expired after 30 days'));
  });

  it('sendError formats 429 with standard Retry-After header', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const ctx = createRequestContext(req, res);

    ctx.sendError(429, 'Rate limit triggered', 'RATE_LIMITED', { retryAfter: 20 });

    assert.strictEqual(res.statusCode, 429);
    assert.strictEqual(res.getHeader('Retry-After'), '20');
    const json = res.getJson();
    assert.strictEqual(json.status, 'rejected');
    assert.strictEqual(json.error, 'RATE_LIMITED');
    assert.strictEqual(json.retryAfter, 20);
  });
});
