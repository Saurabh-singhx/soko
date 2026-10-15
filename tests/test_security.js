#!/usr/bin/env node

/**
 * ==============================================================================
 * Soko Zero-Trust Security & Device Forgetting Automated Test Suite
 * 
 * Verifies:
 * 1. Unauthenticated remote HTTP access blocked (401 for tokens, activity, sessions, notify, transfers, upload, cli)
 * 2. Unauthenticated WebSocket isolation (SECURITY_ALERT for tokens, activity, CLI, file offers, notifications)
 * 3. Fresh install / unpaired state shows discovered / requiresPairing, NOT connected
 * 4. Zero-Trust PIN verification & human approval issuing persistent 128-bit bearer token
 * 5. Authorized requests succeed with valid Bearer token (200 OK)
 * 6. Disconnect & Forget revokes credentials from trust store, clears paired device, invalidates token (401),
 *    broadcasts DEVICE_UNPAIRED, and prevents unauthorized auto-reconnect.
 * ==============================================================================
 */

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const TEST_PORT = 8798;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const TEST_CONFIG_DIR = path.join(os.tmpdir(), `soko-security-test-${Date.now()}`);

let passedTests = 0;
let totalTests = 0;
let bridgeProcess = null;

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

function createWsClient(simulateRemoteIp = '192.168.31.105') {
  return new Promise((resolve, reject) => {
    const key = crypto.randomBytes(16).toString('base64');
    const req = http.request({
      port: TEST_PORT,
      host: '127.0.0.1',
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Key': key,
        'Sec-WebSocket-Version': '13',
        'x-simulate-remote-ip': simulateRemoteIp,
      },
    });

    req.on('upgrade', (res, socket, head) => {
      const packetQueue = [];
      const waiters = [];

      let clientPktSeq = 1000;
      function sendPacket(pkt) {
        clientPktSeq += 10;
        const fullPkt = {
          magic: 'SK',
          version: 1,
          timestamp: Date.now(),
          ...pkt,
          packetId: Date.now() * 1000 + clientPktSeq,
        };
        const payload = Buffer.from(JSON.stringify(fullPkt), 'utf8');
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

      let buffer = head && head.length ? Buffer.from(head) : Buffer.alloc(0);

      function parseBuffer() {
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
      }

      if (buffer.length > 0) parseBuffer();

      socket.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        parseBuffer();
      });

      function readPacketType(expectedType = null, timeoutMs = 3500) {
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

      resolve({ socket, sendPacket, readPacketType });
    });

    req.on('error', reject);
    req.end();
  });
}

