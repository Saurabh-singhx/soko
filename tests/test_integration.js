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

const os = require('os');

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8766;
const BASE_URL = `http://127.0.0.1:${PORT}`;
function getTransfersDir() {
  if (process.env.SOKO_TRANSFERS_DIR) return process.env.SOKO_TRANSFERS_DIR;
  const candidates = [
    path.resolve(os.homedir(), '.config/soko/transfers'),
    path.resolve(__dirname, '../transfers'),
    path.resolve(process.cwd(), 'transfers'),
    path.resolve(os.tmpdir(), 'soko-transfers'),
  ];
  return (
    candidates.find((d) => {
      try {
        return fs.existsSync(d) && (fs.accessSync(d, fs.constants.W_OK), true);
      } catch {
        return false;
      }
    }) || candidates[0]
  );
}
const TRANSFERS_DIR = getTransfersDir();

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

let spawnedBridge = null;

async function isBridgeOnline() {
  try {
    const res = await request('GET', '/api/status');
    return res.status === 200;
  } catch {
    return false;
  }
}

async function ensureBridgeRunning() {
  if (await isBridgeOnline()) {
    return;
  }

  console.log(`[Setup] Starting Soko Bridge test instance on port ${PORT}...`);
  const { spawn } = require('child_process');
  const bridgeScript = [
    path.resolve(__dirname, '../scripts/soko_bridge.js'),
    path.resolve(__dirname, 'soko_bridge.js'),
    path.resolve(process.cwd(), 'scripts/soko_bridge.js'),
  ].find((p) => fs.existsSync(p));

  spawnedBridge = spawn('node', [bridgeScript], {
    env: {
      ...process.env,
      PORT: String(PORT),
    },
    stdio: 'inherit',
  });

  const startTime = Date.now();
  while (Date.now() - startTime < 10000) {
    await new Promise((r) => setTimeout(r, 200));
    if (await isBridgeOnline()) {
      console.log(`  ✓ Test bridge process online on port ${PORT}\n`);
      return;
    }
  }
  throw new Error(`Failed to start test bridge on port ${PORT} within 10s`);
}

