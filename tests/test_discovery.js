/**
 * ==============================================================================
 * SOKO ZERO-CONFIGURATION DISCOVERY & QR CODE PAIRING TEST SUITE
 * ==============================================================================
 * 
 * Tests:
 * 1. HTTP Discovery endpoint (GET /api/discovery) metadata & status
 * 2. Dedicated QR SVG endpoint (GET /api/discovery/qr)
 * 3. Zero-dependency pure JS QR generator & payload serializer
 * 4. RFC 6762 / 6763 mDNS (Bonjour / Zeroconf) packet wire format & advertiser
 * 5. Full Zero-Config Handshake: Discovery payload -> PIN extraction -> Verified Pair
 */

const assert = require('assert');
const http = require('http');
const dgram = require('dgram');
const path = require('path');
const { spawn } = require('child_process');

const {
  MdnsAdvertiser,
  encodeDnsName,
  decodeDnsName,
  encodeTxtRecord,
  buildMdnsResponsePacket,
  parseMdnsQuery,
  generateQrSvg,
  generateQrMatrix,
  createPairingPayload,
  parsePairingPayload,
  buildDiscoveryMetadata,
} = require('../packages/discovery');

let totalTests = 0;
let passedTests = 0;

function it(description, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ [PASS] ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${description}`);
    console.error(err);
    process.exitCode = 1;
  }
}

async function itAsync(description, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ [PASS] ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${description}`);
    console.error(err);
    process.exitCode = 1;
  }
}

const TEST_PORT = 8796;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
let bridgeProcess = null;