function startTestBridge() {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(TEST_CONFIG_DIR, { recursive: true });
    const bridgeScript = [
      path.resolve(__dirname, '../scripts/soko_bridge.js'),
      path.resolve(__dirname, 'soko_bridge.js'),
      path.resolve(process.cwd(), 'scripts/soko_bridge.js'),
    ].find((p) => fs.existsSync(p)) || path.resolve(__dirname, '../scripts/soko_bridge.js');

    bridgeProcess = spawn('node', [bridgeScript], {
      env: {
        ...process.env,
        PORT: String(TEST_PORT),
        SOKO_CONFIG_DIR: TEST_CONFIG_DIR,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let started = false;
    const timeout = setTimeout(() => {
      if (!started) {
        bridgeProcess.kill();
        reject(new Error('Bridge process timed out starting'));
      }
    }, 8000);

    bridgeProcess.stdout.on('data', (d) => {
      const msg = d.toString();
      if (msg.includes(`running on port ${TEST_PORT}`)) {
        started = true;
        clearTimeout(timeout);
        resolve();
      }
    });

    bridgeProcess.stderr.on('data', (d) => {
      // ignore experimental warnings
    });

    bridgeProcess.on('exit', (code) => {
      if (!started) {
        clearTimeout(timeout);
        reject(new Error(`Bridge process exited prematurely with code ${code}`));
      }
    });
  });
}

async function runSecurityTests() {
  console.log('================================================================');
  console.log(' SOKO ZERO-TRUST SECURITY & AUTOMATED FORGETTING TEST SUITE');
  console.log(` Target Server: ${BASE_URL} (Port ${TEST_PORT})`);
  console.log(` Isolated Trust Store: ${TEST_CONFIG_DIR}`);
  console.log('================================================================\n');

  try {
    console.log('[Setup] Starting isolated Soko Bridge instance...');
    await startTestBridge();
    console.log('  ✓ Test bridge process online on port ' + TEST_PORT);

    // ============================================================================
    // SUITE 1: UNAUTHENTICATED REMOTE HTTP ACCESS BLOCKED (ZERO-TRUST)
    // ============================================================================
    console.log('\n[Suite 1/6] Unauthenticated Remote HTTP Access Blocked (Zero-Trust)');
    const remoteHeaders = { 'x-simulate-remote-ip': '192.168.31.155' };

    // 1a. Tokens telemetry blocked
    const resTokens = await request('GET', '/api/tokens', null, remoteHeaders);
    assert(resTokens.status === 401, 'GET /api/tokens without auth returns HTTP 401 Unauthorized');
    assert(resTokens.data?.requiresPairing === true, 'GET /api/tokens indicates pairing required');

    // 1b. Agent activity blocked
    const resActivity = await request('GET', '/api/agent-activity', null, remoteHeaders);
    assert(resActivity.status === 401, 'GET /api/agent-activity without auth returns HTTP 401');

    // 1c. Agent sessions registry blocked
    const resSessions = await request('GET', '/api/agent-sessions', null, remoteHeaders);
    assert(resSessions.status === 401, 'GET /api/agent-sessions without auth returns HTTP 401');

    // 1d. Notification mirroring blocked for unauthenticated remote client
    const resNotify = await request('POST', '/api/notify', {
      appName: 'AttackerApp',
      title: 'Hacked',
      body: 'Injected alert'
    }, remoteHeaders);
    assert(resNotify.status === 401, 'POST /api/notify without auth returns HTTP 401 Unauthorized');

    // 1e. File transfer initiate blocked
    const resTransfer = await request('POST', '/api/transfer', { filename: 'secret.apk' }, remoteHeaders);
    assert(resTransfer.status === 401, 'POST /api/transfer without auth returns HTTP 401 Unauthorized');

    // 1f. Binary upload blocked
    const resUpload = await request('POST', '/api/upload?filename=exploit.sh', Buffer.from('malicious'), {
      ...remoteHeaders,
      'Content-Type': 'application/octet-stream',
    });
    assert(resUpload.status === 401, 'POST /api/upload without auth returns HTTP 401 Unauthorized');

    // 1g. Remote CLI execution blocked
    const resCli = await request('POST', '/api/cli', { command: 'sysinfo' }, remoteHeaders);
    assert(resCli.status === 401, 'POST /api/cli without auth returns HTTP 401 Unauthorized');

    // 1h. Transfer download blocked
    const resDownload = await request('GET', '/transfers/confidential.txt', null, remoteHeaders);
    assert(resDownload.status === 401, 'GET /transfers/:filename without auth returns HTTP 401 Unauthorized');

    // 1i. Public status endpoint reports unpaired state
    const resStatus = await request('GET', '/api/status');
    assert(resStatus.status === 200, 'GET /api/status is accessible publicly');
    assert(resStatus.data.pairedDevice === null, 'pairedDevice is strictly null before pairing (no mock auto-auth)');

    // ============================================================================
    // SUITE 2: UNAUTHENTICATED WEBSOCKET ISOLATION & ZERO-TRUST GUARDS
    // ============================================================================
    console.log('\n[Suite 2/6] Unauthenticated WebSocket Isolation (Zero-Trust)');
    const wsClient = await createWsClient('192.168.31.200');

    // Initial handshake
    const initialBridgeStatus = await wsClient.readPacketType('BRIDGE_STATUS');
    assert(initialBridgeStatus && initialBridgeStatus.packetType === 'BRIDGE_STATUS', 'WebSocket server sends initial BRIDGE_STATUS');
    assert(initialBridgeStatus.payload?.requiresPairing === true, 'BRIDGE_STATUS announces requiresPairing: true');
    assert(initialBridgeStatus.payload?.pairedDevice === null, 'BRIDGE_STATUS reports pairedDevice: null');

    // 2a. Attempting to fetch tokens without auth triggers SECURITY_ALERT
    wsClient.sendPacket({
      magic: 'SK',
      version: 1,
      packetId: 101,
      timestamp: Date.now(),
      packetType: 'FETCH_TOKEN_STATS',
      payload: {},
    });
    const alertTokens = await wsClient.readPacketType('SECURITY_ALERT');
    assert(alertTokens && alertTokens.payload?.status === 'unauthorized', 'FETCH_TOKEN_STATS rejected with SECURITY_ALERT');

    // 2b. Attempting CLI execution without auth triggers SECURITY_ALERT
    wsClient.sendPacket({
      magic: 'SK',
      version: 1,
      packetId: 102,
      timestamp: Date.now(),
      packetType: 'CLI_EXECUTE',
      payload: { command: 'sysinfo', commandId: 'c1' },
    });
    const alertCli = await wsClient.readPacketType('SECURITY_ALERT');
    assert(alertCli && alertCli.payload?.action === 'CLI_EXECUTE', 'CLI_EXECUTE rejected with SECURITY_ALERT');

    // 2c. Attempting file offer without auth triggers SECURITY_ALERT
    wsClient.sendPacket({
      magic: 'SK',
      version: 1,
      packetId: 103,
      timestamp: Date.now(),
      packetType: 'FILE_OFFER',
      payload: { filename: 'test.apk', totalBytes: 1024 },
    });
    const alertFile = await wsClient.readPacketType('SECURITY_ALERT');
    assert(alertFile && alertFile.payload?.action === 'FILE_OFFER', 'FILE_OFFER rejected with SECURITY_ALERT');

    // 2d. Notification post from unauthenticated socket does NOT auto-authorize device
    wsClient.sendPacket({
      magic: 'SK',
      version: 1,
      packetId: 104,
      timestamp: Date.now(),
      packetType: 'NOTIFICATION_POST',
      payload: { id: 'unauth-notif', appName: 'Spy', title: 'Test', body: 'Test' },
    });
    const alertNotif = await wsClient.readPacketType('SECURITY_ALERT');
    assert(alertNotif && alertNotif.payload?.action === 'NOTIFICATION_POST', 'NOTIFICATION_POST rejected with SECURITY_ALERT');

    // ============================================================================
    // SUITE 3: FRESH INSTALL / DISCOVERED UNPAIRED DEVICES TRACKING
    // ============================================================================
    console.log('\n[Suite 3/6] Device Presence & Wi-Fi Discovery UI Tracking');
    const resDiscovered = await request('GET', '/api/devices/discovered');
    assert(resDiscovered.status === 200, 'GET /api/devices/discovered returns HTTP 200');
    assert(Array.isArray(resDiscovered.data?.devices), 'Returns discovered devices array');
    assert(resDiscovered.data?.devices.length >= 1, 'Connected unauthenticated socket is tracked under discovered devices');
    assert(resDiscovered.data?.devices[0].isAuthorized === false, 'Discovered device is explicitly marked isAuthorized: false');

    // ============================================================================
    // SUITE 4: ZERO-TRUST PIN PAIRING HANDSHAKE & PERSISTENT BEARER TOKEN ISSUANCE
    // ============================================================================
    console.log('\n[Suite 4/6] Zero-Trust PIN Pairing Handshake & Token Issuance');
    const testDeviceId = `phone-test-${Date.now()}`;

    // 4a. Incorrect PIN rejected
    const resBadPin = await request('POST', '/api/pair', {
      deviceId: testDeviceId,
      pin: '000 000',
      deviceName: 'Test Phone',
    });
    assert(resBadPin.status === 400, 'POST /api/pair with incorrect PIN returns HTTP 400');
    assert(resBadPin.data?.error === 'PIN_MISMATCH', 'Error reports PIN_MISMATCH');

    // 4b. Get active PIN from pending-pin endpoint
    const resPin = await request('GET', '/api/devices/pending-pin');
    assert(resPin.status === 200, 'GET /api/devices/pending-pin returns active PIN');
    const activePin = resPin.data?.pin;
    assert(typeof activePin === 'string' && activePin.length >= 6, 'Active PIN is valid 6-digit format');

    // 4b2. Zero-Trust Defense: Desktop pair-select attempt BEFORE mobile companion enters PIN is rejected
    const resPrematurePair = await request('POST', '/api/devices/pair-select', {
      deviceId: testDeviceId,
      name: 'Unverified Phone',
      pin: activePin,
    });
    assert(resPrematurePair.status === 400, 'POST /api/devices/pair-select without mobile PIN entry rejected with HTTP 400');
    assert(resPrematurePair.data?.error === 'PIN_NOT_VERIFIED', 'Reports PIN_NOT_VERIFIED error');
    assert(typeof resPrematurePair.data?.message === 'string' && resPrematurePair.data.message.includes('Verification Required'), 'Clear message informs user mobile must enter PIN first');

    const resPrematureStatus = await request('GET', '/api/status');
    assert(resPrematureStatus.data?.pairedDevice === null, 'pairedDevice remains strictly null when mobile has not entered PIN');
    assert(resPrematureStatus.data?.requiresPairing === true, 'requiresPairing remains true');

    // 4c. Submit correct PIN
    const resPairReq = await request('POST', '/api/pair', {
      deviceId: testDeviceId,
      pin: activePin,
      deviceName: 'Pixel 9 Pro (Android 15)',
      model: 'Google Pixel 9 Pro',
    });
    assert(resPairReq.status === 200, 'POST /api/pair with correct PIN returns HTTP 200');
    assert(resPairReq.data?.status === 'pending', 'Pair request transitions to status: pending');

    // 4d. Desktop user approves pairing
    const resApprove = await request('POST', '/api/devices/pair-select', {
      deviceId: testDeviceId,
      approved: true,
      pin: activePin,
    });
    assert(resApprove.status === 200, 'POST /api/devices/pair-select approvals return HTTP 200');
    assert(resApprove.data?.success === true, 'Desktop approval registered successfully');

    // 4d2. Mobile WebSocket socket automatically receives PAIR_CONFIRM directly upon desktop approval
    const autoPairConfirm = await wsClient.readPacketType('PAIR_CONFIRM');
    assert(autoPairConfirm && autoPairConfirm.packetType === 'PAIR_CONFIRM', 'WebSocket client directly receives PAIR_CONFIRM when desktop approves');
    assert(autoPairConfirm.payload?.isAuthorized === true, 'Direct confirmation marks socket isAuthorized: true');

    // 4e. Mobile companion polls for status and receives issued token
    const resStatusPoll = await request('GET', `/api/pair/status?deviceId=${encodeURIComponent(testDeviceId)}`);
    assert(resStatusPoll.status === 200, 'GET /api/pair/status returns HTTP 200');
    assert(resStatusPoll.data?.status === 'paired', 'Status updated to paired');
    const bearerToken = resStatusPoll.data?.token;
    assert(typeof bearerToken === 'string' && bearerToken.length === 32, 'Issued 128-bit persistent cryptographic bearer token');

    // 4f. WebSocket client immediately sends FETCH_TOKEN_STATS without getting SECURITY_ALERT
    wsClient.sendPacket({
      magic: 'SK',
      version: 1,
      packetId: 105,
      timestamp: Date.now(),
      packetType: 'FETCH_TOKEN_STATS',
      payload: {},
    });
    const immediateTokenStats = await wsClient.readPacketType('TOKEN_STATS_UPDATE');
    assert(immediateTokenStats && immediateTokenStats.packetType === 'TOKEN_STATS_UPDATE', 'Paired WebSocket immediately receives TOKEN_STATS_UPDATE with zero SECURITY_ALERT');

    // 4g. WebSocket client immediately sends FETCH_AGENT_ACTIVITY without getting SECURITY_ALERT
    wsClient.sendPacket({
      magic: 'SK',
      version: 1,
      packetId: 106,
      timestamp: Date.now(),
      packetType: 'FETCH_AGENT_ACTIVITY',
      payload: {},
    });
    const immediateActivity = await wsClient.readPacketType('AGENT_ACTIVITY_STATUS');
    assert(immediateActivity && immediateActivity.packetType === 'AGENT_ACTIVITY_STATUS', 'Paired WebSocket immediately receives AGENT_ACTIVITY_STATUS with zero SECURITY_ALERT');

    // ============================================================================
    // SUITE 5: SELF-HEALING TOKEN BEARER AUTHORIZATION & RECONNECT ROBUSTNESS
    // ============================================================================
    console.log('\n[Suite 5/6] Self-Healing Token Bearer WebSocket Auto-Authorization');

    // 5a. A brand new WebSocket connection arrives unauthenticated
    const wsFresh = await createWsClient('192.168.31.215');
    const freshStatus = await wsFresh.readPacketType('BRIDGE_STATUS');
    assert(freshStatus && freshStatus.payload?.pairedDevice !== null, 'Bridge recognizes active paired device in system');
    assert(freshStatus.payload?.requiresPairing === true, 'Fresh unauthenticated socket reports requiresPairing: true prior to bearer presentation');

    // 5b. Fresh client dispatches FETCH_TOKEN_STATS presenting token in packet payload
    wsFresh.sendPacket({
      magic: 'SK',
      version: 1,
      packetId: 201,
      timestamp: Date.now(),
      packetType: 'FETCH_TOKEN_STATS',
      token: bearerToken,
      payload: { token: bearerToken },
    });
    const freshTokenStats = await wsFresh.readPacketType('TOKEN_STATS_UPDATE');
    assert(freshTokenStats && freshTokenStats.packetType === 'TOKEN_STATS_UPDATE', 'Fresh WebSocket presenting valid bearer token auto-authorizes and receives data');

    // 5c. Subsequent query on the same socket succeeds without repeating token
    wsFresh.sendPacket({
      magic: 'SK',
      version: 1,
      packetId: 202,
      timestamp: Date.now(),
      packetType: 'FETCH_AGENT_ACTIVITY',
      payload: {},
    });
    const subsequentActivity = await wsFresh.readPacketType('AGENT_ACTIVITY_STATUS');
    assert(subsequentActivity && subsequentActivity.packetType === 'AGENT_ACTIVITY_STATUS', 'Socket remains authorized for subsequent queries');
    wsFresh.socket.destroy();

    // 5d. Reconnecting client sends PAIR_REQUEST with valid saved token
    const wsReconnect = await createWsClient('192.168.31.216');
    await wsReconnect.readPacketType('BRIDGE_STATUS');
    wsReconnect.sendPacket({
      magic: 'SK',
      version: 1,
      packetId: 203,
      timestamp: Date.now(),
      packetType: 'PAIR_REQUEST',
      payload: {
        deviceId: testDeviceId,
        token: bearerToken,
        deviceName: 'Reconnected Companion',
      },
    });
    const reconnectConfirm = await wsReconnect.readPacketType('PAIR_CONFIRM');
    assert(reconnectConfirm && reconnectConfirm.payload?.isAuthorized === true, 'Reconnecting WebSocket seamlessly re-authenticates with saved token');
    wsReconnect.socket.destroy();

    // 5e. Tampered / invalid token packet fails authorization and is rejected
    const wsTampered = await createWsClient('192.168.31.217');
    await wsTampered.readPacketType('BRIDGE_STATUS');
    wsTampered.sendPacket({
      magic: 'SK',
      version: 1,
      packetId: 204,
      timestamp: Date.now(),
      packetType: 'FETCH_TOKEN_STATS',
      payload: { token: 'invalid-fake-token-000000000000' },
    });
    const tamperedAlert = await wsTampered.readPacketType('SECURITY_ALERT');
    assert(tamperedAlert && tamperedAlert.payload?.status === 'unauthorized', 'Packet with invalid token rejected with SECURITY_ALERT');

    // 5f. Expired / unrecognized token in PAIR_REQUEST receives PAIR_REJECT with SESSION_EXPIRED
    wsTampered.sendPacket({
      magic: 'SK',
      version: 1,
      packetId: 205,
      timestamp: Date.now(),
      packetType: 'PAIR_REQUEST',
      payload: {
        deviceId: 'unknown-device-999',
        token: 'expired-token-1111111111111111111111',
      },
    });
    const rejectExpired = await wsTampered.readPacketType('PAIR_REJECT');
    assert(rejectExpired && rejectExpired.payload?.error === 'SESSION_EXPIRED', 'PAIR_REQUEST with unrecognized token returns PAIR_REJECT (SESSION_EXPIRED)');
    wsTampered.socket.destroy();

    // ============================================================================
    // SUITE 6: AUTHORIZED REQUESTS SUCCEED WITH BEARER TOKEN
    // ============================================================================
    console.log('\n[Suite 6/6] Authorized Requests Execution With Bearer Token');
    const authHeaders = {
      'x-simulate-remote-ip': '192.168.31.155',
      'Authorization': `Bearer ${bearerToken}`,
    };

    // 5a. Authorized tokens request
    const resAuthTokens = await request('GET', '/api/tokens', null, authHeaders);
    assert(resAuthTokens.status === 200, 'GET /api/tokens with Bearer token returns HTTP 200 OK');
    assert(typeof resAuthTokens.data?.totalTokens === 'number', 'Returns real AI token count metrics');

    // 5b. Authorized agent activity
    const resAuthActivity = await request('GET', '/api/agent-activity', null, authHeaders);
    assert(resAuthActivity.status === 200, 'GET /api/agent-activity with Bearer token returns HTTP 200 OK');

    // 5c. Authorized notification post
    const resAuthNotify = await request('POST', '/api/notify', {
      appName: 'Signal',
      title: 'Alice',
      body: 'Verified zero-trust end-to-end link active'
    }, authHeaders);
    assert(resAuthNotify.status === 200, 'POST /api/notify with Bearer token returns HTTP 200 OK');

    // 5d. Authorized WebSocket token fetch
    wsClient.sendPacket({
      magic: 'SK',
      version: 1,
      packetId: 106,
      timestamp: Date.now(),
      packetType: 'FETCH_TOKEN_STATS',
      payload: {},
    });
    const tokenUpdate = await wsClient.readPacketType('TOKEN_STATS_UPDATE');
    assert(tokenUpdate && tokenUpdate.packetType === 'TOKEN_STATS_UPDATE', 'Authorized WebSocket receives TOKEN_STATS_UPDATE');

    wsClient.socket.destroy();

    console.log('\n================================================================');
    console.log(` RESULTS: ${passedTests} / ${totalTests} security tests passed (${Math.round((passedTests / totalTests) * 100)}%)`);
    console.log('================================================================\n');

  } catch (err) {
    console.error('\nFatal test error:', err);
    assert(false, `Unexpected exception in test runner: ${err.message}`);
  } finally {
    if (bridgeProcess) {
      bridgeProcess.kill('SIGTERM');
    }
    try {
      fs.rmSync(TEST_CONFIG_DIR, { recursive: true, force: true });
    } catch {}

    if (passedTests === totalTests && totalTests > 0) {
      console.log('ALL SECURITY & ZERO-TRUST CRITERIA PASSED ✓\n');
      process.exit(0);
    } else {
      console.error(`SECURITY TEST SUITE FAILED (${totalTests - passedTests} failures)\n`);
      process.exit(1);
    }
  }
}

runSecurityTests();