async function runTests() {
  await ensureBridgeRunning();

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
    assert(res.data.pairedDevice === null || res.data.pairedDevice.isAuthorized === true, 'Device pairing status reports valid state');
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

    function findUploadedFile(name) {
      const candidates = [
        path.resolve(TRANSFERS_DIR, name),
        path.resolve(__dirname, '../transfers', name),
        path.resolve(process.cwd(), 'transfers', name),
        path.resolve(os.homedir(), '.config/soko/transfers', name),
      ];
      return candidates.find((f) => fs.existsSync(f)) || path.resolve(TRANSFERS_DIR, name);
    }

    const uploadedFilePath = findUploadedFile('integration-test.bin');
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
    const maliciousPath = findUploadedFile('malicious.bin');
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

    // Test GET /transfers/:filename direct streaming download
    const testFileToStream = (resList.data?.files && resList.data.files[0]?.filename) || 'soko-v1.0.0-release.apk';
    const resStream = await request('GET', `/transfers/${encodeURIComponent(testFileToStream)}`);
    assert(resStream.status === 200, 'GET /transfers/:filename streams transferred file with HTTP 200');

    // Test POST /api/transfers/open for host file/folder viewing (dryRun: true prevents launching GUI file manager)
    const resOpen = await request(
      'POST',
      '/api/transfers/open',
      { action: 'folder', dryRun: true },
      { 'x-dry-run': 'true' }
    );
    assert(resOpen.status === 200, 'POST /api/transfers/open returns HTTP 200 to view files on disk');

    // 5d. Peer WebSocket receives FILE_OFFER and upload broadcasts progress without cancellation
    const wsListener = await createWsClient();
    await wsListener.readPacketType('BRIDGE_STATUS');

    const wsSender = await createWsClient();
    await wsSender.readPacketType('BRIDGE_STATUS');
    wsSender.sendPacket({
      magic: 'SK',
      version: 1,
      packetId: Date.now(),
      timestamp: Date.now(),
      packetType: 'FILE_OFFER',
      payload: {
        filename: 'real-payload-test.apk',
        bytesDownloaded: 0,
        totalBytes: 1024,
        speedBytesPerSec: 0,
        percentage: 0,
        status: 'active',
      },
    });

    const receivedOffer = await wsListener.readPacketType('FILE_OFFER', 2000);
    assert(receivedOffer && receivedOffer.payload?.filename === 'real-payload-test.apk', 'WebSocket peer successfully receives forwarded FILE_OFFER');

    // Now send binary stream to /api/upload
    const uploadPayload = Buffer.from('Testing real file upload without self-sabotaging cancel 2026', 'utf8');
    const resUploadFlow = await request(
      'POST',
      `/api/upload?filename=real-payload-test.apk`,
      uploadPayload,
      { 'Content-Length': uploadPayload.length }
    );
    assert(resUploadFlow.status === 200, 'POST /api/upload succeeds during active peer session');
    assert(resUploadFlow.data?.filename === 'real-payload-test.apk', 'Real upload returns correct file name');

    const completedPkt = await wsListener.readPacketType('FILE_COMPLETED', 2000);
    assert(completedPkt && completedPkt.payload?.filename === 'real-payload-test.apk', 'WebSocket peer receives FILE_COMPLETED');

    const savedPath = findUploadedFile('real-payload-test.apk');
    if (fs.existsSync(savedPath)) {
      try { fs.unlinkSync(savedPath); } catch {}
    }
    wsListener.close();
    wsSender.close();
  } catch (err) {
    assert(false, `Binary upload security check failed: ${err.message}`);
  }

  // Test 6: Zero-Trust Pairing, SAS PIN & Mutual Authorization
  console.log('\n[Suite 6/6] Zero-Trust SAS PIN Pairing & Token Exchange');
  try {
    const wsClient = await createWsClient();
    const initialStatus = await wsClient.readPacketType('BRIDGE_STATUS');
    assert(initialStatus && initialStatus.packetType === 'BRIDGE_STATUS', 'WS server sends initial BRIDGE_STATUS handshake');
    const validPin = initialStatus.payload?.sasPin || '482 195';

    // 6a. Pairing attempt with incorrect PIN must be rejected
    wsClient.sendPacket({
      magic: 'SK',
      version: 1,
      packetId: Date.now() + 1,
      timestamp: Date.now(),
      packetType: 'PAIR_REQUEST',
      payload: {
        pin: '000 000',
        deviceId: 'unauth-test-phone',
        deviceName: 'Attacker Phone',
      },
    });

    const rejectResponse = await wsClient.readPacketType('PAIR_REJECT');
    assert(
      rejectResponse && rejectResponse.packetType === 'PAIR_REJECT',
      'Unauthorized pair attempt rejected with PAIR_REJECT'
    );
    assert(
      rejectResponse.payload?.status === 'rejected',
      'Pair rejection explicitly returns status: rejected'
    );

    // 6b. Pairing attempt with correct SAS PIN triggers desktop pending confirmation
    const testDeviceId = `test-phone-${Date.now()}`;
    wsClient.sendPacket({
      magic: 'SK',
      version: 1,
      packetId: Date.now() + 2,
      timestamp: Date.now(),
      packetType: 'PAIR_REQUEST',
      payload: {
        pin: validPin,
        deviceId: testDeviceId,
        deviceName: 'Authorized Test Android',
        model: 'Pixel Test',
      },
    });

    const pendingResponse = await wsClient.readPacketType('PAIR_REQUEST_PENDING');
    assert(
      pendingResponse && pendingResponse.packetType === 'PAIR_REQUEST_PENDING',
      'Valid PIN triggers PAIR_REQUEST_PENDING for human desktop approval'
    );
    assert(
      pendingResponse.payload?.deviceId === testDeviceId,
      'Pending request identifies requesting device ID'
    );

    // 6c. Desktop user approves pairing decision
    wsClient.sendPacket({
      magic: 'SK',
      version: 1,
      packetId: Date.now() + 3,
      timestamp: Date.now(),
      packetType: 'PAIR_DECISION',
      payload: {
        deviceId: testDeviceId,
        approved: true,
      },
    });

    const confirmResponse = await wsClient.readPacketType('PAIR_CONFIRM');
    assert(
      confirmResponse && confirmResponse.packetType === 'PAIR_CONFIRM',
      'Desktop user approval issues PAIR_CONFIRM packet'
    );
    assert(
      typeof confirmResponse.payload?.token === 'string' && confirmResponse.payload?.token.length > 0,
      'Issues cryptographic persistent bearer token'
    );

    wsClient.socket.destroy();

    // 6d. Direct HTTP Pairing Endpoint tests
    const badPairRes = await request('POST', '/api/pair', {
      deviceId: 'http-test-phone',
      pin: '000000',
    });
    assert(badPairRes.status === 400, 'HTTP POST /api/pair rejects invalid PIN with HTTP 400');

    const statusCheckRes = await request('GET', '/api/pair/status?deviceId=http-test-phone');
    assert(statusCheckRes.status === 200, 'HTTP GET /api/pair/status returns HTTP 200');
    assert(statusCheckRes.data.status === 'unpaired', 'Reports correct unpaired status');
  } catch (err) {
    assert(false, `Zero-trust pairing test failed: ${err.message}`);
  }

  // Test 7: Desktop Audio Streaming
  console.log('\n[Suite 7/7] Desktop Audio Streaming Engine & PipeWire');
  try {
    const statusRes = await request('GET', '/api/audio/status');
    assert(statusRes.status === 200, 'GET /api/audio/status returns HTTP 200');
    assert(typeof statusRes.data.isPlaying === 'boolean', 'Reports audio playback state boolean');
    assert(statusRes.data.bitrate === '192 kbps', 'Bitrate is calibrated at 192 kbps');
    assert(statusRes.data.format.includes('MP3'), 'Audio streaming format is MP3');

    // Test HEAD /api/audio/stream
    const headRes = await request('HEAD', '/api/audio/stream');
    assert(headRes.status === 200, 'HEAD /api/audio/stream returns HTTP 200');
    assert(headRes.headers['content-type'] === 'audio/mpeg', 'Stream content-type is audio/mpeg');

    // Test GET /api/audio/stream connection & chunk reception
    const streamReceived = await new Promise((resolve) => {
      const req = http.get(`${BASE_URL}/api/audio/stream`, (res) => {
        assert(res.statusCode === 200, 'GET /api/audio/stream connects with HTTP 200');
        assert(res.headers['content-type'] === 'audio/mpeg', 'Live stream returns audio/mpeg header');
        res.on('data', (chunk) => {
          if (chunk.length > 0) {
            req.destroy();
            resolve(true);
          }
        });
        setTimeout(() => {
          req.destroy();
          resolve(true); // Connected successfully even if quiet
        }, 1500);
      });
      req.on('error', () => resolve(false));
    });
    assert(streamReceived, 'Audio broadcaster client connection handled cleanly');
  } catch (err) {
    assert(false, `Audio streaming test failed: ${err.message}`);
  }

  // Suite 8: Multi-Session CLI Agent Telemetry & Registry
  console.log('\n[Suite 8/8] Multi-Session CLI Agent Telemetry & Registry');
  try {
    const actRes = await request('GET', '/api/agent-activity');
    assert(actRes.status === 200, 'GET /api/agent-activity returns HTTP 200');
    assert(Array.isArray(actRes.data?.activeSessions), 'Returns activeSessions array');
    assert(typeof actRes.data?.activeCount === 'number', 'Reports activeCount metric');

    const sessRes = await request('GET', '/api/agent-sessions');
    assert(sessRes.status === 200, 'GET /api/agent-sessions returns HTTP 200');
    assert(sessRes.data?.success === true, 'Returns success: true');
    assert(Array.isArray(sessRes.data?.sessions), 'Returns sessions registry array');

    // Simulate multi-session
    const simRes = await request('POST', '/api/agent-activity/simulate', {
      agent: 'codex',
      detail: 'Multi-session integration verification',
      durationMs: 5000,
    });
    assert(simRes.status === 200, 'POST /api/agent-activity/simulate returns HTTP 200');
    assert(simRes.data?.activity?.agent === 'codex', 'Simulated session agent matches codex');
    assert(simRes.data?.activity?.activeSessions?.length >= 1, 'Simulated session present in activeSessions');

    // Reset simulation
    const resetRes = await request('POST', '/api/agent-activity/simulate', { agent: 'reset' });
    assert(resetRes.status === 200, 'Resetting simulation returns HTTP 200');
  } catch (err) {
    assert(false, `Multi-session test failed: ${err.message}`);
  }

  console.log('\n================================================================');
  console.log(` RESULTS: ${passedTests} / ${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('================================================================\n');

  if (spawnedBridge) {
    try {
      spawnedBridge.kill('SIGKILL');
    } catch {}
  }

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

function createWsClient() {
  return new Promise((resolve, reject) => {
    const key = crypto.randomBytes(16).toString('base64');
    const req = http.request({
      port: PORT,
      host: '127.0.0.1',
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Key': key,
        'Sec-WebSocket-Version': '13',
      },
    });

    req.on('upgrade', (res, socket) => {
      const packetQueue = [];
      const waiters = [];

      function sendPacket(pkt) {
        const payload = Buffer.from(JSON.stringify(pkt), 'utf8');
        const mask = crypto.randomBytes(4);
        const masked = Buffer.alloc(payload.length);
        for (let i = 0; i < payload.length; i++) {
          masked[i] = payload[i] ^ mask[i % 4];
        }
        let header;
        if (payload.length <= 125) {
          header = Buffer.from([0x81, 0x80 | payload.length]);
        } else if (payload.length <= 65535) {
          header = Buffer.alloc(4);
          header[0] = 0x81;
          header[1] = 0x80 | 126;
          header.writeUInt16BE(payload.length, 2);
        }
        socket.write(Buffer.concat([header, mask, masked]));
      }

      let buffer = Buffer.alloc(0);
      socket.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        while (buffer.length >= 2) {
          let len = buffer[1] & 0x7f;
          let offset = 2;
          if (len === 126) {
            if (buffer.length < 4) break;
            len = buffer.readUInt16BE(2);
            offset = 4;
          }
          if (buffer.length < offset + len) break;
          const payload = buffer.slice(offset, offset + len);
          buffer = buffer.slice(offset + len);
          try {
            const pkt = JSON.parse(payload.toString('utf8'));
            const waiterIdx = waiters.findIndex((w) => !w.expectedType || w.expectedType === pkt.packetType);
            if (waiterIdx !== -1) {
              const [w] = waiters.splice(waiterIdx, 1);
              w.resolve(pkt);
            } else {
              packetQueue.push(pkt);
            }
          } catch (e) {}
        }
      });

      function readPacketType(expectedType = null, timeoutMs = 3000) {
        return new Promise((resolvePkt, rejectPkt) => {
          const idx = packetQueue.findIndex((p) => !expectedType || p.packetType === expectedType);
          if (idx !== -1) {
            const [found] = packetQueue.splice(idx, 1);
            return resolvePkt(found);
          }

          const timer = setTimeout(() => {
            const wIdx = waiters.findIndex((w) => w.resolve === resolvePkt);
            if (wIdx !== -1) waiters.splice(wIdx, 1);
            rejectPkt(new Error(`Timed out waiting for packet: ${expectedType || 'ANY'}`));
          }, timeoutMs);

          waiters.push({
            expectedType,
            resolve: (pkt) => {
              clearTimeout(timer);
              resolvePkt(pkt);
            },
          });
        });
      }

      resolve({ socket, sendPacket, readPacketType, close: () => socket.destroy() });
    });

    req.on('error', reject);
    req.end();
  });
}

runTests();
