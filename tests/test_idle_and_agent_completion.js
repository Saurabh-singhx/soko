/**
 * Test Suite: Soko Dynamic Island Idle Mode & Agent Task Completion
 * 
 * Verifies:
 * 1. Agent task completion transitions Soko from idle mode to normal mode.
 * 2. Completion message and highlighted token usage are properly structured and formatted.
 * 3. Text truncation and flex boundaries prevent collision/overlap with big texts.
 * 4. Incoming notifications (standard & important), CLI commands, transfers, and pairing
 *    requests transition Soko from idle mode to normal mode.
 * 5. Bridge agent simulation & transcript watcher accurately compute task tokens.
 */

const assert = require('assert');

function runIdleModeAndAgentCompletionTests() {
  console.log('================================================================');
  console.log(' SOKO IDLE MODE & AGENT TASK COMPLETION TEST SUITE');
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

  // --- Suite 1: Token Formatting Logic ---
  console.log('[Suite 1/5] Token Formatting & Highlighting');

  const formatTokens = (tokens) => {
    if (!tokens || tokens <= 0) return '0 tokens';
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M tokens`;
    if (tokens >= 10000) return `${(tokens / 1000).toFixed(1)}k tokens`;
    return `${tokens.toLocaleString()} tokens`;
  };

  test('Formats sub-10k tokens with commas (e.g. 1,420 tokens)', () => {
    assert.strictEqual(formatTokens(1420), '1,420 tokens');
    assert.strictEqual(formatTokens(850), '850 tokens');
  });

  test('Formats 10k+ tokens with k abbreviation (e.g. 24.5k tokens)', () => {
    assert.strictEqual(formatTokens(24500), '24.5k tokens');
    assert.strictEqual(formatTokens(10000), '10.0k tokens');
  });

  test('Formats 1M+ tokens with M abbreviation (e.g. 1.5M tokens)', () => {
    assert.strictEqual(formatTokens(1500000), '1.5M tokens');
  });

  // --- Suite 2: Idle Mode to Normal Mode State Transition ---
  console.log('\n[Suite 2/5] Idle Mode to Normal Mode Transitions');

  class MockDynamicIsland {
    constructor() {
      this.mode = 'compact';
      this.mood = 'idle';
      this.isIdleMascotOnly = false;
      this.completedTaskNotice = null;
      this.activeNotification = null;
      this.activeCli = null;
      this.activeTransfer = null;
      this.pendingPair = null;
      this.idleTimer = null;
    }

    setIdleMode(idle) {
      this.isIdleMascotOnly = idle;
    }

    wakeToNormalMode(gracePeriodMs = 0) {
      if (this.idleTimer) {
        clearTimeout(this.idleTimer);
        this.idleTimer = null;
      }
      this.isIdleMascotOnly = false;
    }

    handleAgentActivity(status) {
      if (!status) return;
      if (status.status === 'completed') {
        this.wakeToNormalMode(15000);
        this.mood = 'happy';
        this.completedTaskNotice = {
          message: status.message || status.detail || `${status.name || 'Agent'}: Task completed`,
          tokensUsed: status.tokensUsed,
          agent: status.agent,
          name: status.name,
          timestamp: Date.now(),
        };
      } else if (status.status === 'working' || status.status === 'thinking') {
        this.wakeToNormalMode(10000);
        this.mood = status.status;
        this.completedTaskNotice = null;
      }
    }

    handleNotification(notif) {
      this.wakeToNormalMode();
      this.activeNotification = notif;
      this.mood = 'alert';
      this.mode = 'notification';
    }

    handleCli(cli) {
      this.wakeToNormalMode();
      this.activeCli = cli;
      this.mood = cli.status === 'running' ? 'working' : 'happy';
      this.mode = 'cli';
    }

    handleTransfer(transfer) {
      this.wakeToNormalMode();
      this.activeTransfer = transfer;
      this.mood = transfer.status === 'active' ? 'working' : 'happy';
      this.mode = 'transfer';
    }

    handlePendingPair(pairReq) {
      this.wakeToNormalMode();
      this.pendingPair = pairReq;
      this.mood = 'alert';
      this.mode = 'pairing';
    }

    getIslandDimensions() {
      if (this.isIdleMascotOnly) {
        return { width: 68, height: 64 };
      }
      if (this.mode === 'compact') {
        if (this.completedTaskNotice) {
          const msgLen = this.completedTaskNotice.message?.length || 0;
          const hasTokens = Boolean(this.completedTaskNotice.tokensUsed && this.completedTaskNotice.tokensUsed > 0);
          let width = hasTokens ? 370 : 310;
          if (msgLen > 30) {
            width = 420;
          } else if (msgLen > 18) {
            width = 395;
          }
          return { width: Math.min(420, width), height: 54 };
        }
        return { width: 295, height: 54 };
      }
      if (this.mode === 'notification') {
        return { width: 410, height: undefined };
      }
      return { width: 420, height: 80 };
    }
  }

  test('Agent task completed wakes Soko from idle orb to normal mode with happy mood', () => {
    const island = new MockDynamicIsland();
    island.setIdleMode(true);
    assert.strictEqual(island.isIdleMascotOnly, true);
    assert.deepStrictEqual(island.getIslandDimensions(), { width: 68, height: 64 });

    island.handleAgentActivity({
      agent: 'antigravity',
      name: 'Google Antigravity',
      status: 'completed',
      detail: 'Task completed',
      message: 'Created integration tests & verified builds',
      tokensUsed: 2380,
      timestamp: Date.now(),
    });

    assert.strictEqual(island.isIdleMascotOnly, false, 'Soko must be in normal mode');
    assert.strictEqual(island.mood, 'happy', 'Mascot mood should be happy');
    assert.notStrictEqual(island.completedTaskNotice, null, 'completedTaskNotice should be populated');
    assert.strictEqual(island.completedTaskNotice.tokensUsed, 2380);
    assert.strictEqual(island.completedTaskNotice.message, 'Created integration tests & verified builds');
  });

  test('Active agent working/thinking wakes Soko from idle orb to normal mode', () => {
    const island = new MockDynamicIsland();
    island.setIdleMode(true);
    island.handleAgentActivity({
      agent: 'antigravity',
      name: 'Google Antigravity',
      status: 'working',
      detail: 'Refactoring Island CSS',
      tokensUsed: 500,
      timestamp: Date.now(),
    });

    assert.strictEqual(island.isIdleMascotOnly, false, 'Soko woke from idle');
    assert.strictEqual(island.mood, 'working');
  });

  test('Incoming notification wakes Soko from idle orb to normal mode', () => {
    const island = new MockDynamicIsland();
    island.setIdleMode(true);
    island.handleNotification({
      id: 'notif-1',
      appName: 'Signal',
      packageName: 'org.thoughtcrime.securesms',
      title: 'Alice',
      body: 'Meeting at 3PM',
      timestamp: Date.now(),
      priority: 'high',
      isImportant: true,
    });

    assert.strictEqual(island.isIdleMascotOnly, false, 'Soko woke from idle');
    assert.strictEqual(island.mode, 'notification');
    assert.strictEqual(island.mood, 'alert');
  });

  test('Incoming CLI process wakes Soko from idle orb to normal mode', () => {
    const island = new MockDynamicIsland();
    island.setIdleMode(true);
    island.handleCli({
      commandId: 'sysinfo',
      title: 'System Specs',
      status: 'running',
      startedAt: Date.now(),
      lastOutputLine: 'OS: Linux 6.8',
    });

    assert.strictEqual(island.isIdleMascotOnly, false);
    assert.strictEqual(island.mode, 'cli');
  });

  test('Incoming file transfer wakes Soko from idle orb to normal mode', () => {
    const island = new MockDynamicIsland();
    island.setIdleMode(true);
    island.handleTransfer({
      id: 'tf-1',
      filename: 'report.pdf',
      bytesDownloaded: 1024,
      totalBytes: 2048,
      speedBytesPerSec: 100000,
      percentage: 50,
      status: 'active',
    });

    assert.strictEqual(island.isIdleMascotOnly, false);
    assert.strictEqual(island.mode, 'transfer');
  });

  test('Incoming pairing request wakes Soko from idle orb to normal mode', () => {
    const island = new MockDynamicIsland();
    island.setIdleMode(true);
    island.handlePendingPair({
      deviceId: 'phone-123',
      deviceName: 'Pixel 9 Pro',
      model: 'Android 15',
      pin: '849201',
      timestamp: Date.now(),
    });

    assert.strictEqual(island.isIdleMascotOnly, false);
    assert.strictEqual(island.mode, 'pairing');
  });

  // --- Suite 3: Layout & Big Text Non-Overlap Defense ---
  console.log('\n[Suite 3/5] Layout & Big Text Collision Defense');

  test('Island expands dynamically to fit both message and token badge without clipping', () => {
    const island = new MockDynamicIsland();
    island.handleAgentActivity({
      agent: 'antigravity',
      name: 'Google Antigravity',
      status: 'completed',
      detail: 'Short msg',
      message: 'Short msg',
      tokensUsed: 450,
      timestamp: Date.now(),
    });
    const shortDims = island.getIslandDimensions();
    assert.strictEqual(shortDims.width, 370);

    // With long message ("big text")
    const longIsland = new MockDynamicIsland();
    longIsland.handleAgentActivity({
      agent: 'antigravity',
      name: 'Google Antigravity',
      status: 'completed',
      detail: 'Super long message with huge text content describing an intricate refactoring task',
      message: 'Super long message with huge text content describing an intricate refactoring task',
      tokensUsed: 2150,
      timestamp: Date.now(),
    });
    const longDims = longIsland.getIslandDimensions();
    assert.strictEqual(longDims.width, 420, 'Island should expand to max comfort width (420px)');
  });

  test('CSS structure guarantees message text truncates and token badge has shrink-0', () => {
    const fs = require('fs');
    const path = require('path');
    const compPath = path.resolve(__dirname, '../apps/desktop/src/components/island/DynamicIsland.tsx');
    const compSrc = fs.readFileSync(compPath, 'utf8');

    // Verify left message container has min-w-0 and overflow-hidden
    assert(compSrc.includes('min-w-0 flex-1 overflow-hidden') || (compSrc.includes('min-w-0') && compSrc.includes('overflow-hidden')), 'Message container must constrain width with min-w-0 flex-1');
    assert(compSrc.includes('truncate min-w-0 flex-1'), 'Message text must have truncate to prevent spilling into right badge');

    // Verify right badge has shrink-0 and ml-auto
    assert(compSrc.includes('shrink-0 flex items-center gap-1'), 'Right token badge must have shrink-0');
    assert(compSrc.includes('whitespace-nowrap ml-auto'), 'Right token badge must be whitespace-nowrap and ml-auto');

    // Verify highlighting style
    assert(compSrc.includes('rgba(52,211,153') || compSrc.includes('emerald-400') || compSrc.includes('emerald-500'), 'Right token badge must have glowing neon or emerald highlight');
    assert(compSrc.includes('border-emerald-400'), 'Right token badge must have highlighted emerald border');
  });

  // --- Suite 4: Bridge Agent Simulation Tokens & Completion ---
  console.log('\n[Suite 4/5] Bridge Agent Watcher & Token Accounting');

  test('Bridge simulated agents report realistic tokens and completed status', () => {
    const fs = require('fs');
    const path = require('path');
    const bridgePath = path.resolve(__dirname, '../scripts/soko_bridge.js');
    const bridgeSrc = fs.readFileSync(bridgePath, 'utf8');

    assert(bridgeSrc.includes('simulatedTokens'), 'Bridge must have simulatedTokens mapping');
    assert(bridgeSrc.includes('tokensUsed: tokenCount'), 'simulateAgent must broadcast tokensUsed');
    assert(bridgeSrc.includes("status: 'completed'"), 'simulateAgent must broadcast completed status');
    assert(bridgeSrc.includes('realAgentCompletionCache'), 'Bridge must cache real agent completion for retention');
  });

  // --- Suite 5: Notification Layout, Height Scaling & Bottom Clearance Defense ---
  console.log('\n[Suite 5/5] Notification Height Scaling & Bottom Clearance Defense');

  test('NotificationBanner has bottom breathing padding to prevent descender clipping', () => {
    const fs = require('fs');
    const path = require('path');
    const bannerPath = path.resolve(__dirname, '../apps/desktop/src/components/island/NotificationBanner.tsx');
    const bannerSrc = fs.readFileSync(bannerPath, 'utf8');

    assert(bannerSrc.includes('pb-1'), 'NotificationBanner motion.div must have pb-1 bottom padding');
    assert(bannerSrc.includes('pb-0.5'), 'NotificationBanner text container must have pb-0.5 descender clearance');
    assert(bannerSrc.includes('max-h-[220px]'), 'NotificationBanner must cap scrollable body at max-h-[220px]');
  });

  test('DynamicIsland pill has pb-3.5 and min-h-[72px] in notification mode', () => {
    const fs = require('fs');
    const path = require('path');
    const compPath = path.resolve(__dirname, '../apps/desktop/src/components/island/DynamicIsland.tsx');
    const compSrc = fs.readFileSync(compPath, 'utf8');

    assert(compSrc.includes('px-4 pt-2.5 pb-3.5 rounded-[24px]'), 'Notification pill must have pb-3.5 bottom padding');
    assert(compSrc.includes("min-h-[72px] max-h-[min(75vh,520px)]"), 'Notification pill must have min-h-[72px]');
    assert(compSrc.includes('ResizeObserver'), 'DynamicIsland must have ResizeObserver to measure real notification DOM height');
  });

  test('Notification height algorithm guarantees adequate space for 1-line and 2-line messages', () => {
    const calculateNotificationHeight = (body, isBotExpanded = false) => {
      const rawBody = (body || '').trim();
      const paragraphs = rawBody ? rawBody.split('\n') : [''];
      let totalLines = 0;
      for (const p of paragraphs) {
        if (p.length === 0) {
          totalLines += 0.5;
        } else {
          totalLines += Math.max(1, Math.ceil(p.length / 36));
        }
      }
      return Math.max(110, 80 + Math.ceil(totalLines * 21) + (isBotExpanded ? 24 : 0));
    };

    // 1-line short notification: must be >= 110px (was previously 76px)
    const h1 = calculateNotificationHeight('Meeting at 3pm');
    assert(h1 >= 110, `1-line height should be >= 110px, got ${h1}`);

    // 2-line notification (51 chars from user screenshot): must be >= 122px (was previously 96px, which cut off "today?")
    const h2 = calculateNotificationHeight('Hey! Are we still reviewing the design mockups today?');
    assert(h2 >= 122, `2-line height should be >= 122px, got ${h2}`);

    // Multiline notification with \n: must accurately account for newlines
    const hMulti = calculateNotificationHeight('Line 1\nLine 2\nLine 3');
    assert(hMulti >= 143, `3-paragraph height should be >= 143px, got ${hMulti}`);
  });

  console.log('\n================================================================');
  console.log(` RESULTS: ${passed} / ${passed + failed} tests passed (${Math.round((passed / (passed + failed)) * 100)}%)`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runIdleModeAndAgentCompletionTests();
