/**
 * ==============================================================================
 * SOKO MOBILE DEVICE DISCOVERY & SCANNING LIVE TEST SUITE
 * ==============================================================================
 *
 * Verifies:
 * 1. scanAvailableDevices():
 *    - Query ONLY active WebSocket clients from activeClients that have announced
 *      themselves as Soko Mobile (socket.isSokoMobile === true && !socket.isLocalDesktop).
 *    - Removes bluetoothctl and fake desktop self-IP entries completely.
 *    - Validates socket freshness and readyState === WebSocket.OPEN.
 *    - Device name sanitization (strips control chars, HTML tags, ANSI escapes, caps to 48 chars).
 *    - Returns clean device list with user-defined name, deviceId, model, cleanIp,
 *      transport: 'wifi', isSokoMobile: true.
 * 2. COMPANION_ANNOUNCE:
 *    - Registers discovery metadata for pairing.
 *    - Zero-Trust Security: MUST NOT authorize the socket (isAuthorized remains false).
 *    - Broadcasts BRIDGE_STATUS / DISCOVERED_DEVICE live in real time to desktop.
 *    - On socket close: immediately cleans up and broadcasts updated discovered devices list.
 */

const assert = require('assert');
const http = require('http');
const crypto = require('crypto');
const path = require('path');
const { spawn } = require('child_process');

const {
  scanAvailableDevices,
  sanitizeDeviceName,
  getDiscoveredUnpairedDevices,
  activeClients,
} = require('../scripts/soko_bridge');

let passed = 0;
let total = 0;

function it(description, fn) {
  total++;
  try {
    fn();
    console.log(`  ✓ [PASS] ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${description}:`, err.message);
    process.exitCode = 1;
  }
}

async function itAsync(description, fn) {
  total++;
  try {
    await fn();
    console.log(`  ✓ [PASS] ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${description}:`, err.message);
    process.exitCode = 1;
  }
}

console.log('================================================================');
console.log(' SOKO DEVICE DISCOVERY & SCANNING SPECIFICATION TESTS');
console.log('================================================================\n');

// ------------------------------------------------------------------------------
// Suite 1: sanitizeDeviceName Unit Tests
// ------------------------------------------------------------------------------
console.log('[Suite 1/3] Device Name Sanitization Guardrails');

it('Strips HTML tags and script injections', () => {
  const result = sanitizeDeviceName('<script>alert("xss")</script>Saurabh\'s Phone');
  assert.strictEqual(result, "Saurabh's Phone");
});

it('Strips ASCII and ANSI control characters', () => {
  const result = sanitizeDeviceName('\x1b[31mRed\x00Phone\x1F\x07');
  assert.strictEqual(result, 'RedPhone');
});

it('Caps device name to 48 characters maximum', () => {
  const longName = 'A'.repeat(80);
  const result = sanitizeDeviceName(longName);
  assert.strictEqual(result.length, 48);
  assert.strictEqual(result, 'A'.repeat(48));
});

it('Provides safe fallback for empty or non-string inputs', () => {
  assert.strictEqual(sanitizeDeviceName(''), 'Soko Mobile Companion');
  assert.strictEqual(sanitizeDeviceName(null), 'Soko Mobile Companion');
  assert.strictEqual(sanitizeDeviceName(undefined), 'Soko Mobile Companion');
});

// ------------------------------------------------------------------------------
// Suite 2: scanAvailableDevices() Unit & State Guardrails
// ------------------------------------------------------------------------------
console.log('\n[Suite 2/3] scanAvailableDevices Filtering & Verification');

it('Returns empty array when no mobile clients are connected', () => {
  activeClients.clear();
  const devices = scanAvailableDevices();
  assert.ok(Array.isArray(devices));
  assert.strictEqual(devices.length, 0, 'Must NOT return fake desktop self-IP or random bluetooth devices');
});

it('Ignores local desktop clients', () => {
  activeClients.clear();
  const desktopSocket = {
    isLocalDesktop: true,
    isSokoMobile: true,
    readyState: 1,
    destroyed: false,
    remoteAddress: '127.0.0.1',
  };
  activeClients.add(desktopSocket);
  const devices = scanAvailableDevices();
  assert.strictEqual(devices.length, 0, 'Local desktop socket must never appear in scan list');
});

it('Ignores unannounced clients (isSokoMobile !== true)', () => {
  activeClients.clear();
  const unknownSocket = {
    isLocalDesktop: false,
    isSokoMobile: false,
    readyState: 1,
    destroyed: false,
    remoteAddress: '192.168.1.50',
  };
  activeClients.add(unknownSocket);
  const devices = scanAvailableDevices();
  assert.strictEqual(devices.length, 0, 'Unannounced socket must not appear in scan list');
});

it('Ignores closed or destroyed sockets', () => {
  activeClients.clear();
  const closedSocket = {
    isLocalDesktop: false,
    isSokoMobile: true,
    readyState: 3, // CLOSED
    destroyed: false,
    deviceId: 'closed-dev',
  };
  const destroyedSocket = {
    isLocalDesktop: false,
    isSokoMobile: true,
    readyState: 1,
    destroyed: true,
    deviceId: 'destroyed-dev',
  };
  activeClients.add(closedSocket);
  activeClients.add(destroyedSocket);
  const devices = scanAvailableDevices();
  assert.strictEqual(devices.length, 0, 'Closed or destroyed sockets must be omitted');
});

