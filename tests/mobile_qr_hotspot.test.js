const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const scannerSource = fs.readFileSync(path.join(__dirname, '../apps/mobile/companion/qr/universalScanner.js'), 'utf8');

function loadScanner(fetch) {
  const window = { location: { protocol: 'https:', hostname: 'appassets.androidplatform.net' }, isSecureContext: true };
  const context = { window, fetch, AbortController, URL, URLSearchParams, setTimeout, clearTimeout, console };
  vm.runInNewContext(scannerSource, context);
  return window.SokoUniversalScanner;
}

test('hotspot QR falls back to a reachable desktop interface', async () => {
  const visited = [];
  const scanner = loadScanner(async (url) => {
    visited.push(url);
    if (url.includes('192.168.43.100')) return { ok: true, json: async () => ({ service: 'soko' }) };
    throw new Error('interface unavailable');
  });
  const payload = scanner.parsePayload('soko://pair?host=192.168.31.210&port=8766&pin=123456&tls=0&alts=192.168.43.100');
  assert.equal(payload.tls, false);
  assert.deepEqual(Array.from(payload.candidateIps), ['192.168.31.210', '192.168.43.100']);
  assert.equal(await scanner.probeReachableHost(payload.candidateIps, payload.port), '192.168.43.100');
  assert.equal(visited.length, 2);
});

test('same Wi-Fi QR keeps the primary address and rejects unrelated servers', async () => {
  const scanner = loadScanner(async (url) => ({ ok: true, json: async () => ({ service: url.includes('192.168.1.15') ? 'soko' : 'other' }) }));
  const payload = scanner.parsePayload('http://192.168.1.15:8766/?pair=1&pin=654321&alts=192.168.43.100');
  assert.equal(payload.tls, false);
  assert.equal(await scanner.probeReachableHost(payload.candidateIps, payload.port), '192.168.1.15');
});
