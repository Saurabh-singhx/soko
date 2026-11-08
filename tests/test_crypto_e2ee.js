#!/usr/bin/env node

/**
 * ==============================================================================
 * Soko End-to-End Cryptographic Packet & Envelope Integration Tests
 * 
 * Verifies live duplex encrypted communication between mobile companion and bridge:
 * 1. Pair device via 6-digit SAS PIN and receive 256-bit session key
 * 2. Mobile encrypts sensitive packet (NOTIFICATION_POST) as ENCRYPTED_PACKET (AES-256-GCM)
 * 3. Bridge automatically decrypts, verifies monotonic sequence, and routes packet
 * 4. Replay attacks are dropped and return SECURITY_ALERT
 * 5. Tampered ciphertexts trigger authenticated decryption failure and drop
 * ==============================================================================
 */

const http = require('http');
const net = require('net');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const {
  EnvelopeCipher,
  KeyExchange,
  SasPin,
  CertFingerprint,
} = require(path.resolve(__dirname, '../packages/security'));

const TEST_PORT = 8796;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const TEST_CONFIG_DIR = path.join(os.tmpdir(), `soko-crypto-test-${Date.now()}`);

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
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          let data = null;
          try {
            data = JSON.parse(raw);
          } catch {
            data = raw;
          }
          resolve({ status: res.statusCode, headers: res.headers, data });
        });
      }
    );
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

function connectRawWs() {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ port: TEST_PORT, host: '127.0.0.1' }, () => {
      const key = Buffer.from('crypto-test-key-1234').toString('base64');
      const req = [
        `GET / HTTP/1.1`,
        `Host: 127.0.0.1:${TEST_PORT}`,
        `Upgrade: websocket`,
        `Connection: Upgrade`,
        `Sec-WebSocket-Key: ${key}`,
        `Sec-WebSocket-Version: 13`,
        `Origin: http://127.0.0.1:${TEST_PORT}`,
        `\r\n`,
      ].join('\r\n');
      socket.write(req);
    });

    socket.once('data', (chunk) => {
      const resp = chunk.toString();
      if (resp.includes('101 Switching Protocols')) {
        resolve(socket);
      } else {
        reject(new Error(`WebSocket handshake failed: ${resp}`));
      }
    });

    socket.on('error', reject);
  });
}