it('Ignores stale sockets (> 5 minutes inactive or isFresh === false)', () => {
  activeClients.clear();
  const staleSocket = {
    isLocalDesktop: false,
    isSokoMobile: true,
    readyState: 1,
    destroyed: false,
    lastSeen: Date.now() - 6 * 60 * 1000,
    deviceId: 'stale-dev',
  };
  const explicitNotFresh = {
    isLocalDesktop: false,
    isSokoMobile: true,
    readyState: 1,
    destroyed: false,
    isFresh: false,
    deviceId: 'notfresh-dev',
  };
  activeClients.add(staleSocket);
  activeClients.add(explicitNotFresh);
  const devices = scanAvailableDevices();
  assert.strictEqual(devices.length, 0, 'Stale or not-fresh sockets must be omitted');
});

it('Returns announced mobile device with sanitized name and all required fields', () => {
  activeClients.clear();
  const mobileSocket = {
    isLocalDesktop: false,
    isSokoMobile: true,
    isAuthorized: false,
    readyState: 1,
    destroyed: false,
    lastSeen: Date.now(),
    remoteAddress: '::ffff:192.168.1.120',
    deviceId: 'pixel-8-pro-id',
    deviceName: '<b>Saurabh Galaxy S24</b>',
    deviceModel: 'Samsung Galaxy S24 Ultra',
  };
  activeClients.add(mobileSocket);

  const devices = scanAvailableDevices();
  assert.strictEqual(devices.length, 1);
  const dev = devices[0];
  assert.strictEqual(dev.deviceId, 'pixel-8-pro-id');
  assert.strictEqual(dev.name, 'Saurabh Galaxy S24', 'HTML tags must be stripped from device name');
  assert.strictEqual(dev.model, 'Samsung Galaxy S24 Ultra');
  assert.strictEqual(dev.cleanIp, '192.168.1.120', 'IPv6 ::ffff: prefix must be stripped');
  assert.strictEqual(dev.transport, 'wifi');
  assert.strictEqual(dev.isSokoMobile, true);
  assert.strictEqual(dev.isAuthorized, false, 'Unpaired device must be isAuthorized: false');
  activeClients.clear();
});

// ------------------------------------------------------------------------------
// Suite 3: Live End-to-End WebSocket COMPANION_ANNOUNCE & Disconnect Broadcast
// ------------------------------------------------------------------------------
console.log('\n[Suite 3/3] Live WebSocket COMPANION_ANNOUNCE & Broadcast Flow');

const LIVE_TEST_PORT = 8794;
let bridgeProc = null;

