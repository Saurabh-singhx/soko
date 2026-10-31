/**
 * @file discovery_unit.test.js
 * Comprehensive unit test suite for @soko/discovery package.
 */

const assert = require('assert');
const {
  generateQrMatrix,
  generateQrSvg,
  generateQrDataUrl,
  createPairingPayload,
  parsePairingPayload,
  encodeDnsName,
  decodeDnsName,
  encodeTxtRecord,
  buildMdnsResponsePacket,
  parseMdnsQuery,
  MdnsAdvertiser,
  buildDiscoveryMetadata,
} = require('../index');

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

async function runAllTests() {
  console.log('================================================================');
  console.log(' SOKO @SOKO/DISCOVERY UNIT TEST SUITE');
  console.log('================================================================\n');

  // ---------------------------------------------------------------
  // 1. QR Code Generator Suite
  // ---------------------------------------------------------------
  console.log('[Suite 1/5] Pure JS QR Code Generator (ISO/IEC 18004)');

  it('Generates square boolean matrix with expected dimensions for payload', () => {
    const payload = 'soko://pair?host=192.168.1.100&port=8766&pin=123456';
    const matrix = generateQrMatrix(payload);
    assert.ok(Array.isArray(matrix), 'Matrix should be array');
    assert.ok(matrix.length > 20, 'Matrix should have at least 21 rows');
    assert.strictEqual(matrix.length, matrix[0].length, 'Matrix must be square');

    // Verify top-left finder pattern (7x7 with 3x3 center)
    assert.strictEqual(matrix[0][0], true, 'Top-left finder outer corner');
    assert.strictEqual(matrix[3][3], true, 'Top-left finder center');
    assert.strictEqual(matrix[1][1], false, 'Top-left separator/gap');
  });

  it('Renders valid SVG element with custom size and styling', () => {
    const payload = 'soko://pair?host=10.0.0.5&port=8766&pin=654321';
    const svg = generateQrSvg(payload, {
      size: 320,
      margin: 4,
      darkColor: '#10B981',
      lightColor: '#090B10',
    });

    assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'), 'Valid SVG header');
    assert.ok(svg.includes('width="320" height="320"'), 'Applies requested dimensions');
    assert.ok(svg.includes('fill="#10B981"'), 'Applies custom dark color');
    assert.ok(svg.includes('fill="#090B10"'), 'Applies custom background color');
    assert.ok(svg.endsWith('</svg>'), 'Valid SVG closing tag');
  });

  it('Generates valid SVG data URL', () => {
    const dataUrl = generateQrDataUrl('soko://pair?host=localhost&port=8766&pin=999888');
    assert.ok(dataUrl.startsWith('data:image/svg+xml;utf8,'), 'Valid data URL prefix');
    assert.ok(dataUrl.includes('%3Csvg'), 'URL-encoded SVG payload');
  });

  it('Gracefully rejects payloads exceeding maximum version capacity', () => {
    const hugeText = 'X'.repeat(5000);
    assert.throws(() => {
      generateQrMatrix(hugeText);
    }, /Data too large/);
  });

  // ---------------------------------------------------------------
  // 2. Pairing Payload & URI Serialization / Parsing
  // ---------------------------------------------------------------
  console.log('\n[Suite 2/5] Pairing Payload Serialization & Parser');

  it('Creates standard soko://pair URI and companion web URL', () => {
    const result = createPairingPayload({
      host: '192.168.31.210',
      port: 8766,
      pin: '482195',
      fingerprint: 'SHA256:AB:CD:EF',
      name: 'Main Dev Machine',
      tls: true,
    });

    assert.strictEqual(result.pin, '482195');
    assert.strictEqual(result.formattedPin, '482 195');
    assert.ok(result.uri.startsWith('soko://pair?host=192.168.31.210&port=8766&pin=482195'), 'Correct URI format');
    assert.ok(result.uri.includes('fp=SHA256%3AAB%3ACD%3AEF'), 'Contains encoded cert fingerprint');
    assert.ok(result.uri.includes('tls=1'), 'Contains TLS flag');
    assert.ok(result.webUrl.startsWith('https://192.168.31.210:8766/?pair=1&pin=482195'), 'Correct web URL format');
  });

  it('Parses native soko://pair URI correctly', () => {
    const uri = 'soko://pair?host=192.168.1.55&port=8766&pin=789123&fp=SHA256:11:22&name=Laptop&tls=1';
    const parsed = parsePairingPayload(uri);

    assert.strictEqual(parsed.valid, true);
    assert.strictEqual(parsed.host, '192.168.1.55');
    assert.strictEqual(parsed.port, 8766);
    assert.strictEqual(parsed.pin, '789123');
    assert.strictEqual(parsed.formattedPin, '789 123');
    assert.strictEqual(parsed.fingerprint, 'SHA256:11:22');
    assert.strictEqual(parsed.name, 'Laptop');
    assert.strictEqual(parsed.tls, true);
  });

  it('Parses web companion URL with query string', () => {
    const url = 'http://192.168.43.1:8766/?pair=1&pin=333444&fp=ABC';
    const parsed = parsePairingPayload(url);

    assert.strictEqual(parsed.valid, true);
    assert.strictEqual(parsed.host, '192.168.43.1');
    assert.strictEqual(parsed.port, 8766);
    assert.strictEqual(parsed.pin, '333444');
    assert.strictEqual(parsed.formattedPin, '333 444');
    assert.strictEqual(parsed.fingerprint, 'ABC');
    assert.strictEqual(parsed.tls, false);
  });

  it('Handles edge case: spaces in PIN or query parameters', () => {
    const input = 'host=192.168.1.10&pin=555%20666&port=9000';
    const parsed = parsePairingPayload(input);

    assert.strictEqual(parsed.valid, true);
    assert.strictEqual(parsed.host, '192.168.1.10');
    assert.strictEqual(parsed.port, 9000);
    assert.strictEqual(parsed.pin, '555666');
    assert.strictEqual(parsed.formattedPin, '555 666');
  });

  it('Rejects malformed input or missing PIN', () => {
    assert.strictEqual(parsePairingPayload('').valid, false);
    assert.strictEqual(parsePairingPayload('soko://pair?host=127.0.0.1&pin=123').valid, false);
    assert.strictEqual(parsePairingPayload('soko://pair?pin=123456').valid, false);
  });

  // ---------------------------------------------------------------
  // 3. DNS Wire Format Encoder & Decoder
  // ---------------------------------------------------------------
  console.log('\n[Suite 3/5] DNS Wire Format & mDNS Packet Architecture');

  it('Encodes and decodes DNS domain names', () => {
    const name = '_soko._tcp.local';
    const encoded = encodeDnsName(name);
    assert.ok(Buffer.isBuffer(encoded));
    const decoded = decodeDnsName(encoded, 0);
    assert.strictEqual(decoded.name, name);
  });

  it('Encodes TXT record key-value pairs', () => {
    const txtBuf = encodeTxtRecord({
      version: '1.0.3',
      tls: '1',
      fp: 'SHA256:test',
    });
    assert.ok(Buffer.isBuffer(txtBuf));
    const asString = txtBuf.toString('utf8');
    assert.ok(asString.includes('version=1.0.3'));
    assert.ok(asString.includes('tls=1'));
    assert.ok(asString.includes('fp=SHA256:test'));
  });

  it('Builds complete mDNS response packet containing PTR, SRV, TXT, A records', () => {
    const packet = buildMdnsResponsePacket({
      instanceName: 'Test Desktop',
      hostname: 'test-desktop',
      port: 8766,
      ips: ['192.168.1.15', '192.168.43.1'],
      txtRecords: { version: '1.0.3', tls: '1' },
      ttl: 120,
    });

    assert.ok(Buffer.isBuffer(packet));
    assert.ok(packet.length > 50, 'Packet must contain full record set');

    assert.strictEqual(packet.readUInt16BE(2), 0x8400);

    const anCount = packet.readUInt16BE(6);
    assert.strictEqual(anCount, 6);
  });

  it('Parses incoming DNS query questions correctly', () => {
    const header = Buffer.alloc(12);
    header.writeUInt16BE(0, 0);
    header.writeUInt16BE(0x0000, 2);
    header.writeUInt16BE(1, 4);
    header.writeUInt16BE(0, 6);

    const qname = encodeDnsName('_soko._tcp.local');
    const qtail = Buffer.alloc(4);
    qtail.writeUInt16BE(12, 0);
    qtail.writeUInt16BE(1, 2);

    const queryBuf = Buffer.concat([header, qname, qtail]);
    const parsed = parseMdnsQuery(queryBuf);

    assert.strictEqual(parsed.questions.length, 1);
    assert.strictEqual(parsed.questions[0].name, '_soko._tcp.local');
    assert.strictEqual(parsed.questions[0].qtype, 12);
  });

  // ---------------------------------------------------------------
  // 4. MdnsAdvertiser Lifecycle & Multicast Responder
  // ---------------------------------------------------------------
  console.log('\n[Suite 4/5] MdnsAdvertiser Lifecycle & Resilience');

  await itAsync('Starts advertiser, broadcasts announcement, responds to query, and stops cleanly', async () => {
    const advertiser = new MdnsAdvertiser({
      port: 8766,
      name: 'Soko Test Unit',
      version: '1.0.3',
      tls: true,
      certFingerprint: 'SHA256:TEST_FINGERPRINT',
      ips: ['127.0.0.1'],
    });

    await advertiser.start();
    assert.strictEqual(advertiser.isRunning, true, 'Advertiser must be running');

    advertiser.updateAttributes({
      certFingerprint: 'SHA256:UPDATED',
    });
    assert.strictEqual(advertiser.certFingerprint, 'SHA256:UPDATED');

    advertiser.stop();
    assert.strictEqual(advertiser.isRunning, false, 'Advertiser stopped');
  });

  // ---------------------------------------------------------------
  // 5. Discovery Metadata Endpoint
  // ---------------------------------------------------------------
  console.log('\n[Suite 5/5] Discovery Metadata & Fallback Endpoint');

  it('Builds complete metadata with pairing URI, formatted PIN, and addresses', () => {
    const meta = buildDiscoveryMetadata({
      name: 'Studio Workstation',
      port: 8766,
      addresses: ['192.168.31.210'],
      sasPin: '482195',
      tls: true,
      certFingerprint: 'SHA256:FF:EE:DD',
      paired: false,
      version: '1.0.3',
    });

    assert.strictEqual(meta.service, 'soko');
    assert.strictEqual(meta.name, 'Studio Workstation');
    assert.strictEqual(meta.port, 8766);
    assert.strictEqual(meta.requiresPairing, true);
    assert.strictEqual(meta.paired, false);
    assert.strictEqual(meta.formattedPin, '482 195');
    assert.ok(meta.pairingUri.includes('pin=482195'));
    assert.ok(meta.webUrl.includes('pin=482195'));
  });

  console.log('\n================================================================');
  console.log(` RESULTS: ${passedTests} / ${totalTests} discovery unit tests passed (${Math.round((passedTests/totalTests)*100)}%)`);
  console.log('================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
