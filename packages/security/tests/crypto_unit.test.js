/**
 * Comprehensive Unit Test Suite for Soko Cryptography & Envelope Subsystem.
 */

const assert = require('assert');
const {
  CRYPTO_CONSTANTS,
  ReplayGuard,
  SasPin,
  CertFingerprint,
  KeyExchange,
  EnvelopeCipher,
} = require('../src/crypto');

console.log('================================================================');
console.log(' SOKO CRYPTOGRAPHY & ZERO-TRUST ENVELOPE TEST SUITE');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}`);
    console.error(`    Error: ${err.message}`);
    process.exitCode = 1;
  }
}

// ------------------------------------------------------------------------------
// Suite 1: Ephemeral Key Exchange & Shared Secret Derivation
// ------------------------------------------------------------------------------
console.log('[Suite 1/5] Ephemeral Key Exchange (X25519 & P-256)');

test('Generates valid X25519 ephemeral keypair', () => {
  const kp = KeyExchange.generateEphemeralKeypair('x25519');
  assert.strictEqual(kp.curve, 'x25519');
  assert.ok(Buffer.isBuffer(kp.publicKeyDer));
  assert.ok(kp.publicKeyBase64.length > 20);
});

test('X25519 Diffie-Hellman derives identical 32-byte shared secrets for Alice and Bob', () => {
  const alice = KeyExchange.generateEphemeralKeypair('x25519');
  const bob = KeyExchange.generateEphemeralKeypair('x25519');

  const secretAlice = KeyExchange.computeSharedSecret(alice.privateKey, bob.publicKeyDer);
  const secretBob = KeyExchange.computeSharedSecret(bob.privateKey, alice.publicKeyDer);

  assert.strictEqual(secretAlice.length, 32);
  assert.strictEqual(secretBob.length, 32);
  assert.ok(secretAlice.equals(secretBob), 'Alice and Bob shared secrets must be cryptographically identical');
});

test('Universal P-256 fallback keypair derives identical shared secrets', () => {
  const alice = KeyExchange.generateEphemeralKeypair('prime256v1');
  const bob = KeyExchange.generateEphemeralKeypair('prime256v1');

  const secretAlice = KeyExchange.computeSharedSecret(alice.privateKey, bob.publicKeyDer);
  const secretBob = KeyExchange.computeSharedSecret(bob.privateKey, alice.publicKeyDer);

  assert.strictEqual(secretAlice.length, 32);
  assert.ok(secretAlice.equals(secretBob));
});

test('Derives 32-byte AES-256-GCM session key and 6-digit SAS PIN', () => {
  const alice = KeyExchange.generateEphemeralKeypair('x25519');
  const bob = KeyExchange.generateEphemeralKeypair('x25519');
  const secret = KeyExchange.computeSharedSecret(alice.privateKey, bob.publicKeyDer);

  const artifactsAlice = KeyExchange.deriveSessionArtifacts(secret);
  const artifactsBob = KeyExchange.deriveSessionArtifacts(secret);

  assert.strictEqual(artifactsAlice.sessionKey.length, 32);
  assert.ok(artifactsAlice.sessionKey.equals(artifactsBob.sessionKey));
  assert.strictEqual(artifactsAlice.sasPin.length, 6);
  assert.strictEqual(artifactsAlice.sasPin, artifactsBob.sasPin);
  assert.strictEqual(artifactsAlice.formattedPin, SasPin.format(artifactsAlice.sasPin));
});

// ------------------------------------------------------------------------------
// Suite 2: SAS Confirmation PIN & Constant-Time Verification
// ------------------------------------------------------------------------------
console.log('\n[Suite 2/5] SAS PIN Derivation & Constant-Time Verification');

test('Derives deterministic 6-digit string from fixed secret', () => {
  const mockSecret = Buffer.alloc(32, 0x42);
  const pin1 = SasPin.derive(mockSecret);
  const pin2 = SasPin.derive(mockSecret);
  assert.strictEqual(pin1, pin2);
  assert.strictEqual(pin1.length, 6);
  assert.ok(/^\d{6}$/.test(pin1));
});

test('Formats PIN with space separator for human ergonomics', () => {
  assert.strictEqual(SasPin.format('123456'), '123 456');
  assert.strictEqual(SasPin.format('005021'), '005 021');
  assert.strictEqual(SasPin.format('12 34 56'), '123 456');
});

test('Constant-time PIN verification accurately accepts valid match and rejects mismatch', () => {
  assert.strictEqual(SasPin.verifyConstantTime('482195', '482195'), true);
  assert.strictEqual(SasPin.verifyConstantTime('482 195', '482195'), true);
  assert.strictEqual(SasPin.verifyConstantTime('482194', '482195'), false);
  assert.strictEqual(SasPin.verifyConstantTime('000000', '482195'), false);
});

// ------------------------------------------------------------------------------
// Suite 3: SHA-256 Certificate Fingerprinting & Pinning
// ------------------------------------------------------------------------------
console.log('\n[Suite 3/5] Certificate Fingerprint Verification');

test('Computes and normalizes SHA-256 certificate fingerprint', () => {
  const dummyDer = Buffer.alloc(128, 0xAA);
  const fp = CertFingerprint.compute(dummyDer);
  assert.ok(fp.startsWith('SHA256:'));
  assert.strictEqual(fp.split(':').length, 33); // 'SHA256' + 32 hex bytes
});

test('Constant-time fingerprint verification defends against invalid or altered fingerprints', () => {
  const dummyDer = Buffer.alloc(128, 0xAA);
  const fp = CertFingerprint.compute(dummyDer);

  assert.strictEqual(CertFingerprint.verifyConstantTime(fp, fp), true);
  assert.strictEqual(CertFingerprint.verifyConstantTime(fp, fp.toLowerCase()), true);
  assert.strictEqual(CertFingerprint.verifyConstantTime(fp, 'SHA256:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF'), false);
  assert.strictEqual(CertFingerprint.verifyConstantTime(fp, ''), false);
});

// ------------------------------------------------------------------------------
// Suite 4: Replay Attack Defense & Monotonic Sequence Guard
// ------------------------------------------------------------------------------
console.log('\n[Suite 4/5] Replay Guard & Monotonic Sequence Check');

test('Accepts strictly increasing packet IDs within valid timestamp', () => {
  const guard = new ReplayGuard();
  const now = Date.now();

  const r1 = guard.checkAndRecord('dev-1', 1, now);
  const r2 = guard.checkAndRecord('dev-1', 2, now + 10);
  const r3 = guard.checkAndRecord('dev-1', 3, now + 20);

  assert.strictEqual(r1.valid, true);
  assert.strictEqual(r2.valid, true);
  assert.strictEqual(r3.valid, true);
});

test('Rejects duplicate packet ID with DUPLICATE_PACKET_ID', () => {
  const guard = new ReplayGuard();
  const now = Date.now();

  guard.checkAndRecord('dev-1', 10, now);
  const dup = guard.checkAndRecord('dev-1', 10, now);

  assert.strictEqual(dup.valid, false);
  assert.strictEqual(dup.reason, 'DUPLICATE_PACKET_ID');
});

test('Rejects timestamp drifted further than maxDriftMs (60s)', () => {
  const guard = new ReplayGuard({ maxDriftMs: 60000 });
  const now = Date.now();

  // Expired 65 seconds in the past
  const past = guard.checkAndRecord('dev-1', 1, now - 65000, now);
  assert.strictEqual(past.valid, false);
  assert.strictEqual(past.reason, 'TIMESTAMP_EXPIRED');

  // Skewed 65 seconds in the future
  const future = guard.checkAndRecord('dev-1', 2, now + 65000, now);
  assert.strictEqual(future.valid, false);
  assert.strictEqual(future.reason, 'TIMESTAMP_EXPIRED');
});

test('Accepts valid out-of-order packets within sliding window capacity', () => {
  const guard = new ReplayGuard({ windowCapacity: 10 });
  const now = Date.now();

  guard.checkAndRecord('dev-1', 10, now);
  const r8 = guard.checkAndRecord('dev-1', 8, now); // Out of order but within window
  assert.strictEqual(r8.valid, true);

  const rAncient = guard.checkAndRecord('dev-1', 0, now); // 10 - 0 = 10 (exceeds capacity)
  assert.strictEqual(rAncient.valid, false);
  assert.strictEqual(rAncient.reason, 'PACKET_BEHIND_WINDOW');
});

// ------------------------------------------------------------------------------
// Suite 5: AES-256-GCM Envelope Encryption & Decryption
// ------------------------------------------------------------------------------
console.log('\n[Suite 5/5] AES-256-GCM Authenticated Envelope Cipher');

test('Encrypts and decrypts notification payload with authenticated integrity', () => {
  const sessionKey = Buffer.alloc(32, 0x7A);
  const cipher = new EnvelopeCipher(sessionKey);

  const payload = {
    id: 'notif-123',
    appName: 'WhatsApp',
    packageName: 'com.whatsapp',
    title: 'Sarah Connor',
    body: 'Meet me at the tech lab at 9pm.',
  };

  const encrypted = cipher.encrypt(payload, { innerType: 'NOTIFICATION_POST' });

  assert.strictEqual(encrypted.magic, 'SK');
  assert.strictEqual(encrypted.version, 1);
  assert.strictEqual(encrypted.packet_type, 'ENCRYPTED_PACKET');
  assert.strictEqual(encrypted.inner_type, 'NOTIFICATION_POST');
  assert.ok(typeof encrypted.nonce === 'string');
  assert.ok(typeof encrypted.tag === 'string');
  assert.ok(typeof encrypted.ciphertext === 'string');

  const decrypted = cipher.decrypt(encrypted);
  assert.strictEqual(decrypted.innerType, 'NOTIFICATION_POST');
  assert.deepStrictEqual(decrypted.payload, payload);
});

test('Tampered ciphertext immediately fails authenticated decryption', () => {
  const sessionKey = Buffer.alloc(32, 0x7A);
  const cipher = new EnvelopeCipher(sessionKey);

  const encrypted = cipher.encrypt({ secret: 'bank-pin-9999' });

  // Tamper with the ciphertext (flip a byte)
  const ctBuf = Buffer.from(encrypted.ciphertext, 'base64');
  ctBuf[0] ^= 0xFF;
  encrypted.ciphertext = ctBuf.toString('base64');

  assert.throws(() => {
    cipher.decrypt(encrypted, { skipReplayCheck: true });
  }, /Authenticated decryption failed/);
});

test('Rejects malformed envelope with missing tag or nonce', () => {
  const sessionKey = Buffer.alloc(32, 0x7A);
  const cipher = new EnvelopeCipher(sessionKey);

  assert.throws(() => {
    cipher.decrypt({
      magic: 'SK',
      version: 1,
      packet_id: 1,
      timestamp: Date.now(),
      packet_type: 'ENCRYPTED_PACKET',
    });
  }, /missing nonce, tag, or ciphertext/);
});

test('Replay guard prevents double-decryption of duplicate envelope', () => {
  const sessionKey = Buffer.alloc(32, 0x7A);
  const cipher = new EnvelopeCipher(sessionKey, { deviceId: 'phone-alice' });

  const encrypted = cipher.encrypt({ cmd: 'sysinfo' });

  // First decryption succeeds
  const dec1 = cipher.decrypt(encrypted);
  assert.strictEqual(dec1.payload.cmd, 'sysinfo');

  // Second decryption must be caught by replay guard
  assert.throws(() => {
    cipher.decrypt(encrypted);
  }, /Replay protection rejected packet: DUPLICATE_PACKET_ID/);
});

console.log('\n================================================================');
console.log(` RESULTS: ${passedTests} / ${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log('================================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