async function startTestBridge() {
  return new Promise((resolve, reject) => {
    const bridgePath = path.resolve(__dirname, '../scripts/soko_bridge.js');
    bridgeProcess = spawn('node', [bridgePath], {
      env: {
        ...process.env,
        PORT: String(TEST_PORT),
        SOKO_CONFIG_DIR: `/tmp/soko-discovery-test-${Date.now()}`,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdoutData = '';
    bridgeProcess.stdout.on('data', (d) => {
      stdoutData += d.toString();
      if (stdoutData.includes(`running on port ${TEST_PORT}`)) {
        resolve();
      }
    });

    bridgeProcess.stderr.on('data', (d) => {
      // Allow warnings
    });

    bridgeProcess.on('error', reject);
    setTimeout(() => resolve(), 2500);
  });
}

function stopTestBridge() {
  if (bridgeProcess) {
    bridgeProcess.kill('SIGINT');
    bridgeProcess = null;
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log(' SOKO ZERO-CONFIGURATION DISCOVERY & QR CODE PAIRING TEST SUITE');
  console.log(` Target Server: ${BASE_URL} (Port ${TEST_PORT})`);
  console.log('================================================================\n');

  console.log('[Setup] Starting isolated Soko Bridge instance...');
  await startTestBridge();
  console.log(`  ✓ Test bridge process online on port ${TEST_PORT}\n`);

  // ---------------------------------------------------------------
  // Suite 1: HTTP Discovery REST Endpoint (/api/discovery)
  // ---------------------------------------------------------------
  console.log('[Suite 1/5] Zero-Config HTTP Discovery Endpoint (GET /api/discovery)');

  await itAsync('GET /api/discovery returns HTTP 200 with metadata', async () => {
    const res = await fetch(`${BASE_URL}/api/discovery`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.service, 'soko');
    assert.strictEqual(data.protocol, 'soko-v1');
    assert.strictEqual(data.port, TEST_PORT);
    assert.ok(Array.isArray(data.addresses), 'addresses should be array');
    assert.ok(data.addresses.length > 0, 'addresses should have at least 1 IP');
    assert.strictEqual(data.requiresPairing, true);
    assert.strictEqual(data.paired, false);
  });

  await itAsync('GET /api/discovery exports valid pairingUri and formattedPin', async () => {
    const res = await fetch(`${BASE_URL}/api/discovery`);
    const data = await res.json();

    assert.ok(typeof data.pairingUri === 'string');
    assert.ok(data.pairingUri.startsWith('soko://pair?'), `URI format unexpected: ${data.pairingUri}`);
    assert.ok(data.pairingUri.includes(`port=${TEST_PORT}`));
    assert.ok(data.pairingUri.includes('pin='));

    assert.ok(typeof data.formattedPin === 'string');
    assert.match(data.formattedPin, /^\d{3}\s\d{3}$/, 'PIN should be formatted as "XXX XXX"');
  });

  await itAsync('GET /api/discovery exports TLS state and cert fingerprint', async () => {
    const res = await fetch(`${BASE_URL}/api/discovery`);
    const data = await res.json();

    assert.strictEqual(data.tls, true);
    assert.ok(typeof data.certFingerprint === 'string');
    assert.ok(data.certFingerprint.startsWith('SHA256:'));
  });

  // ---------------------------------------------------------------
  // Suite 2: Dedicated QR Code Image Endpoint (/api/discovery/qr)
  // ---------------------------------------------------------------
  console.log('\n[Suite 2/5] Dedicated QR Code Image Endpoints');

  await itAsync('GET /api/discovery/qr renders standalone SVG with image/svg+xml header', async () => {
    const res = await fetch(`${BASE_URL}/api/discovery/qr`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers.get('content-type').includes('image/svg+xml'));

    const svgText = await res.text();
    assert.ok(svgText.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
    assert.ok(svgText.includes('viewBox='));
    assert.ok(svgText.endsWith('</svg>'));
  });

  await itAsync('GET /api/discovery/qr?size=360 respects custom size parameter', async () => {
    const res = await fetch(`${BASE_URL}/api/discovery/qr?size=360`);
    assert.strictEqual(res.status, 200);
    const svgText = await res.text();
    assert.ok(svgText.includes('width="360" height="360"'));
  });

  await itAsync('GET /api/discovery?format=qr returns SVG image directly', async () => {
    const res = await fetch(`${BASE_URL}/api/discovery?format=qr`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers.get('content-type').includes('image/svg+xml'));
    const svgText = await res.text();
    assert.ok(svgText.startsWith('<svg'));
  });

  // ---------------------------------------------------------------
  // Suite 3: Pairing Payload Serialization & URL Parsing Edge Cases
  // ---------------------------------------------------------------
  console.log('\n[Suite 3/5] Pairing Payload Serialization & Parser Edge Cases');

  it('Creates standard soko://pair URI matching specification', () => {
    const payload = createPairingPayload({
      host: '192.168.1.100',
      port: 8766,
      pin: '482195',
      fingerprint: 'SHA256:77:88',
      name: 'Workstation',
      tls: true,
    });

    assert.strictEqual(payload.pin, '482195');
    assert.strictEqual(payload.formattedPin, '482 195');
    assert.ok(payload.uri.startsWith('soko://pair?'));
    assert.ok(payload.uri.includes('host=192.168.1.100'));
    assert.ok(payload.uri.includes('pin=482195'));
  });

  it('Parses URI with query parameters and strips extra whitespace', () => {
    const uri = 'soko://pair?host=10.0.0.1&port=9000&pin=123%20456&fp=SHA256:TEST&tls=1';
    const parsed = parsePairingPayload(uri);

    assert.strictEqual(parsed.valid, true);
    assert.strictEqual(parsed.host, '10.0.0.1');
    assert.strictEqual(parsed.port, 9000);
    assert.strictEqual(parsed.pin, '123456');
    assert.strictEqual(parsed.formattedPin, '123 456');
    assert.strictEqual(parsed.fingerprint, 'SHA256:TEST');
    assert.strictEqual(parsed.tls, true);
  });

  it('Gracefully rejects malformed or incomplete URI payloads', () => {
    const invalidInputs = [
      null,
      '',
      'invalid-string',
      'soko://pair?host=192.168.1.1',         // Missing PIN
      'soko://pair?pin=123',                  // Short PIN (< 6 digits)
      'soko://pair?pin=abcdef',               // Non-digit PIN
      'soko://pair?pin=123456',               // Missing host
    ];

    invalidInputs.forEach((input) => {
      const res = parsePairingPayload(input);
      assert.strictEqual(res.valid, false, `Expected invalid for: ${input}`);
    });
  });

  // ---------------------------------------------------------------
  // Suite 4: mDNS / DNS-SD Wire Format & Packet Encoder
  // ---------------------------------------------------------------
  console.log('\n[Suite 4/5] mDNS / DNS-SD RFC 6762 Wire Format & Resolver');

  it('Encodes and decodes DNS domain names without truncation', () => {
    const domains = [
      '_soko._tcp.local',
      '_services._dns-sd._udp.local',
      'soko-desktop.local',
      'my-workstation._soko._tcp.local',
    ];

    domains.forEach((dom) => {
      const enc = encodeDnsName(dom);
      const dec = decodeDnsName(enc, 0);
      assert.strictEqual(dec.name, dom);
    });
  });

  it('Encodes TXT record attributes into length-prefixed bytes', () => {
    const txt = encodeTxtRecord({
      version: '1.0.3',
      tls: '1',
      name: 'Studio Workstation',
      proto: 'soko-v1',
    });

    const str = txt.toString('utf8');
    assert.ok(str.includes('version=1.0.3'));
    assert.ok(str.includes('tls=1'));
    assert.ok(str.includes('proto=soko-v1'));
  });

  it('Builds compliant mDNS response packet (0x8400 Authoritative)', () => {
    const packet = buildMdnsResponsePacket({
      instanceName: 'Studio Workstation',
      hostname: 'studio-host',
      port: 8766,
      ips: ['192.168.1.10', '192.168.43.1'],
      txtRecords: { version: '1.0.3', tls: '1' },
      ttl: 120,
    });

    assert.ok(Buffer.isBuffer(packet));
    // Header flags: 0x8400 (Authoritative Response)
    assert.strictEqual(packet.readUInt16BE(2), 0x8400);
    // ANCOUNT: 2 PTR + 1 SRV + 1 TXT + 2 A records = 6 records
    assert.strictEqual(packet.readUInt16BE(6), 6);
  });

  // ---------------------------------------------------------------
  // Suite 5: Full Zero-Configuration Handshake Loop
  // ---------------------------------------------------------------
  console.log('\n[Suite 5/5] Full Zero-Configuration Pairing Handshake Loop');

  await itAsync('Performs zero-config handshake: Discovery query -> PIN extract -> Paired confirm', async () => {
    // 1. Mobile companion discovers desktop via GET /api/discovery
    const discoveryRes = await fetch(`${BASE_URL}/api/discovery`);
    assert.strictEqual(discoveryRes.status, 200);
    const meta = await discoveryRes.json();

    // 2. Mobile companion extracts pairing URI & PIN (simulating 1-tap QR scan or link tap)
    const parsed = parsePairingPayload(meta.pairingUri);
    assert.strictEqual(parsed.valid, true);
    assert.ok(parsed.pin);

    // 3. Companion sends pairing request using discovered credentials
    const pairRes = await fetch(`${BASE_URL}/api/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: 'simulated-companion-device',
        deviceName: 'Simulated QR Scanner Mobile',
        pin: parsed.formattedPin,
      }),
    });

    assert.strictEqual(pairRes.status, 200);
    const pairResult = await pairRes.json();
    assert.strictEqual(pairResult.status, 'pending');

    // 4. Desktop approves pairing
    const approveRes = await fetch(`${BASE_URL}/api/devices/pair-select`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: 'simulated-companion-device',
        deviceName: 'Simulated QR Scanner Mobile',
        approved: true,
      }),
    });

    assert.strictEqual(approveRes.status, 200);
    const approveResult = await approveRes.json();
    assert.strictEqual(approveResult.success, true);
    assert.strictEqual(approveResult.status, 'paired');
    assert.ok(approveResult.token, 'Must issue bearer token upon pairing approval');

    // 5. Subsequent discovery query now reports paired: true
    const postPairDiscovery = await fetch(`${BASE_URL}/api/discovery`);
    const updatedMeta = await postPairDiscovery.json();
    assert.strictEqual(updatedMeta.paired, true);
    assert.strictEqual(updatedMeta.requiresPairing, false);
  });

  console.log('\n================================================================');
  console.log(` RESULTS: ${passedTests} / ${totalTests} discovery tests passed (${Math.round((passedTests/totalTests)*100)}%)`);
  console.log('================================================================\n');

  stopTestBridge();

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Test suite execution failed:', err);
  stopTestBridge();
  process.exit(1);
});