function startLiveBridge() {
  return new Promise((resolve, reject) => {
    const bridgePath = path.resolve(__dirname, '../scripts/soko_bridge.js');
    bridgeProc = spawn('node', [bridgePath], {
      env: {
        ...process.env,
        PORT: String(LIVE_TEST_PORT),
        SOKO_CONFIG_DIR: `/tmp/soko-scan-test-${Date.now()}`,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    bridgeProc.stdout.on('data', (d) => {
      stdout += d.toString();
      if (stdout.includes(`running on port ${LIVE_TEST_PORT}`)) {
        resolve();
      }
    });
    bridgeProc.on('error', reject);
    setTimeout(resolve, 2000);
  });
}

function stopLiveBridge() {
  if (bridgeProc) {
    bridgeProc.kill('SIGINT');
    bridgeProc = null;
  }
}

function connectRawWs(headers = {}) {
  return new Promise((resolve, reject) => {
    const key = crypto.randomBytes(16).toString('base64');
    const req = http.request({
      port: LIVE_TEST_PORT,
      host: '127.0.0.1',
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Key': key,
        'Sec-WebSocket-Version': '13',
        ...headers,
      },
    });

    req.on('upgrade', (res, socket, head) => {
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

      let buffer = head && head.length ? Buffer.from(head) : Buffer.alloc(0);
      socket.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        while (buffer.length >= 2) {
          let len = buffer[1] & 0x7f;
          let offset = 2;
          if (len === 126) {
            if (buffer.length < 4) break;
            len = buffer.readUInt16BE(2);
            offset = 4;
          } else if (len === 127) {
            if (buffer.length < 10) break;
            len = Number(buffer.readBigUInt64BE(2));
            offset = 10;
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

      function readPacketType(type, timeoutMs = 3000) {
        const existingIdx = packetQueue.findIndex((p) => p.packetType === type);
        if (existingIdx !== -1) {
          return Promise.resolve(packetQueue.splice(existingIdx, 1)[0]);
        }
        return new Promise((resWait, rejWait) => {
          const timer = setTimeout(() => {
            rejWait(new Error(`Timeout waiting for packet: ${type}`));
          }, timeoutMs);
          waiters.push({
            expectedType: type,
            resolve: (p) => {
              clearTimeout(timer);
              resWait(p);
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

function httpGet(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${LIVE_TEST_PORT}${path}`, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    }).on('error', reject);
  });
}

async function runLiveTests() {
  await startLiveBridge();

  await itAsync('GET /api/devices/scan initially returns empty list (no fake desktop self-IP)', async () => {
    const res = await httpGet('/api/devices/scan');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.devices));
    assert.strictEqual(res.body.devices.length, 0);
  });

  let desktopWs = null;
  let mobileWs = null;

  await itAsync('Desktop connects and listens for bridge status', async () => {
    desktopWs = await connectRawWs();
    const status = await desktopWs.readPacketType('BRIDGE_STATUS');
    assert.strictEqual(status.packetType, 'BRIDGE_STATUS');
    assert.strictEqual(status.payload?.discoveredDevice, null);
  });

  await itAsync('Mobile connects and sends COMPANION_ANNOUNCE with custom name', async () => {
    mobileWs = await connectRawWs({ 'x-simulate-remote-ip': '192.168.1.188' });
    // Discard initial bridge status on mobile socket
    await mobileWs.readPacketType('BRIDGE_STATUS');

    // Desktop receives client connection status update
    const desktopConnUpdate = await desktopWs.readPacketType('BRIDGE_STATUS');
    assert.strictEqual(desktopConnUpdate.payload?.activeClients, 2);

    // Send COMPANION_ANNOUNCE
    mobileWs.sendPacket({
      magic: 'SK',
      version: 1,
      packetId: Date.now(),
      timestamp: Date.now(),
      packetType: 'COMPANION_ANNOUNCE',
      payload: {
        deviceId: 'device-s24-12345',
        deviceName: '<b>Saurabh\'s Galaxy S24</b>',
        model: 'Galaxy S24 Ultra',
        platform: 'mobile',
        appOpened: true,
      },
    });

    // Mobile receives ANNOUNCE_ACK
    const ack = await mobileWs.readPacketType('ANNOUNCE_ACK');
    assert.strictEqual(ack.packetType, 'ANNOUNCE_ACK');
    assert.strictEqual(ack.payload?.registered, true);
    assert.strictEqual(ack.payload?.deviceName, "Saurabh's Galaxy S24", 'Name must be sanitized in ACK');
    assert.strictEqual(ack.payload?.requiresPairing, true, 'Zero-Trust: Mobile must NOT be auto-authorized by announce!');
  });

  await itAsync('Desktop receives real-time BRIDGE_STATUS & DISCOVERED_DEVICE with announced mobile', async () => {
    const bridgeStatus = await desktopWs.readPacketType('BRIDGE_STATUS');
    assert.ok(bridgeStatus.payload?.discoveredDevice);
    assert.strictEqual(bridgeStatus.payload.discoveredDevice.deviceId, 'device-s24-12345');
    assert.strictEqual(bridgeStatus.payload.discoveredDevice.name, "Saurabh's Galaxy S24");
    assert.strictEqual(bridgeStatus.payload.discoveredDevice.cleanIp, '192.168.1.188');
    assert.strictEqual(bridgeStatus.payload.discoveredDevice.isSokoMobile, true);
    assert.strictEqual(bridgeStatus.payload.discoveredDevice.isAuthorized, false);

    const discoveredPkt = await desktopWs.readPacketType('DISCOVERED_DEVICE');
    assert.strictEqual(discoveredPkt.payload?.device?.deviceId, 'device-s24-12345');
  });

  await itAsync('GET /api/devices/scan returns announced mobile device', async () => {
    const res = await httpGet('/api/devices/scan');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.devices.length, 1);
    const d = res.body.devices[0];
    assert.strictEqual(d.deviceId, 'device-s24-12345');
    assert.strictEqual(d.name, "Saurabh's Galaxy S24");
    assert.strictEqual(d.model, 'Galaxy S24 Ultra');
    assert.strictEqual(d.cleanIp, '192.168.1.188');
    assert.strictEqual(d.transport, 'wifi');
    assert.strictEqual(d.isSokoMobile, true);
    assert.strictEqual(d.isAuthorized, false);
  });

  await itAsync('Mobile disconnect immediately cleans up and broadcasts updated list to desktop', async () => {
    mobileWs.close();
    mobileWs = null;

    const updatedStatus = await desktopWs.readPacketType('BRIDGE_STATUS');
    assert.strictEqual(updatedStatus.payload?.discoveredDevice, null);
    assert.strictEqual(updatedStatus.payload?.discoveredDevices?.length, 0);

    const updatedScan = await httpGet('/api/devices/scan');
    assert.strictEqual(updatedScan.body.devices.length, 0, 'Scan list must be immediately empty after socket close');
  });

  if (desktopWs) desktopWs.close();
  stopLiveBridge();

  console.log('\n================================================================');
  console.log(` RESULTS: ${passed} / ${total} tests passed (${Math.round((passed / total) * 100)}%)`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
  process.exit(0);
}

runLiveTests().catch((err) => {
  console.error('Fatal live test failure:', err);
  stopLiveBridge();
  process.exit(1);
});
