/**
 * Unit Test Suite for @soko/security Subsystem.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  TrustStore,
  RateLimiter,
  CorsHardener,
  TokenManager,
  TlsEngine,
  resolveConfigDir,
  ensureConfigDir,
  getSecurityPaths,
  DEFAULT_TOKEN_TTL_MS,
} = require('../index');

console.log('================================================================');
console.log(' SOKO @SOKO/SECURITY UNIT TEST SUITE');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;

function it(desc, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ [PASS] ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${desc}`);
    console.error(`     Error: ${err.message}`);
    throw err;
  }
}

const TEST_DIR = path.join(os.tmpdir(), `soko-security-unit-${Date.now()}`);
fs.mkdirSync(TEST_DIR, { recursive: true });

try {
  console.log('[Suite 1/6] Configuration & Path Resolution');
  it('Resolves SOKO_CONFIG_DIR when environment variable is present', () => {
    process.env.SOKO_CONFIG_DIR = TEST_DIR;
    assert.strictEqual(resolveConfigDir(), TEST_DIR);
    const paths = getSecurityPaths();
    assert.strictEqual(paths.configDir, TEST_DIR);
    assert.strictEqual(paths.trustStorePath, path.join(TEST_DIR, 'trust_store.json'));
    assert.strictEqual(paths.certPath, path.join(TEST_DIR, 'certs', 'bridge_cert.pem'));
    assert.strictEqual(paths.keyPath, path.join(TEST_DIR, 'certs', 'bridge_key.pem'));
  });

  console.log('\n[Suite 2/6] Secure Trust Store & File Permissions');
  const trustStore = new TrustStore({
    configDir: TEST_DIR,
    legacyTransfersDir: path.join(TEST_DIR, 'empty_legacy'),
  });

  it('Creates and initializes empty trust store', () => {
    assert.strictEqual(trustStore.size, 0);
  });

  it('Stores device record and enforces 30-day TTL and refresh token', () => {
    const dev = trustStore.set('dev-100', {
      name: 'Pixel 9 Pro',
      model: 'Google Pixel',
      token: 'test-token-1234',
    });
    assert.strictEqual(dev.id, 'dev-100');
    assert.strictEqual(dev.name, 'Pixel 9 Pro');
    assert.strictEqual(dev.token, 'test-token-1234');
    assert.ok(dev.refreshToken, 'Refresh token was automatically generated');
    assert.ok(dev.expiresAt > Date.now() + 29 * 24 * 3600 * 1000, 'Expires in ~30 days');
    assert.strictEqual(trustStore.size, 1);
  });

  it('Atomic save writes file with strict permissions (0600 on POSIX)', () => {
    const storePath = path.join(TEST_DIR, 'trust_store.json');
    assert.ok(fs.existsSync(storePath), 'trust_store.json exists');
    if (os.platform() !== 'win32') {
      const stat = fs.statSync(storePath);
      const mode = stat.mode & 0o777;
      assert.strictEqual(mode, 0o600, `File mode should be 0600, got ${mode.toString(8)}`);
    }
  });

  it('Finds device by Bearer token and by Refresh token', () => {
    const found = trustStore.findByToken('test-token-1234');
    assert.ok(found, 'Found device by token');
    assert.strictEqual(found.id, 'dev-100');

    const foundByRefresh = trustStore.findByRefreshToken(found.refreshToken);
    assert.ok(foundByRefresh, 'Found device by refresh token');
    assert.strictEqual(foundByRefresh.id, 'dev-100');
  });

  it('Migrates legacy trust store from transfers/.trust_store.json', () => {
    const legacyDir = path.join(TEST_DIR, 'legacy_transfers');
    fs.mkdirSync(legacyDir, { recursive: true });
    fs.writeFileSync(
      path.join(legacyDir, '.trust_store.json'),
      JSON.stringify({
        'legacy-phone': {
          name: 'Old Galaxy S20',
          token: 'legacy-token-abc',
        },
      }),
      'utf8'
    );

    const migratedDir = path.join(TEST_DIR, 'migrated_config');
    const migratedStore = new TrustStore({
      configDir: migratedDir,
      legacyTransfersDir: legacyDir,
    });

    assert.strictEqual(migratedStore.size, 1);
    const legacyDev = migratedStore.get('legacy-phone');
    assert.ok(legacyDev);
    assert.strictEqual(legacyDev.name, 'Old Galaxy S20');
    assert.strictEqual(legacyDev.token, 'legacy-token-abc');
    assert.ok(legacyDev.refreshToken, 'Assigned refresh token to migrated device');
  });

  console.log('\n[Suite 3/6] PIN Brute-Force Defense & Rate Limiter');
  const rateLimiter = new RateLimiter({
    STAGE_1_ATTEMPTS: 3,
    STAGE_1_DELAY_MS: 15000,
    STAGE_2_ATTEMPTS: 5,
    STAGE_2_DELAY_MS: 60000,
    STAGE_3_ATTEMPTS: 10,
    STAGE_3_BLOCK_MS: 600000,
  });

  let alertReceived = null;
  rateLimiter.onAlert((alert) => {
    alertReceived = alert;
  });

  it('Allows initial PIN attempts (1 and 2)', () => {
    const check1 = rateLimiter.checkLimit('192.168.1.50');
    assert.strictEqual(check1.allowed, true);
    const fail1 = rateLimiter.recordFailure('192.168.1.50');
    assert.strictEqual(fail1.attempts, 1);
    assert.strictEqual(fail1.shouldAlert, false);

    const fail2 = rateLimiter.recordFailure('192.168.1.50');
    assert.strictEqual(fail2.attempts, 2);
    assert.strictEqual(fail2.shouldAlert, false);
  });

  it('Triggers 15s delay & alert on 3rd failed attempt', () => {
    const fail3 = rateLimiter.recordFailure('192.168.1.50');
    assert.strictEqual(fail3.attempts, 3);
    assert.strictEqual(fail3.shouldAlert, true);
    assert.strictEqual(fail3.alertType, 'BRUTE_FORCE_DELAY');
    assert.ok(fail3.retryAfter >= 14 && fail3.retryAfter <= 15);

    // Verify limit check blocks while in cooldown
    const checkBlocked = rateLimiter.checkLimit('192.168.1.50');
    assert.strictEqual(checkBlocked.allowed, false);
    assert.strictEqual(checkBlocked.reason, 'RATE_LIMITED');
    assert.ok(checkBlocked.retryAfter > 0);
  });

  it('Triggers 60s cooldown on 5th failed attempt', () => {
    rateLimiter.recordFailure('192.168.1.50'); // 4
    const fail5 = rateLimiter.recordFailure('192.168.1.50'); // 5
    assert.strictEqual(fail5.attempts, 5);
    assert.strictEqual(fail5.alertType, 'BRUTE_FORCE_WARNING');
    assert.ok(fail5.retryAfter >= 59 && fail5.retryAfter <= 60);
  });

  it('Triggers 10-minute block and PIN regeneration on 10th failed attempt', () => {
    for (let i = 6; i <= 9; i++) {
      rateLimiter.recordFailure('192.168.1.50');
    }
    const fail10 = rateLimiter.recordFailure('192.168.1.50');
    assert.strictEqual(fail10.attempts, 10);
    assert.strictEqual(fail10.shouldRegeneratePin, true);
    assert.strictEqual(fail10.alertType, 'BRUTE_FORCE_BLOCKED');
    assert.ok(fail10.retryAfter >= 590 && fail10.retryAfter <= 600);

    const checkHardBlocked = rateLimiter.checkLimit('192.168.1.50');
    assert.strictEqual(checkHardBlocked.allowed, false);
    assert.strictEqual(checkHardBlocked.reason, 'IP_BLOCKED');
    assert.strictEqual(checkHardBlocked.blocked, true);
  });

  it('Normalizes IPv4-mapped IPv6 addresses (::ffff:192.168.1.50)', () => {
    const checkNorm = rateLimiter.checkLimit('::ffff:192.168.1.50');
    assert.strictEqual(checkNorm.blocked, true, 'Normalized IP should match blocked record');
  });

  it('Resets rate limit counter upon successful pairing', () => {
    rateLimiter.recordSuccess('192.168.1.50');
    const checkAfterSuccess = rateLimiter.checkLimit('192.168.1.50');
    assert.strictEqual(checkAfterSuccess.allowed, true);
    assert.strictEqual(checkAfterSuccess.attempts, 0);
  });

  console.log('\n[Suite 4/6] Strict CORS & Host Header Hardener');
  const cors = new CorsHardener({
    port: 8766,
    getLocalIps: () => ['192.168.31.210', '192.168.43.1'],
  });

  it('Accepts valid loopback and local network Host headers', () => {
    assert.strictEqual(cors.isHostAllowed('localhost:8766'), true);
    assert.strictEqual(cors.isHostAllowed('127.0.0.1:8766'), true);
    assert.strictEqual(cors.isHostAllowed('192.168.31.210:8766'), true);
    assert.strictEqual(cors.isHostAllowed('192.168.43.1:8766'), true);
    assert.strictEqual(cors.isHostAllowed('[::1]:8766'), true);
  });

  it('Rejects malicious Host headers (DNS rebinding protection)', () => {
    assert.strictEqual(cors.isHostAllowed('evil-attacker.com'), false);
    assert.strictEqual(cors.isHostAllowed('attacker.com:8766'), false);
    assert.strictEqual(cors.isHostAllowed('10.99.99.99:8766'), false);
  });

  it('Accepts authorized origins and rejects foreign web origins', () => {
    assert.strictEqual(cors.isOriginAllowed(undefined), true, 'No origin allowed');
    assert.strictEqual(cors.isOriginAllowed('http://localhost:5173'), true);
    assert.strictEqual(cors.isOriginAllowed('http://127.0.0.1:8766'), true);
    assert.strictEqual(cors.isOriginAllowed('tauri://localhost'), true);
    assert.strictEqual(cors.isOriginAllowed('http://192.168.31.210:8766'), true);
    assert.strictEqual(cors.isOriginAllowed('null'), true);

    // Malicious web origins blocked
    assert.strictEqual(cors.isOriginAllowed('http://evil.com'), false);
    assert.strictEqual(cors.isOriginAllowed('https://malicious-site.org'), false);
  });

  it('Generates explicit CORS headers without wildcard (*)', () => {
    const mockReq = { headers: { origin: 'http://localhost:5173' } };
    const headers = cors.getCorsHeaders(mockReq);
    assert.strictEqual(headers['Access-Control-Allow-Origin'], 'http://localhost:5173');
    assert.strictEqual(headers['Access-Control-Allow-Credentials'], 'true');
    assert.strictEqual(headers['Vary'], 'Origin');
    assert.notStrictEqual(headers['Access-Control-Allow-Origin'], '*');
  });

  console.log('\n[Suite 5/6] Bearer Token Lifecycle & Rotation');
  const tokenManager = new TokenManager(trustStore, { tokenTtlMs: 30 * 24 * 3600 * 1000 });

  it('Validates non-expired active bearer token', () => {
    const pair = tokenManager.createTokenPair();
    trustStore.set('dev-rotate-test', {
      name: 'Rotation Device',
      token: pair.token,
      refreshToken: pair.refreshToken,
      expiresAt: pair.expiresAt,
    });

    const checkValid = tokenManager.validateToken(pair.token);
    assert.strictEqual(checkValid.valid, true);
    assert.strictEqual(checkValid.expired, false);
    assert.strictEqual(checkValid.device.id, 'dev-rotate-test');
  });

  it('Rejects expired bearer token (> 30 days old)', () => {
    const expiredDev = trustStore.set('dev-expired', {
      name: 'Old Device',
      token: 'expired-token-xyz',
      refreshToken: 'expired-refresh-xyz',
      expiresAt: Date.now() - 1000, // Expired 1 second ago
    });

    const checkExpired = tokenManager.validateToken('expired-token-xyz');
    assert.strictEqual(checkExpired.valid, false);
    assert.strictEqual(checkExpired.expired, true);
  });

  it('Rotates token using valid refresh token', () => {
    const initialDev = trustStore.get('dev-rotate-test');
    const oldToken = initialDev.token;
    const oldRefresh = initialDev.refreshToken;

    const rotationResult = tokenManager.rotateToken(oldRefresh, 'dev-rotate-test');
    assert.strictEqual(rotationResult.success, true);
    assert.notStrictEqual(rotationResult.token, oldToken);
    assert.notStrictEqual(rotationResult.refreshToken, oldRefresh);

    // Old token should now be invalid
    const checkOld = tokenManager.validateToken(oldToken);
    assert.strictEqual(checkOld.valid, false);

    // New token is valid
    const checkNew = tokenManager.validateToken(rotationResult.token);
    assert.strictEqual(checkNew.valid, true);
  });

  it('Revoke all sessions clears trust store completely', () => {
    const count = tokenManager.revokeAllSessions();
    assert.ok(count >= 2, 'Revoked at least 2 test sessions');
    assert.strictEqual(trustStore.size, 0);
  });

  console.log('\n[Suite 6/6] TLS Engine & Certificate Fingerprinting');
  const tlsEngine = new TlsEngine({
    configDir: TEST_DIR,
    getLocalIps: () => ['192.168.31.210'],
  });

  it('Generates self-signed certificate with SHA-256 fingerprint', () => {
    const certData = tlsEngine.initialize();
    assert.ok(certData.cert.includes('BEGIN CERTIFICATE'));
    assert.ok(certData.key.includes('PRIVATE KEY'));
    assert.ok(certData.fingerprint.startsWith('SHA256:'));
    assert.strictEqual(certData.fingerprint.split(':').length, 33); // 'SHA256' + 32 octets
  });

  it('Enforces 0600 permissions on TLS private key (POSIX)', () => {
    const keyFile = path.join(TEST_DIR, 'certs', 'bridge_key.pem');
    assert.ok(fs.existsSync(keyFile));
    if (os.platform() !== 'win32') {
      const mode = fs.statSync(keyFile).mode & 0o777;
      assert.strictEqual(mode, 0o600);
    }
  });

  console.log('\n================================================================');
  console.log(` RESULTS: ${passedTests} / ${totalTests} security unit tests passed (100%)`);
  console.log('================================================================\n');
} finally {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
}