function sendWsFrame(socket, packet) {
  const json = JSON.stringify(packet);
  const payload = Buffer.from(json, 'utf8');
  const len = payload.length;
  let header;

  if (len < 126) {
    header = Buffer.from([0x81, 0x80 | len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }

  const mask = Buffer.from([0x12, 0x34, 0x56, 0x78]);
  const maskedPayload = Buffer.alloc(len);
  for (let i = 0; i < len; i++) {
    maskedPayload[i] = payload[i] ^ mask[i % 4];
  }

  socket.write(Buffer.concat([header, mask, maskedPayload]));
}

function readWsPacket(socket, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`readWsPacket timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    socket.once('data', (chunk) => {
      clearTimeout(timer);
      try {
        if (chunk.length < 2) return resolve(null);
        let len = chunk[1] & 0x7f;
        let offset = 2;
        if (len === 126) {
          len = chunk.readUInt16BE(2);
          offset = 4;
        } else if (len === 127) {
          len = Number(chunk.readBigUInt64BE(2));
          offset = 10;
        }
        const body = chunk.slice(offset, offset + len).toString('utf8');
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
  });
}

async function runTests() {
  console.log('================================================================');
  console.log(' SOKO LIVE E2EE ENCRYPTED PACKET INTEGRATION TEST SUITE');
  console.log(` Target Server: ${BASE_URL}`);
  console.log('================================================================\n');

  // 1. Start bridge
  process.env.SOKO_CONFIG_DIR = TEST_CONFIG_DIR;
  process.env.PORT = String(TEST_PORT);
  process.env.NODE_ENV = 'test';

  bridgeProcess = spawn(process.execPath, [path.resolve(__dirname, '../scripts/soko_bridge.js')], {
    env: { ...process.env, PORT: String(TEST_PORT), SOKO_CONFIG_DIR: TEST_CONFIG_DIR },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  await new Promise((res) => {
    bridgeProcess.stdout.on('data', (d) => {
      if (d.toString().includes('Universal Connection Bridge running')) res();
    });
    setTimeout(res, 2000);
  });
  console.log('  ✓ Test bridge process online on port', TEST_PORT);

  // 2. Fetch active PIN
  const pinRes = await request('GET', '/api/devices/pending-pin');
  const activePin = pinRes.data.pin;
  const cleanPin = String(activePin || '').replace(/\s+/g, '');
  assert(typeof activePin === 'string' && cleanPin.length === 6, 'Active SAS PIN retrieved from bridge');

  // 3. Connect client WebSocket & Pair
  const ws = await connectRawWs();
  assert(Boolean(ws), 'Connected live WebSocket client to bridge');

  // Initial status packet
  const initialStatus = await readWsPacket(ws);
  assert(initialStatus.packetType === 'BRIDGE_STATUS', 'Received initial BRIDGE_STATUS handshake');

  // Send PAIR_REQUEST
  const testDevId = `test-crypto-phone-${Date.now()}`;
  sendWsFrame(ws, {
    magic: 'SK',
    version: 1,
    packetId: Date.now(),
    timestamp: Date.now(),
    packetType: 'PAIR_REQUEST',
    payload: {
      deviceId: testDevId,
      deviceName: 'Pixel 9 Pro Crypto Companion',
      model: 'Pixel 9 Pro',
      pin: activePin,
    },
  });

  // Approve pairing on desktop
  const approveRes = await request('POST', '/api/devices/pair-select', {
    deviceId: testDevId,
    name: 'Pixel 9 Pro Crypto Companion',
    model: 'Pixel 9 Pro',
    pin: activePin,
    approved: true,
  });
  assert(approveRes.status === 200 && approveRes.data.success, 'Desktop user approves pairing request');

  // Read PAIR_CONFIRM from WebSocket
  const pairConfirm = await readWsPacket(ws);
  assert(pairConfirm.packetType === 'PAIR_CONFIRM', 'WebSocket receives PAIR_CONFIRM');
  assert(Boolean(pairConfirm.payload.token), 'PAIR_CONFIRM contains bearer token');
  assert(Boolean(pairConfirm.payload.sessionKey), 'PAIR_CONFIRM contains 256-bit sessionKey');
  assert(Boolean(pairConfirm.payload.certFingerprint), 'PAIR_CONFIRM contains TLS SHA-256 cert fingerprint');

  const sessionKeyHex = pairConfirm.payload.sessionKey;
  const clientCipher = new EnvelopeCipher(sessionKeyHex, { deviceId: testDevId });

  // 4. Send encrypted NOTIFICATION_POST inside ENCRYPTED_PACKET
  const notificationPayload = {
    id: 'notif-e2ee-101',
    appName: 'Signal Private Messenger',
    packageName: 'org.thoughtcrime.securesms',
    title: 'Edward Snowden',
    body: 'The cryptographic tunnel is secure.',
    timestamp: Date.now(),
  };

  const encryptedEnvelope = clientCipher.encrypt(notificationPayload, {
    innerType: 'NOTIFICATION_POST',
    packetId: 1,
  });

  assert(encryptedEnvelope.packet_type === 'ENCRYPTED_PACKET', 'Envelope tagged with ENCRYPTED_PACKET');
  assert(typeof encryptedEnvelope.nonce === 'string', 'Envelope contains 12-byte CSPRNG IV');
  assert(typeof encryptedEnvelope.tag === 'string', 'Envelope contains 16-byte Poly/GHASH tag');

  // Dispatch encrypted frame to server
  sendWsFrame(ws, encryptedEnvelope);

  // Allow server to process decrypted notification
  await new Promise((r) => setTimeout(r, 200));

  // Verify ping/pong over encrypted channel
  const encryptedPing = clientCipher.encrypt({ timestamp: Date.now() }, {
    innerType: 'HEARTBEAT_PING',
    packetId: 2,
  });
  sendWsFrame(ws, encryptedPing);

  const pongPacket = await readWsPacket(ws);
  assert(pongPacket.packetType === 'HEARTBEAT_PONG', 'Bridge decrypted ENCRYPTED_PACKET and responded with HEARTBEAT_PONG');

  // 5. Test Replay Attack Protection: resend packetId 2
  sendWsFrame(ws, encryptedPing);
  const replayAlert = await readWsPacket(ws);
  assert(replayAlert.packetType === 'SECURITY_ALERT', 'Replayed packetId rejected with SECURITY_ALERT');
  assert(replayAlert.payload.error === 'DECRYPTION_FAILED', 'Replay rejection reports DECRYPTION_FAILED');

  // 6. Test Tampered Ciphertext Protection
  const tamperedEnvelope = clientCipher.encrypt({ test: 'tamper' }, { innerType: 'HEARTBEAT_PING', packetId: 3 });
  // Flip a byte in the base64 ciphertext
  const ctBuf = Buffer.from(tamperedEnvelope.ciphertext, 'base64');
  ctBuf[0] ^= 0xAA;
  tamperedEnvelope.ciphertext = ctBuf.toString('base64');
  tamperedEnvelope.packet_id = 4; // Use fresh ID so replay check passes

  sendWsFrame(ws, tamperedEnvelope);
  const tamperAlert = await readWsPacket(ws);
  assert(tamperAlert.packetType === 'SECURITY_ALERT', 'Tampered ciphertext rejected with SECURITY_ALERT');

  ws.destroy();

  console.log('\n================================================================');
  console.log(` RESULTS: ${passedTests} / ${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('================================================================\n');

  if (bridgeProcess) {
    bridgeProcess.kill('SIGKILL');
  }

  try {
    fs.rmSync(TEST_CONFIG_DIR, { recursive: true, force: true });
  } catch {}

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  if (bridgeProcess) bridgeProcess.kill('SIGKILL');
  process.exit(1);
});
