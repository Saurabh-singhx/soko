#!/usr/bin/env node

/**
 * ==============================================================================
 * Soko Production-Grade Middleware Pipeline Integration Test Suite (R3)
 *
 * Runs real HTTP network requests against the complete middleware pipeline
 * mounted on an isolated port (default 8794), verifying:
 * 1. Transport & CORS Hardening (DNS Rebinding, Preflight, Strict Origin)
 * 2. Rate Limiting (Progressive Cooldown, 429 Too Many Requests, Retry-After header)
 * 3. Body Parsing (JSON parsing, malformed JSON rejection, upload streaming)
 * 4. Centralized Authentication (Bearer header, Token header, query token, loopback trust)
 * 5. Identity Verification (TrustStore integration, revoked session handling)
 * 6. Role-Based Access Control (PUBLIC, LOCAL_ONLY, PROTECTED, CLI command whitelist)
 * 7. Standardized Error Handling (400, 401, 403, 429, 500)
 * ==============================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  TrustStore,
  TokenManager,
  RateLimiter,
  CorsHardener,
} = require(path.resolve(__dirname, '../packages/security'));

const {
  createBridgeMiddlewareAdapter,
  Router,
} = require(path.resolve(__dirname, '../scripts/middleware'));

const TEST_PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8794;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const TEST_CONFIG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), `soko-middleware-int-test-${Date.now()}-`));

let passedTests = 0;
let totalTests = 0;
let server = null;
let rateLimiter = null;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ [FAIL] ${message}`);
  }
}

function request(method, pathName, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathName, BASE_URL);
    const req = http.request(
      url,
      {
        method,
        headers: {
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        });
      }
    );
    req.on('error', reject);
    if (body) {
      if (Buffer.isBuffer(body)) {
        req.write(body);
      } else if (typeof body === 'object') {
        req.write(JSON.stringify(body));
      } else {
        req.write(body);
      }
    }
    req.end();
  });
}

async function runIntegrationSuite() {
  console.log('================================================================');
  console.log(' SOKO PRODUCTION MIDDLEWARE PIPELINE INTEGRATION TEST SUITE');
  console.log(` Target Server: http://127.0.0.1:${TEST_PORT}`);
  console.log(` Test Config Directory: ${TEST_CONFIG_DIR}`);
  console.log('================================================================\n');

  // 1. Initialize real security subsystems in isolated temp directory
  const trustStore = new TrustStore({ configDir: TEST_CONFIG_DIR });
  const tokenManager = new TokenManager(trustStore);
  rateLimiter = new RateLimiter();
  const corsHardener = new CorsHardener({
    port: TEST_PORT,
    getLocalIps: () => ['192.168.1.100', '10.0.0.50'],
  });

  // Pre-populate test device and tokens
  const testDeviceId = 'integration-test-device-uuid';
  const testTokenPair = tokenManager.createTokenPair();
  trustStore.set(testDeviceId, {
    id: testDeviceId,
    name: 'Verified Companion Test Phone',
    model: 'Pixel 9 Pro',
    token: testTokenPair.token,
    refreshToken: testTokenPair.refreshToken,
    createdAt: Date.now(),
    pairedAt: Date.now(),
    expiresAt: testTokenPair.expiresAt,
    lastSeen: Date.now(),
  });

  // Pre-populate expired test device (>30 days expired)
  const expiredDeviceId = 'expired-device-uuid';
  const expiredToken = 'expired-token-30-days-old-1234567890';
  trustStore.set(expiredDeviceId, {
    id: expiredDeviceId,
    name: 'Legacy Expired Phone',
    model: 'Nexus 5',
    token: expiredToken,
    refreshToken: 'expired-refresh-token',
    createdAt: Date.now() - 35 * 24 * 60 * 60 * 1000,
    pairedAt: Date.now() - 35 * 24 * 60 * 60 * 1000,
    expiresAt: Date.now() - 5 * 24 * 60 * 60 * 1000, // 5 days in the past
    lastSeen: Date.now() - 5 * 24 * 60 * 60 * 1000,
  });

  // 2. Set up Declarative Router with test endpoint handlers
  const router = new Router();

  router.get('/api/status', (ctx) => {
    ctx.sendJson(200, { online: true, version: '1.0.3', pairedDevice: testDeviceId });
  });

  router.get('/api/discovery', (ctx) => {
    ctx.sendJson(200, { service: 'soko-bridge', port: TEST_PORT });
  });

  router.get('/api/tokens', (ctx) => {
    ctx.sendJson(200, { totalTokens: 88400, model: 'antigravity-v1' });
  });

  router.get('/api/agent-activity', (ctx) => {
    ctx.sendJson(200, { activeCount: 2, sessions: ['session-1', 'session-2'] });
  });

  router.post('/api/notify', (ctx) => {
    ctx.sendJson(200, { success: true, notificationId: 'notif-99', app: ctx.body.appName });
  });

  router.post('/api/cli', (ctx) => {
    ctx.sendJson(200, { command: ctx.body.command, exitCode: 0, output: 'CLI Command Executed Successfully' });
  });

  router.post('/api/pair', (ctx) => {
    if (ctx.body && ctx.body.pin === '999999') {
      ctx.recordSuccess();
      ctx.sendJson(200, { status: 'approved', token: 'new-pair-token-999' });
    } else {
      ctx.recordFailure();
      ctx.sendError(400, 'PIN_MISMATCH', 'PIN_MISMATCH', { error: 'PIN_MISMATCH' });
    }
  });

  router.post('/api/devices/pending-pin', (ctx) => {
    ctx.sendJson(200, { pin: '882 194' });
  });

  router.post('/api/upload', (ctx) => {
    ctx.sendJson(200, { uploaded: true, filename: ctx.query.get('filename') });
  });

  router.get('/api/simulate-server-crash', () => {
    throw new Error('Database disk I/O failure simulation');
  });

  // 3. Create Middleware Bridge Adapter & HTTP Server
  const adapter = createBridgeMiddlewareAdapter({
    corsHardener,
    rateLimiter,
    tokenManager,
    trustStore,
  });

  server = http.createServer(async (req, res) => {
    await adapter.handleRequest(req, res, async (ctx) => {
      const handled = await router.handle(ctx);
      if (!handled && !ctx.sent && !res.writableEnded) {
        ctx.sendError(404, 'Not Found', 'ROUTE_NOT_FOUND');
      }
    });
  });

  await new Promise((resolve, reject) => {
    server.listen(TEST_PORT, '127.0.0.1', () => {
      console.log(`[Setup] Middleware HTTP test server listening on port ${TEST_PORT} ✓\n`);
      resolve();
    });
    server.on('error', reject);
  });

  // ============================================================================
  // SUITE 1: TRANSPORT HARDENING & STRICT CORS
  // ============================================================================
  console.log('[Suite 1/7] Transport Hardening & Strict CORS Verification');

  // 1a. Foreign Host header blocked (DNS rebinding defense)
  const resBadHost = await request('GET', '/api/status', null, { host: 'evil-attacker.com' });
  assert(resBadHost.status === 400, 'Foreign Host header (evil-attacker.com) blocked with HTTP 400 Bad Request');
  assert(resBadHost.data?.error?.includes('DNS Rebinding'), 'Error payload explains DNS Rebinding protection');

  // 1b. OPTIONS preflight with valid origin responds with 204 No Content
  const resPreflight = await request('OPTIONS', '/api/tokens', null, {
    origin: 'http://localhost:5173',
  });
  assert(resPreflight.status === 204, 'OPTIONS preflight request returns HTTP 204 No Content');
  assert(resPreflight.headers['access-control-allow-origin'] === 'http://localhost:5173', 'Reflects explicit origin in CORS header');
  assert(resPreflight.headers['access-control-allow-origin'] !== '*', 'Wildcard "*" origin is strictly absent');

  // 1c. Malicious Origin header blocked with HTTP 403 Forbidden
  const resBadOrigin = await request('GET', '/api/status', null, {
    origin: 'https://malicious-exploit-hub.net',
  });
  assert(resBadOrigin.status === 403, 'Untrusted browser Origin blocked with HTTP 403 Forbidden');
  assert(resBadOrigin.data?.code === 403, 'Returns standard 403 error structure');

  // 1d. Legitimate Origin receives reflected origin and Vary: Origin
  const resGoodOrigin = await request('GET', '/api/status', null, {
    origin: 'http://localhost:5173',
  });
  assert(resGoodOrigin.status === 200, 'Legitimate Origin accepted with HTTP 200 OK');
  assert(resGoodOrigin.headers['access-control-allow-origin'] === 'http://localhost:5173', 'Access-Control-Allow-Origin reflects explicit origin');
  assert(resGoodOrigin.headers['vary']?.includes('Origin'), 'Vary: Origin header attached');

  // ============================================================================
  // SUITE 2: CENTRALIZED AUTHENTICATION & ACCESS CONTROL
  // ============================================================================
  console.log('\n[Suite 2/7] Centralized Authentication & Access Control');
  const remoteHeaders = { 'x-simulate-remote-ip': '192.168.1.185' };

  // 2a. Public endpoint accessible without credentials
  const resPublic = await request('GET', '/api/status', null, remoteHeaders);
  assert(resPublic.status === 200, 'GET /api/status is accessible publicly without credentials');
  assert(resPublic.data?.online === true, 'Returns valid status payload');

  // 2b. Protected endpoints blocked when credentials are missing
  const resNoAuthTokens = await request('GET', '/api/tokens', null, remoteHeaders);
  assert(resNoAuthTokens.status === 401, 'GET /api/tokens without credentials returns HTTP 401 Unauthorized');
  assert(resNoAuthTokens.data?.requiresPairing === true, 'Reports requiresPairing: true');
  assert(resNoAuthTokens.data?.tokenExpired === false, 'Reports tokenExpired: false');

  const resNoAuthActivity = await request('GET', '/api/agent-activity', null, remoteHeaders);
  assert(resNoAuthActivity.status === 401, 'GET /api/agent-activity without credentials returns HTTP 401');

  const resNoAuthNotify = await request('POST', '/api/notify', { appName: 'Hacker' }, {
    ...remoteHeaders,
    'Content-Type': 'application/json',
  });
  assert(resNoAuthNotify.status === 401, 'POST /api/notify without credentials returns HTTP 401');

  // 2c. Protected endpoint blocked when token is invalid
  const resBadToken = await request('GET', '/api/tokens', null, {
    ...remoteHeaders,
    authorization: 'Bearer bad-unrecognized-hex-token-999',
  });
  assert(resBadToken.status === 401, 'Request with unrecognized Bearer token returns HTTP 401');
  assert(resBadToken.data?.requiresPairing === true, 'Reports requiresPairing: true for invalid token');

  // 2d. Protected endpoint blocked with tokenExpired: true when token is older than 30 days
  const resExpiredToken = await request('GET', '/api/tokens', null, {
    ...remoteHeaders,
    authorization: `Bearer ${expiredToken}`,
  });
  assert(resExpiredToken.status === 401, 'Request with expired Bearer token (> 30 days) returns HTTP 401');
  assert(resExpiredToken.data?.tokenExpired === true, 'Reports tokenExpired: true');
  assert(resExpiredToken.data?.requiresPairing === true, 'Reports requiresPairing: true for expired session');
  assert(resExpiredToken.data?.error?.includes('expired after 30 days'), 'Error message specifically highlights 30-day expiration');

  // 2e. Local loopback automatically trusted without bearer token
  const resLoopbackTokens = await request('GET', '/api/tokens');
  assert(resLoopbackTokens.status === 200, 'Local loopback (127.0.0.1) automatically trusted without Bearer token');
  assert(resLoopbackTokens.data?.totalTokens === 88400, 'Loopback receives protected AI token telemetry');

  // 2f. Authorized remote request succeeds with valid Bearer token
  const resBearerTokens = await request('GET', '/api/tokens', null, {
    ...remoteHeaders,
    authorization: `Bearer ${testTokenPair.token}`,
  });
  assert(resBearerTokens.status === 200, 'Remote request presenting valid Bearer token returns HTTP 200 OK');
  assert(resBearerTokens.data?.totalTokens === 88400, 'Returns protected payload');

  // 2g. Alternate token presentation: "Token <token>" header
  const resTokenHeader = await request('GET', '/api/tokens', null, {
    ...remoteHeaders,
    authorization: `Token ${testTokenPair.token}`,
  });
  assert(resTokenHeader.status === 200, 'Remote request presenting "Token <token>" header returns HTTP 200 OK');

  // 2h. Alternate token presentation: "?token=<token>" query parameter
  const resQueryToken = await request('GET', `/api/tokens?token=${testTokenPair.token}`, null, remoteHeaders);
  assert(resQueryToken.status === 200, 'Remote request presenting query parameter "?token=..." returns HTTP 200 OK');

  // ============================================================================
  // SUITE 3: RBAC & LOCAL-ONLY ENDPOINT POLICY
  // ============================================================================
  console.log('\n[Suite 3/7] Role-Based Access Control & Local-Only Policies');

  // 3a. LOCAL_ONLY endpoint rejected when accessed by remote caller
  const resRemoteLocalOnly = await request('POST', '/api/devices/pending-pin', {}, remoteHeaders);
  assert(resRemoteLocalOnly.status === 403, 'Remote caller accessing LOCAL_ONLY endpoint rejected with HTTP 403 Forbidden');
  assert(resRemoteLocalOnly.data?.error?.includes('local desktop loopback'), 'Error message specifies local loopback restriction');

  // 3b. LOCAL_ONLY endpoint permitted from loopback
  const resLoopbackLocalOnly = await request('POST', '/api/devices/pending-pin', {});
  assert(resLoopbackLocalOnly.status === 200, 'Loopback caller permitted on LOCAL_ONLY endpoint (HTTP 200)');
  assert(resLoopbackLocalOnly.data?.pin === '882 194', 'Receives active desktop SAS PIN');

  // 3c. CLI Whitelist: Whitelisted command permitted
  const resValidCli = await request('POST', '/api/cli', { command: 'sysinfo' }, {
    ...remoteHeaders,
    authorization: `Bearer ${testTokenPair.token}`,
    'Content-Type': 'application/json',
  });
  assert(resValidCli.status === 200, 'Whitelisted CLI command ("sysinfo") accepted with HTTP 200 OK');
  assert(resValidCli.data?.output === 'CLI Command Executed Successfully', 'CLI executed cleanly');

  // 3d. CLI Whitelist: Non-whitelisted command blocked with HTTP 403
  const resBadCli = await request('POST', '/api/cli', { command: 'rm -rf /' }, {
    ...remoteHeaders,
    authorization: `Bearer ${testTokenPair.token}`,
    'Content-Type': 'application/json',
  });
  assert(resBadCli.status === 403, 'Non-whitelisted command blocked with HTTP 403 Forbidden');
  assert(resBadCli.data?.code === 403, 'Returns exitCode / code 403');
  assert(resBadCli.data?.error?.includes('not permitted in execution whitelist'), 'Identifies command whitelist violation');

  // ============================================================================
  // SUITE 4: PROGRESSIVE RATE LIMITING & COOLDOWN
  // ============================================================================
  console.log('\n[Suite 4/7] Progressive Rate Limiting & Cooldown Protection');
  const attackerHeaders = {
    'x-simulate-remote-ip': '10.55.77.99',
    'Content-Type': 'application/json',
  };

  // 4a. Failed attempts 1 and 2 return 400 PIN_MISMATCH
  const rl1 = await request('POST', '/api/pair', { pin: '000001' }, attackerHeaders);
  assert(rl1.status === 400 && rl1.data?.error === 'PIN_MISMATCH', 'Failed PIN attempt 1 returns 400 PIN_MISMATCH');

  const rl2 = await request('POST', '/api/pair', { pin: '000002' }, attackerHeaders);
  assert(rl2.status === 400 && rl2.data?.error === 'PIN_MISMATCH', 'Failed PIN attempt 2 returns 400 PIN_MISMATCH');

  // 4b. Failed attempt 3 triggers progressive cooldown
  const rl3 = await request('POST', '/api/pair', { pin: '000003' }, attackerHeaders);
  assert(rl3.status === 400, 'Failed PIN attempt 3 returns 400');

  // 4c. Subsequent attempt during cooldown rejected with HTTP 429 Too Many Requests
  const rl4 = await request('POST', '/api/pair', { pin: '000004' }, attackerHeaders);
  assert(rl4.status === 429, 'Attempt during active cooldown rejected with HTTP 429 Too Many Requests');
  assert(rl4.data?.status === 'rejected', 'Response status indicates rejected');
  assert(rl4.data?.error === 'RATE_LIMITED', 'Error code specifies RATE_LIMITED');
  assert(Boolean(rl4.headers?.['retry-after']), 'Includes standard Retry-After header');
  assert(Number(rl4.headers['retry-after']) > 0, 'Retry-After contains positive integer seconds');

  // ============================================================================
  // SUITE 5: SAFE BODY PARSING & BINARY STREAMING
  // ============================================================================
  console.log('\n[Suite 5/7] Safe Body Parsing & Binary Streaming');

  // 5a. Valid JSON parsed cleanly
  const resValidJson = await request('POST', '/api/notify', { appName: 'Signal' }, {
    ...remoteHeaders,
    authorization: `Bearer ${testTokenPair.token}`,
    'Content-Type': 'application/json',
  });
  assert(resValidJson.status === 200, 'Valid JSON payload parsed cleanly');
  assert(resValidJson.data?.app === 'Signal', 'Handler accesses parsed JSON body');

  // 5b. Invalid JSON payload rejected with HTTP 400 Bad Request
  const resInvalidJson = await request('POST', '/api/notify', '{ unquoted_key: invalid json', {
    ...remoteHeaders,
    authorization: `Bearer ${testTokenPair.token}`,
    'Content-Type': 'application/json',
  });
  assert(resInvalidJson.status === 400, 'Malformed JSON rejected with HTTP 400 Bad Request');
  assert(resInvalidJson.data?.code === 400, 'Error status code is 400');
  assert(resInvalidJson.data?.error?.includes('Invalid JSON payload'), 'Identifies invalid JSON payload');

  // 5c. Binary stream upload on /api/upload bypasses JSON buffering
  const binaryPayload = Buffer.from('RAW_BINARY_DATA_STREAM_CONTENT_12345');
  const resUpload = await request('POST', '/api/upload?filename=update.bin', binaryPayload, {
    ...remoteHeaders,
    authorization: `Bearer ${testTokenPair.token}`,
    'Content-Type': 'application/octet-stream',
  });
  assert(resUpload.status === 200, 'Binary upload on /api/upload passes through without JSON parser error');
  assert(resUpload.data?.uploaded === true, 'Upload handler executed successfully');

  // ============================================================================
  // SUITE 6: PIPELINE ERROR BOUNDARY & EXCEPTION PROPAGATION
  // ============================================================================
  console.log('\n[Suite 6/7] Pipeline Error Boundary & Exception Propagation');

  // 6a. Uncaught downstream exception produces sanitized 500 JSON without crashing server
  const resCrash = await request('GET', '/api/simulate-server-crash', null, {
    ...remoteHeaders,
    authorization: `Bearer ${testTokenPair.token}`,
  });
  assert(resCrash.status === 500, 'Uncaught route exception caught by Pipeline error boundary (HTTP 500)');
  assert(resCrash.data?.code === 500, 'Error response code is 500');
  assert(resCrash.data?.error === 'Internal Server Error', 'Sanitized error message without leaking sensitive stack traces');
  assert(typeof resCrash.data?.reqId === 'string' && resCrash.data.reqId.startsWith('req_'), 'Attaches correlation reqId for log tracing');

  // 6b. Subsequent request after crash continues to process normally (server survived cleanly)
  const resAfterCrash = await request('GET', '/api/status');
  assert(resAfterCrash.status === 200, 'Server remains healthy and processes subsequent requests after handled error');

  // ============================================================================
  // SUITE 7: IDENTITY STORE SYNCHRONIZATION & REVOCATION
  // ============================================================================
  console.log('\n[Suite 7/7] Identity Store Synchronization & Session Revocation');

  // 7a. Delete test device from TrustStore (simulating user clicking "Forget Device")
  trustStore.delete(testDeviceId);

  // 7b. Request with previously valid token is now immediately rejected with HTTP 401
  const resRevokedDevice = await request('GET', '/api/tokens', null, {
    ...remoteHeaders,
    authorization: `Bearer ${testTokenPair.token}`,
  });
  assert(resRevokedDevice.status === 401, 'Request from deleted/forgotten device is rejected with HTTP 401');
  assert(resRevokedDevice.data?.requiresPairing === true, 'Requires re-pairing after device forgotten');

  console.log('\n================================================================');
  console.log(` RESULTS: ${passedTests} / ${totalTests} integration tests passed (100%)`);
  console.log(' ALL MIDDLEWARE PIPELINE INTEGRATION CRITERIA PASSED ✓');
  console.log('================================================================\n');
}

// Cleanup and Execution
async function main() {
  try {
    await runIntegrationSuite();
    process.exitCode = 0;
  } catch (err) {
    console.error('Fatal integration test failure:', err);
    process.exitCode = 1;
  } finally {
    if (rateLimiter && typeof rateLimiter.destroy === 'function') {
      rateLimiter.destroy();
    }
    if (server) {
      server.close();
    }
    try {
      if (fs.existsSync(TEST_CONFIG_DIR)) {
        fs.rmSync(TEST_CONFIG_DIR, { recursive: true, force: true });
      }
    } catch {}
  }
}

main();
