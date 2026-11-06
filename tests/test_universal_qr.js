/**
 * @file test_universal_qr.js
 * Comprehensive Test Suite for Soko Universal QR Pairing Engine (Option 3).
 *
 * Edge Cases Tested:
 * 1. Interface resolution & virtual bridge filtering (docker0, virbr0, veth).
 * 2. Universal Web URL generation (standard camera compatibility).
 * 3. Native soko:// URI generation.
 * 4. Wi-Fi Hotspot schema generation with RFC escaping.
 * 5. Universal parser handling Web, Native, Wi-Fi, JSON, and Raw PIN formats.
 * 6. Expiration & Replay attack defense (exp timestamp validation).
 * 7. Unicode workstation name encoding/decoding (e.g. Soko そ小).
 * 8. Zero-Trust TLS fingerprint pinning and security validation.
 */

const assert = require('assert');
const {
  buildUniversalQrPayload,
  parseUniversalQrPayload,
  resolveNetworkInterfaces,
  classifyInterfaceType,
  isVirtualInterface,
  validateQrSecurity,
  escapeWifiString,
  unescapeWifiString,
  PairingMode,
  InterfaceType,
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

async function runTests() {
  console.log('================================================================');
  console.log(' SOKO UNIVERSAL QR PAIRING ENGINE TEST SUITE (OPTION 3)');
  console.log('================================================================\n');

  // ----------------------------------------------------------------
  // Suite 1: Network Interface Classification & Virtual Bridge Filter
  // ----------------------------------------------------------------
  console.log('[Suite 1/5] Network Interface Classification & Virtual Bridge Filtering');

  it('Classifies physical Wi-Fi, Ethernet, and Hotspot interfaces with proper priority', () => {
    assert.strictEqual(classifyInterfaceType('wlan0'), InterfaceType.WIFI);
    assert.strictEqual(classifyInterfaceType('wlo1'), InterfaceType.WIFI);
    assert.strictEqual(classifyInterfaceType('Wi-Fi 2'), InterfaceType.WIFI);
    assert.strictEqual(classifyInterfaceType('eth0'), InterfaceType.ETHERNET);
    assert.strictEqual(classifyInterfaceType('enp2s0'), InterfaceType.ETHERNET);
    assert.strictEqual(classifyInterfaceType('ap0'), InterfaceType.HOTSPOT);
    assert.strictEqual(classifyInterfaceType('lo'), InterfaceType.LOOPBACK);
  });

  it('Detects and filters out Docker, Podman, libvirt, and container virtual bridges', () => {
    assert.strictEqual(isVirtualInterface('docker0'), true);
    assert.strictEqual(isVirtualInterface('br-49737ea06e06'), true);
    assert.strictEqual(isVirtualInterface('virbr0'), true);
    assert.strictEqual(isVirtualInterface('veth12345'), true);
    assert.strictEqual(isVirtualInterface('tailscale0'), true);
    assert.strictEqual(isVirtualInterface('vEthernet (WSL)'), true);
    assert.strictEqual(isVirtualInterface('wlo1'), false);
    assert.strictEqual(isVirtualInterface('eth0'), false);
  });

  it('Resolves primary IP and produces candidate fallback list (alts)', () => {
    const net = resolveNetworkInterfaces();
    assert.ok(net.primaryIp, 'Primary IP must be defined');
    assert.ok(Array.isArray(net.candidateIps), 'candidateIps must be an array');
    assert.ok(net.candidateIps.length > 0, 'candidateIps must contain at least one address');
    assert.strictEqual(net.candidateIps[0], net.primaryIp, 'Primary IP must be first candidate');
  });

  // ----------------------------------------------------------------
  // Suite 2: Universal Web URL & Payload Generation
  // ----------------------------------------------------------------
  console.log('\n[Suite 2/5] Universal Web URL & Native URI Generation');

  it('Generates Universal Web URL by default for standard camera compatibility', () => {
    const payload = buildUniversalQrPayload({
      host: '192.168.1.50',
      port: 8766,
      pin: '482195',
      name: 'Studio Workstation',
      fingerprint: 'SHA256:DD:72:26:C2:1F:42:D3:E6:BC:1F:47:A8:A3:EF:69:9E:02:7C:4C:C0:C1:3B:F7:1B:3E:6E:3B:9C:7E:79:63:5C',
      tls: false,
      alts: '192.168.31.210,10.0.0.12',
      ttlSeconds: 300,
    });

    assert.strictEqual(payload.mode, PairingMode.WEB);
    assert.ok(payload.qrPayload.startsWith('http://192.168.1.50:8766/?pair=1'));
    assert.ok(payload.qrPayload.includes('pin=482195'));
    assert.ok(payload.qrPayload.includes('exp='));
    assert.ok(payload.qrPayload.includes('alts=192.168.31.210%2C10.0.0.12') || payload.qrPayload.includes('alts=192.168.31.210'));
    assert.strictEqual(payload.formattedPin, '482 195');
    assert.ok(payload.svg.includes('<svg'), 'Must render SVG element');
  });

  it('Generates Native Soko URI when mode=native is specified', () => {
    const payload = buildUniversalQrPayload({
      host: '192.168.1.50',
      port: 8766,
      pin: '789123',
      mode: PairingMode.NATIVE,
    });

    assert.strictEqual(payload.mode, PairingMode.NATIVE);
    assert.ok(payload.qrPayload.startsWith('soko://pair?'));
    assert.ok(payload.qrPayload.includes('host=192.168.1.50'));
    assert.ok(payload.qrPayload.includes('pin=789123'));
  });

  it('Generates Wi-Fi Hotspot barcode schema when mode=wifi is specified', () => {
    const payload = buildUniversalQrPayload({
      host: '192.168.43.1',
      pin: '123456',
      mode: PairingMode.WIFI,
      wifiSsid: 'Soko-Workstation',
      wifiPassword: 'secure;password:123',
    });

    assert.strictEqual(payload.mode, PairingMode.WIFI);
    assert.ok(payload.qrPayload.startsWith('WIFI:S:Soko-Workstation;T:WPA;'));
    assert.ok(payload.qrPayload.includes('P:secure\\;password\\:123;;'));
  });

  // ----------------------------------------------------------------
  // Suite 3: Universal QR Parser Multi-Format Handling
  // ----------------------------------------------------------------
  console.log('\n[Suite 3/5] Universal QR Parser Multi-Format Handling');

  it('Parses Universal Web URL into structured pairing parameters', () => {
    const url = 'http://192.168.1.50:8766/?pair=1&pin=482195&fp=SHA256:DD:72:26:C2:1F:42:D3:E6:BC:1F:47:A8:A3:EF:69:9E:02:7C:4C:C0:C1:3B:F7:1B:3E:6E:3B:9C:7E:79:63:5C&name=Soko%20Studio&alts=10.0.0.5&exp=' + (Math.floor(Date.now() / 1000) + 200);
    const parsed = parseUniversalQrPayload(url);

    assert.strictEqual(parsed.valid, true);
    assert.strictEqual(parsed.mode, PairingMode.WEB);
    assert.strictEqual(parsed.host, '192.168.1.50');
    assert.strictEqual(parsed.port, 8766);
    assert.strictEqual(parsed.pin, '482195');
    assert.strictEqual(parsed.formattedPin, '482 195');
    assert.strictEqual(parsed.name, 'Soko Studio');
    assert.strictEqual(parsed.isExpired, false);
    assert.deepStrictEqual(parsed.alts, ['10.0.0.5']);
    assert.deepStrictEqual(parsed.candidateIps, ['192.168.1.50', '10.0.0.5']);
  });

  it('Parses Native Soko URI identically to Web URL', () => {
    const uri = 'soko://pair?host=192.168.1.50&port=8766&pin=482195&tls=1';
    const parsed = parseUniversalQrPayload(uri);

    assert.strictEqual(parsed.valid, true);
    assert.strictEqual(parsed.mode, PairingMode.NATIVE);
    assert.strictEqual(parsed.host, '192.168.1.50');
    assert.strictEqual(parsed.port, 8766);
    assert.strictEqual(parsed.pin, '482195');
    assert.strictEqual(parsed.tls, true);
  });

  it('Parses Wi-Fi Hotspot QR schema and unescapes credentials', () => {
    const wifiQr = 'WIFI:S:My\\;Network;T:WPA;P:secret\\:pass;;';
    const parsed = parseUniversalQrPayload(wifiQr);

    assert.strictEqual(parsed.valid, true);
    assert.strictEqual(parsed.mode, PairingMode.WIFI);
    assert.ok(parsed.wifi);
    assert.strictEqual(parsed.wifi.ssid, 'My;Network');
    assert.strictEqual(parsed.wifi.password, 'secret:pass');
    assert.strictEqual(parsed.wifi.authType, 'WPA');
  });

  it('Parses raw 6-digit numeric PIN strings with or without space', () => {
    const p1 = parseUniversalQrPayload('482195');
    assert.strictEqual(p1.valid, true);
    assert.strictEqual(p1.pin, '482195');

    const p2 = parseUniversalQrPayload('482 195');
    assert.strictEqual(p2.valid, true);
    assert.strictEqual(p2.pin, '482195');
    assert.strictEqual(p2.formattedPin, '482 195');
  });

  it('Correctly preserves Unicode workstation names (e.g. Soko そ小)', () => {
    const unicodeName = 'Soko (そ小) Workstation 🚀';
    const payload = buildUniversalQrPayload({
      host: '192.168.1.10',
      pin: '999888',
      name: unicodeName,
    });

    const parsed = parseUniversalQrPayload(payload.webUrl);
    assert.strictEqual(parsed.valid, true);
    assert.strictEqual(parsed.name, unicodeName);
  });

  // ----------------------------------------------------------------
  // Suite 4: Expiration & Replay Attack Defense
  // ----------------------------------------------------------------
  console.log('\n[Suite 4/5] Expiration & Replay Attack Defense');

  it('Accepts unexpired pairing tokens', () => {
    const futureSec = Math.floor(Date.now() / 1000) + 180;
    const url = `http://192.168.1.50:8766/?pair=1&pin=112233&exp=${futureSec}`;
    const parsed = parseUniversalQrPayload(url);

    assert.strictEqual(parsed.isExpired, false);
    assert.ok(parsed.remainingSeconds > 0);

    const sec = validateQrSecurity(parsed);
    assert.strictEqual(sec.authorized, true);
    assert.strictEqual(sec.code, 'AUTHORIZED');
  });

  it('Rejects expired pairing tokens (preventing screenshot replay attacks)', () => {
    const pastSec = Math.floor(Date.now() / 1000) - 120; // 2 minutes ago
    const url = `http://192.168.1.50:8766/?pair=1&pin=112233&exp=${pastSec}`;
    const parsed = parseUniversalQrPayload(url);

    assert.strictEqual(parsed.isExpired, true);
    assert.strictEqual(parsed.valid, false);

    const sec = validateQrSecurity(parsed);
    assert.strictEqual(sec.authorized, false);
    assert.strictEqual(sec.code, 'INVALID_PAYLOAD');
  });

  // ----------------------------------------------------------------
  // Suite 5: Zero-Trust Security & Pinning Validation
  // ----------------------------------------------------------------
  console.log('\n[Suite 5/5] Zero-Trust Security & Pinning Validation');

  it('Validates SAS PIN matching against active server PIN', () => {
    const parsed = parseUniversalQrPayload('http://192.168.1.50:8766/?pair=1&pin=123456');

    // Matching PIN
    const pass = validateQrSecurity(parsed, { activeSasPin: '123 456' });
    assert.strictEqual(pass.authorized, true);

    // Mismatched PIN
    const fail = validateQrSecurity(parsed, { activeSasPin: '999 888' });
    assert.strictEqual(fail.authorized, false);
    assert.strictEqual(fail.code, 'PIN_MISMATCH');
  });

  it('Enforces TLS certificate fingerprint pinning verification', () => {
    const validFp = 'SHA256:DD:72:26:C2:1F:42:D3:E6:BC:1F:47:A8:A3:EF:69:9E:02:7C:4C:C0:C1:3B:F7:1B:3E:6E:3B:9C:7E:79:63:5C';
    const parsed = parseUniversalQrPayload(`http://192.168.1.50:8766/?pair=1&pin=123456&fp=${validFp}`);

    // Matching fingerprint
    const match = validateQrSecurity(parsed, { activeCertFingerprint: validFp });
    assert.strictEqual(match.authorized, true);

    // Rogue certificate fingerprint
    const rogueFp = 'SHA256:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF';
    const rogue = validateQrSecurity(parsed, { activeCertFingerprint: rogueFp });
    assert.strictEqual(rogue.authorized, false);
    assert.strictEqual(rogue.code, 'CERTIFICATE_MISMATCH');
  });

  // ----------------------------------------------------------------
  // Suite 6: Companion Web Scanner Engine & Secure Context Resilience
  // ----------------------------------------------------------------
  console.log('\n[Suite 6/6] Companion Web Scanner Engine & Secure Context Resilience');

  it('Verifies SokoUniversalScanner parsing and secure context resilience', () => {
    // Load universalScanner into sandboxed scope
    const fs = require('fs');
    const path = require('path');
    const scannerCode = fs.readFileSync(path.join(__dirname, '../apps/mobile/companion/qr/universalScanner.js'), 'utf8');
    const sandbox = { console, URL, URLSearchParams };
    const vm = require('vm');
    vm.runInNewContext(scannerCode, sandbox);
    const scanner = sandbox.SokoUniversalScanner;

    assert.ok(scanner, 'SokoUniversalScanner must be initialized');
    assert.strictEqual(typeof scanner.parsePayload, 'function');
    assert.strictEqual(typeof scanner.decodeImageFile, 'function');
    assert.strictEqual(typeof scanner.isSecureContext, 'function');

    // Parse valid universal URL
    const parsed = scanner.parsePayload('http://192.168.1.100:8766/?pair=1&pin=842915&name=SokoTest');
    assert.ok(parsed);
    assert.strictEqual(parsed.pin, '842915');
    assert.strictEqual(parsed.host, '192.168.1.100');
    assert.strictEqual(parsed.port, 8766);
    assert.strictEqual(parsed.formattedPin, '842 915');
    assert.strictEqual(parsed.name, 'SokoTest');

    // Raw PIN format
    const rawParsed = scanner.parsePayload('555 777');
    assert.ok(rawParsed);
    assert.strictEqual(rawParsed.pin, '555777');

    // Host probing sanitization (reject invalid port and malicious characters)
    return scanner.probeReachableHost(['127.0.0.1; rm -rf', 'invalid host with spaces'], 8766).then((res) => {
      assert.strictEqual(res, null, 'Rejects invalid host formats');
    });
  });

  console.log('\n================================================================');
  console.log(` RESULTS: ${passedTests} / ${totalTests} universal QR tests passed (${Math.round((passedTests/totalTests)*100)}%)`);
  console.log('================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTests();
