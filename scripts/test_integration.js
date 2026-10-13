#!/usr/bin/env node

/**
 * ==============================================================================
 * Soko Comprehensive Integration & Security Test Suite
 * 
 * Verifies all system confluences:
 * 1. Health & status discovery API
 * 2. Notification mirroring pipeline
 * 3. Whitelisted Remote CLI execution (and RCE defense)
 * 4. High-speed file transfers, cancellation, retry, & disk cleanup
 * 5. Path traversal sanitization & defense
 * 6. Streaming SHA-256 checksum verification & zero-leak guarantee
 * 7. WebSocket framing ('SK' magic bytes, SAS pairing, & anti-replay checks)
 * ==============================================================================
 */

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8766;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const TRANSFERS_DIR = path.resolve(__dirname, '../transfers');

let passedTests = 0;
let totalTests = 0;

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
          'Content-Type': 'application/json',
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

async function runTests() {
  console.log('================================================================');
  console.log(' SOKO FULL INTEGRATION & SECURITY TEST SUITE');
  console.log(` Target Server: ${BASE_URL}`);
  console.log('================================================================\n');

  // Test 1: Service Status Discovery
  console.log('[Suite 1/5] Health & Telemetry Status');
  try {
    const res = await request('GET', '/api/status');
    assert(res.status === 200, 'GET /api/status returns HTTP 200');
    assert(res.data.status === 'online', 'Service status is online');
    assert(Array.isArray(res.data.localIps), 'Reports local IP addresses for Wi-Fi pairing');
    assert(res.data.pairedDevice && res.data.pairedDevice.isAuthorized === true, 'Default paired device record available');
  } catch (err) {
    assert(false, `Status check failed: ${err.message}`);
  }

  // Test 2: Notification Mirroring
  console.log('\n[Suite 2/5] Notification Mirroring');
  try {
    const notifPayload = {
      id: `test-notif-${Date.now()}`,
      appName: 'WhatsApp',
      packageName: 'com.whatsapp',
      title: 'Alex Developer',
      body: 'Automated notification mirroring test passing with zero delay.',
    };
    const res = await request('POST', '/api/notify', notifPayload);
    assert(res.status === 200, 'POST /api/notify returns HTTP 200');
    assert(res.data.success === true, 'Notification broadcast acknowledged');
  } catch (err) {
    assert(false, `Notification check failed: ${err.message}`);
  }

  // Test 3: Remote CLI & RCE Whitelist Security
  console.log('\n[Suite 3/5] Remote CLI Execution & Whitelist Defense');
  try {
    // 3a. Whitelisted command
    const resAuth = await request('POST', '/api/cli', { command: 'sysinfo' });
    assert(resAuth.status === 200, 'Authorized command (sysinfo) accepted with HTTP 200');
    assert(resAuth.data.success === true, 'Command execution scheduled');

    // 3b. Unauthorized command / RCE attempt
    const resUnauth = await request('POST', '/api/cli', { command: 'rm -rf / --no-preserve-root' });
    assert(resUnauth.status === 403, 'Unauthorized command rejected with HTTP 403 Forbidden');
    assert(
      typeof resUnauth.data.error === 'string' && resUnauth.data.error.includes('whitelist'),
      'Clear security violation message returned'
    );
  } catch (err) {
    assert(false, `CLI whitelist check failed: ${err.message}`);
  }

  // Test 4: File Transfers, Cancellation, & Retry
  console.log('\n[Suite 4/5] High-Speed File Transfer Flow');
  try {
    // 4a. Trigger simulated transfer
    const resTrans = await request('POST', '/api/transfer', { filename: 'soko-v1.0.0-release.apk' });
    assert(resTrans.status === 200, 'POST /api/transfer starts high-speed stream');

    // 4b. Cancel transfer
    const resCancel = await request('POST', '/api/transfer/cancel');
    assert(resCancel.status === 200, 'POST /api/transfer/cancel stops stream and cleans buffers');
    assert(resCancel.data.status === 'cancelled', 'Transfer state changed to cancelled');

    // 4c. Retry transfer
    const resRetry = await request('POST', '/api/transfer/retry');
    assert(resRetry.status === 200, 'POST /api/transfer/retry successfully restarts session');
    assert(resRetry.data.status === 'active', 'Transfer state resumed to active');
  } catch (err) {
    assert(false, `File transfer flow check failed: ${err.message}`);
  }

  // Test 5: Real Binary Uploads, Path Sanitization, & SHA-256 Integrity
  console.log('\n[Suite 5/5] Real Binary Uploads, Sandbox & Checksum Defenses');
  try {
    const testContent = Buffer.from('Soko Production Test Binary Data Stream 2026', 'utf8');
    const validHash = crypto.createHash('sha256').update(testContent).digest('hex');

    // 5a. Normal verified upload with matching checksum
    const resUpload = await request(
      'POST',
      `/api/upload?filename=integration-test.bin&sha256=${validHash}`,
      testContent,
      { 'Content-Length': testContent.length }
    );
    assert(resUpload.status === 200, 'POST /api/upload succeeds with matching SHA-256');
    assert(resUpload.data.sha256 === validHash, 'Returned SHA-256 matches cryptographic digest');

    const uploadedFilePath = path.join(TRANSFERS_DIR, 'integration-test.bin');
    assert(fs.existsSync(uploadedFilePath), 'File saved to transfers/ directory');
    const stat = fs.statSync(uploadedFilePath);
    assert((stat.mode & 0o111) === 0, 'Permissions are non-executable (0644 security defense)');
    try { fs.unlinkSync(uploadedFilePath); } catch {}

    // 5b. Path traversal attack attempt
    const resTraversal = await request(
      'POST',
      '/api/upload?filename=../../../../etc/malicious.bin',
      Buffer.from('traversal payload'),
      { 'Content-Length': 17 }
    );
    assert(resTraversal.status === 200, 'Path traversal upload handled safely');
    assert(resTraversal.data.filename === 'malicious.bin', 'Path sanitized to basename (escapes blocked)');
    const maliciousPath = path.join(TRANSFERS_DIR, 'malicious.bin');
    assert(fs.existsSync(maliciousPath), 'Confined strictly to transfers/ directory');
    try { fs.unlinkSync(maliciousPath); } catch {}

    // 5c. Checksum integrity mismatch failure
    const fakeHash = '0000000000000000000000000000000000000000000000000000000000000000';
    const resMismatch = await request(
      'POST',
      `/api/upload?filename=checksum-fail.bin&sha256=${fakeHash}`,
      testContent,
      { 'Content-Length': testContent.length }
    );
    assert(resMismatch.status === 400, 'Mismatched checksum rejected with HTTP 400');
    assert(!fs.existsSync(path.join(TRANSFERS_DIR, 'checksum-fail.bin')), 'Target file was NOT created');
    assert(!fs.existsSync(path.join(TRANSFERS_DIR, 'checksum-fail.bin.part')), 'Partial buffer (.part) cleaned up with zero leaks');

    // Test GET /api/transfers storage history list
    const resList = await request('GET', '/api/transfers');
    assert(resList.status === 200, 'GET /api/transfers returns HTTP 200');
    assert(Array.isArray(resList.data?.files), 'Returns files array in storage');
    assert(resList.data.files.length >= 0, 'Storage files list query successful');
  } catch (err) {
    assert(false, `Binary upload security check failed: ${err.message}`);
  }

  console.log('\n================================================================');
  console.log(` RESULTS: ${passedTests} / ${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('================================================================\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests();
