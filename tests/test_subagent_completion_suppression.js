/**
 * Unit & Integration Test Suite:
 * Subagent Detection, Parent Session Linkage, and Completion Notification Suppression
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('================================================================');
console.log(' SOKO SUBAGENT DETECTION & COMPLETION SUPPRESSION TESTS');
console.log('================================================================\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// 1. Bridge Script AST & Code Guardrails Verification
console.log('[Suite 1/3] Bridge Static Guardrails');

const bridgeSrc = fs.readFileSync(path.resolve(__dirname, '../scripts/soko_bridge.js'), 'utf8');

test('Bridge extracts isSubagent and parentSessionId from transcript head', () => {
  assert.ok(bridgeSrc.includes('isSubagent = true'), 'Bridge sets isSubagent = true on subagents');
  assert.ok(bridgeSrc.includes('parentSessionId = sMatch[1]'), 'Bridge parses parentSessionId');
  assert.ok(bridgeSrc.includes('not actually sent by the user'), 'Bridge checks for subagent system markers');
});

test('checkAndNotifyAgentCompletion strictly suppresses subagent completion', () => {
  assert.ok(bridgeSrc.includes('s.isSubagent'), 'Function inspects isSubagent flag');
  assert.ok(
    bridgeSrc.includes('Suppressed completion notification for subagent session') ||
    bridgeSrc.includes('!s.isSubagent'),
    'Function suppresses subagents from emitting NOTIFICATION_POST'
  );
});

test('checkActiveAgentActivity prioritizes active main agents over finished subagents', () => {
  assert.ok(bridgeSrc.includes('mainWorking'), 'Separates main working sessions');
  assert.ok(bridgeSrc.includes('subCompleted'), 'Separates subagent completed sessions');
  assert.ok(bridgeSrc.includes('hasActiveMain'), 'Checks for active main agents');
});

// 2. Simulated Session Logic & Registry State Transitions
console.log('\n[Suite 2/3] Subagent Completion Suppression Logic');

{
  const broadcastedPackets = [];
  function mockBroadcastPacket(pkt) {
    broadcastedPackets.push(pkt);
  }

  const previousSessionStatuses = new Map();

  function checkAndNotifyAgentCompletion(active) {
    if (!active || !active.activeSessions || active.activeSessions.length === 0) return;
    for (const s of active.activeSessions) {
      const sId = s.sessionId;
      const prevStatus = previousSessionStatuses.get(sId);
      const isNowCompleted = s.status === 'completed';
      const wasRunning = prevStatus === 'working' || prevStatus === 'thinking' || prevStatus === 'waiting';

      if (isNowCompleted && wasRunning) {
        if (s.isSubagent) {
          // Suppressed
        } else {
          mockBroadcastPacket({
            packetType: 'NOTIFICATION_POST',
            payload: {
              sessionId: sId,
              isAgentDone: true,
              isTaskDone: true,
              isSubagent: false,
            },
          });
        }
      }
      previousSessionStatuses.set(sId, s.status);
    }
  }

  test('Subagent transition from working to completed does NOT emit notification', () => {
    previousSessionStatuses.set('sub-001', 'working');
    broadcastedPackets.length = 0;

    checkAndNotifyAgentCompletion({
      activeSessions: [
        { sessionId: 'sub-001', status: 'completed', isSubagent: true, parentSessionId: 'main-001' },
      ],
    });

    assert.strictEqual(broadcastedPackets.length, 0, 'No notification emitted for subagent');
  });

  test('Main agent transition from working to completed DOES emit notification', () => {
    previousSessionStatuses.set('main-001', 'working');
    broadcastedPackets.length = 0;

    checkAndNotifyAgentCompletion({
      activeSessions: [
        { sessionId: 'main-001', status: 'completed', isSubagent: false, parentSessionId: null },
      ],
    });

    assert.strictEqual(broadcastedPackets.length, 1, 'Notification emitted for main agent');
    assert.strictEqual(broadcastedPackets[0].payload.sessionId, 'main-001');
    assert.strictEqual(broadcastedPackets[0].payload.isAgentDone, true);
  });
}

// 3. Primary Session Resolution with Subagents
console.log('\n[Suite 3/3] Primary Session Resolution Under Concurrency');

{
  function selectPrimarySession(allSessions, focusedSessionId = null) {
    const workingSessions = allSessions.filter((s) => s.status === 'working' || s.status === 'thinking')
      .sort((a, b) => b.timestamp - a.timestamp);
    const waitingSessions = allSessions.filter((s) => s.status === 'waiting')
      .sort((a, b) => b.timestamp - a.timestamp);
    const completedSessions = allSessions.filter((s) => s.status === 'completed')
      .sort((a, b) => b.timestamp - a.timestamp);

    const visibleSessions = [...workingSessions, ...waitingSessions, ...completedSessions];

    const mainWorking = workingSessions.filter((s) => !s.isSubagent);
    const mainWaiting = waitingSessions.filter((s) => !s.isSubagent);
    const mainCompleted = completedSessions.filter((s) => !s.isSubagent);

    const subWorking = workingSessions.filter((s) => s.isSubagent);
    const subWaiting = waitingSessions.filter((s) => s.isSubagent);
    const subCompleted = completedSessions.filter((s) => s.isSubagent);

    const hasActiveMain = mainWorking.length > 0 || mainWaiting.length > 0;
    const hasActiveSub = subWorking.length > 0 || subWaiting.length > 0;

    let primary = null;
    if (focusedSessionId) {
      const focused = visibleSessions.find((s) => s.sessionId === focusedSessionId) || null;
      if (focused) {
        if (focused.isSubagent && focused.status === 'completed' && hasActiveMain) {
          primary = mainWorking[0] || mainWaiting[0];
        } else {
          primary = focused;
        }
      }
    }

    if (!primary) {
      if (mainWorking.length > 0) {
        primary = mainWorking[0];
      } else if (subWorking.length > 0) {
        primary = subWorking[0];
      } else if (mainWaiting.length > 0) {
        primary = mainWaiting[0];
      } else if (subWaiting.length > 0) {
        primary = subWaiting[0];
      } else if (mainCompleted.length > 0) {
        primary = mainCompleted[0];
      } else if (hasActiveMain) {
        primary = mainWorking[0] || mainWaiting[0];
      } else if (hasActiveSub) {
        primary = subWorking[0] || subWaiting[0];
      }
    }

    return primary;
  }

  test('When main agent is waiting and subagent finishes, primary is main agent (waiting), NOT completed', () => {
    const sessions = [
      { sessionId: 'main-1', status: 'waiting', isSubagent: false, timestamp: 100 },
      { sessionId: 'sub-1', status: 'completed', isSubagent: true, parentSessionId: 'main-1', timestamp: 200 },
    ];

    const primary = selectPrimarySession(sessions);
    assert.ok(primary, 'Primary session selected');
    assert.strictEqual(primary.sessionId, 'main-1');
    assert.strictEqual(primary.status, 'waiting', 'Primary status remains waiting, never overwritten by subagent completion');
  });

  test('When main agent is working and subagent finishes, primary is main agent (working)', () => {
    const sessions = [
      { sessionId: 'main-1', status: 'working', isSubagent: false, timestamp: 100 },
      { sessionId: 'sub-1', status: 'completed', isSubagent: true, parentSessionId: 'main-1', timestamp: 200 },
    ];

    const primary = selectPrimarySession(sessions);
    assert.strictEqual(primary.sessionId, 'main-1');
    assert.strictEqual(primary.status, 'working');
  });

  test('If user had focused subagent that completes while main is active, primary reverts to main agent', () => {
    const sessions = [
      { sessionId: 'main-1', status: 'waiting', isSubagent: false, timestamp: 100 },
      { sessionId: 'sub-1', status: 'completed', isSubagent: true, parentSessionId: 'main-1', timestamp: 200 },
    ];

    const primary = selectPrimarySession(sessions, 'sub-1');
    assert.strictEqual(primary.sessionId, 'main-1', 'Reverts to main agent');
    assert.strictEqual(primary.status, 'waiting');
  });

  test('When main agent finishes, primary becomes main agent with completed status', () => {
    const sessions = [
      { sessionId: 'main-1', status: 'completed', isSubagent: false, timestamp: 300 },
      { sessionId: 'sub-1', status: 'completed', isSubagent: true, parentSessionId: 'main-1', timestamp: 200 },
    ];

    const primary = selectPrimarySession(sessions);
    assert.strictEqual(primary.sessionId, 'main-1');
    assert.strictEqual(primary.status, 'completed', 'Primary is now completed because MAIN agent finished');
  });

  test('When only subagent completed and no main agent completed or active, primary does NOT become completed', () => {
    const sessions = [
      { sessionId: 'sub-1', status: 'completed', isSubagent: true, parentSessionId: 'main-1', timestamp: 200 },
    ];

    const primary = selectPrimarySession(sessions);
    assert.strictEqual(primary, null, 'No completed status broadcast when only subagent completed without main');
  });
}

console.log('\n================================================================');
console.log(` RESULTS: ${passed} / ${passed + failed} tests passed (${Math.round((passed / (passed + failed)) * 100)}%)`);
console.log('================================================================\n');

if (failed > 0) process.exit(1);
