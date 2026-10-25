/**
 * Test Suite: Soko Device Scanning Guardrails & Edge Cases
 * Verifies:
 * 1. Initial automatic scan runs strictly once when disconnected.
 * 2. When device is already connected, auto-scan does NOT execute.
 * 3. Manual scan on demand is always allowed.
 * 4. Calling scanForDevices while connected preserves the 'connected' status and active device.
 * 5. Concurrent / in-flight scan calls are debounced and share the active promise.
 */

const assert = require('assert');

// Mock DiscoveredDevice and PairedDevice
const mockDiscovered = [
  { id: 'bt-earbuds', name: 'Galaxy Buds Pro', model: 'Galaxy Buds Pro', transport: 'ble', rssi: -55 },
  { id: 'wifi-phone', name: 'Pixel 8 Pro', model: 'Pixel 8 Pro', transport: 'wifi', rssi: -40 }
];

console.log('================================================================');
console.log(' SOKO DEVICE SCANNING GUARDRAILS & EDGE CASES TEST SUITE');
console.log('================================================================\n');

class TestConnectionManager {
  constructor() {
    this.status = 'disconnected';
    this.activeDevice = null;
    this.hasAutoScanned = false;
    this.activeScanPromise = null;
    this.isScanning = false;
    this.statusUpdates = [];
  }

  notifyStatus() {
    this.statusUpdates.push({ status: this.status, activeDevice: this.activeDevice });
  }

  hasPerformedAutoScan() {
    return this.hasAutoScanned;
  }

  isCurrentlyScanning() {
    return this.isScanning;
  }

  scanForDevices() {
    if (this.activeScanPromise) {
      return this.activeScanPromise;
    }

    this.hasAutoScanned = true;
    this.isScanning = true;
    const wasConnected = this.status === 'connected' || this.activeDevice !== null;

    if (!wasConnected) {
      this.status = 'scanning';
      this.notifyStatus();
    }

    const runScan = async () => {
      // Simulate async bridge latency
      await new Promise((r) => setTimeout(r, 20));
      return mockDiscovered;
    };

    this.activeScanPromise = runScan().finally(() => {
      this.isScanning = false;
      this.activeScanPromise = null;
      if (!wasConnected && this.status === 'scanning') {
        this.status = 'disconnected';
        this.notifyStatus();
      }
    });

    return this.activeScanPromise;
  }

  async autoScanOnce() {
    if (this.hasAutoScanned || this.status === 'connected' || this.activeDevice !== null) {
      return null;
    }
    return this.scanForDevices();
  }
}

async function runTests() {
  let passed = 0;
  let total = 0;

  async function asyncTest(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✓ [PASS] ${name}`);
      passed++;
    } catch (e) {
      console.error(`  ✗ [FAIL] ${name}:`, e.message);
      process.exitCode = 1;
    }
  }

  console.log('[Suite 1/3] Auto-Scan One-Time Execution & Connection State Defense');

  await asyncTest('Initial autoScanOnce executes scan when disconnected', async () => {
    const mgr = new TestConnectionManager();
    assert.strictEqual(mgr.hasPerformedAutoScan(), false);
    const result = await mgr.autoScanOnce();
    assert.ok(Array.isArray(result));
    assert.strictEqual(result.length, 2);
    assert.strictEqual(mgr.hasPerformedAutoScan(), true);
  });

  await asyncTest('Subsequent autoScanOnce calls do NOT execute (strictly one time)', async () => {
    const mgr = new TestConnectionManager();
    await mgr.autoScanOnce();
    assert.strictEqual(mgr.hasPerformedAutoScan(), true);

    const secondResult = await mgr.autoScanOnce();
    assert.strictEqual(secondResult, null, 'Second auto-scan must return null');
  });

  await asyncTest('If device is ALREADY connected, autoScanOnce does NOT scan', async () => {
    const mgr = new TestConnectionManager();
    mgr.status = 'connected';
    mgr.activeDevice = { id: 'pixel-8', name: 'Pixel 8', model: 'Pixel', isAuthorized: true };

    const result = await mgr.autoScanOnce();
    assert.strictEqual(result, null, 'Auto-scan must not scan when device is connected');
    assert.strictEqual(mgr.isCurrentlyScanning(), false);
  });

  console.log('\n[Suite 2/3] Connected-State Protection During Manual Scan');

  await asyncTest('Manual scan while connected does NOT clobber connected status or activeDevice', async () => {
    const mgr = new TestConnectionManager();
    mgr.status = 'connected';
    mgr.activeDevice = { id: 'pixel-8', name: 'Pixel 8', model: 'Pixel', isAuthorized: true };

    const scanPromise = mgr.scanForDevices();
    assert.strictEqual(mgr.status, 'connected', 'Status must remain connected while scanning');
    assert.strictEqual(mgr.isCurrentlyScanning(), true);

    const result = await scanPromise;
    assert.ok(Array.isArray(result));
    assert.strictEqual(mgr.status, 'connected', 'Status must stay connected after scan finishes');
    assert.strictEqual(mgr.activeDevice.id, 'pixel-8', 'Active device must be preserved');
    assert.strictEqual(mgr.statusUpdates.length, 0, 'No status changes should be emitted when scanning while connected');
  });

  console.log('\n[Suite 3/3] Concurrency Debounce & Transition Validation');

  await asyncTest('Multiple concurrent scan calls share the exact same in-flight promise', async () => {
    const mgr = new TestConnectionManager();
    const p1 = mgr.scanForDevices();
    const p2 = mgr.scanForDevices();
    const p3 = mgr.scanForDevices();

    assert.strictEqual(p1, p2, 'Concurrent scan 1 and 2 must share promise');
    assert.strictEqual(p2, p3, 'Concurrent scan 2 and 3 must share promise');

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
    assert.strictEqual(r1, r2);
    assert.strictEqual(r2, r3);
  });

  await asyncTest('When disconnected, scan transitions disconnected -> scanning -> disconnected', async () => {
    const mgr = new TestConnectionManager();
    assert.strictEqual(mgr.status, 'disconnected');

    const p = mgr.scanForDevices();
    assert.strictEqual(mgr.status, 'scanning');

    await p;
    assert.strictEqual(mgr.status, 'disconnected');
    assert.strictEqual(mgr.statusUpdates.length, 2);
    assert.strictEqual(mgr.statusUpdates[0].status, 'scanning');
    assert.strictEqual(mgr.statusUpdates[1].status, 'disconnected');
  });

  console.log('\n================================================================');
  console.log(` RESULTS: ${passed} / ${total} tests passed (${Math.round((passed / total) * 100)}%)`);
  console.log('================================================================');
}

runTests();
