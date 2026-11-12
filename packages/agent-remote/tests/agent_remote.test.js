const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const {
  AgentSessionManager,
  cleanAnsi,
  formatToolCall,
  sanitizeToolOutput,
} = require('../src');

console.log('================================================================');
console.log(' SOKO AGENT REMOTE & TRANSCRIPT STREAMING UNIT TESTS');
console.log('================================================================\n');

// Create temporary mock brain & presence dirs
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soko-agent-test-'));
const mockBrainDir = path.join(tempDir, 'brain');
const mockPresenceDir = path.join(tempDir, 'presence');
fs.mkdirSync(mockBrainDir, { recursive: true });
fs.mkdirSync(mockPresenceDir, { recursive: true });

const testSessionId = 'test-session-12345';
const sessionDir = path.join(mockBrainDir, testSessionId, '.system_generated/logs');
fs.mkdirSync(sessionDir, { recursive: true });
const transcriptFile = path.join(sessionDir, 'transcript.jsonl');
const lockFile = path.join(mockPresenceDir, `${testSessionId}.lock`);
fs.writeFileSync(lockFile, '');

// Populate mock transcript lines
const sampleLines = [
  JSON.stringify({
    step_index: 1,
    type: 'USER_INPUT',
    created_at: new Date(Date.now() - 30000).toISOString(),
    content: 'Check the status of the repository and fix formatting',
  }),
  JSON.stringify({
    step_index: 2,
    type: 'PLANNER_RESPONSE',
    thinking: '\x1b[33mI need to run git status to check for modified files.\x1b[0m',
    tool_calls: [
      {
        id: 'call_1',
        name: 'run_command',
        args: {
          CommandLine: 'git status --short',
          toolSummary: 'Run git status',
        },
      },
    ],
    content: 'Running git status now...',
  }),
  JSON.stringify({
    step_index: 3,
    type: 'PLANNER_RESPONSE',
    status: 'RUNNING',
    tool_calls: [
      {
        id: 'call_2',
        name: 'edit_file',
        args: {
          Path: '/path/to/project/index.js',
          toolSummary: 'Update index.js formatting',
        },
      },
    ],
    content: 'All formatting issues resolved successfully.',
  }),
];

fs.writeFileSync(transcriptFile, sampleLines.join('\n') + '\n');

// 1. ANSI Cleaning Tests
console.log('[Suite 1/5] ANSI Escape Sequence Cleaning');
{
  const raw = '\x1b[32mSuccess!\x1b[0m \x1b[1;34mBold Blue\x1b[0m';
  const cleaned = cleanAnsi(raw);
  assert.strictEqual(cleaned, 'Success! Bold Blue', 'Strips ANSI color codes');
  assert.strictEqual(cleanAnsi(''), '', 'Handles empty string');
  assert.strictEqual(cleanAnsi(null), '', 'Handles null input safely');
  console.log('  ✓ [PASS] Strips ANSI color and styling escape sequences');
}

// 2. Tool Output Sanitization & Capping Tests
console.log('[Suite 2/5] Tool Output Sanitization & Capping (Mobile Ergonomics)');
{
  const longOutput = Array.from({ length: 100 }, (_, i) => `Log line ${i + 1}`).join('\n');
  const sanitized = sanitizeToolOutput(longOutput, 30, 2048);
  assert.strictEqual(sanitized.truncated, true, 'Flags oversized output as truncated');
  assert.strictEqual(sanitized.lineCount, 100, 'Maintains original total line count');
  assert.ok(sanitized.text.includes('Truncated 70 lines'), 'Appends friendly truncation message');

  const shortOutput = 'Line 1\nLine 2';
  const shortSanitized = sanitizeToolOutput(shortOutput, 30, 2048);
  assert.strictEqual(shortSanitized.truncated, false, 'Does not truncate short output');
  assert.strictEqual(shortSanitized.lineCount, 2);
  console.log('  ✓ [PASS] Enforces max-lines and max-bytes capping for mobile screens');
}

// 3. Tool Call Formatting Tests
console.log('[Suite 3/5] Tool Call Summary Resolution');
{
  const t1 = formatToolCall({
    name: 'run_command',
    args: { CommandLine: 'npm test -- --coverage' },
  });
  assert.strictEqual(t1.summary, '$ npm test -- --coverage');

  const t2 = formatToolCall({
    name: 'edit_file',
    args: { Path: '/home/user/app/src/main.ts' },
  });
  assert.strictEqual(t2.summary, 'Edit main.ts');
  console.log('  ✓ [PASS] Generates clean human-readable summaries for run_command and edit_file');
}

// 4. Session Discovery & Path Security Tests
console.log('[Suite 4/5] Session Discovery & Path Traversal Guardrails');
{
  const manager = new AgentSessionManager({
    brainDirs: [mockBrainDir],
    presenceDirs: [mockPresenceDir],
  });

  assert.strictEqual(manager.isValidSessionId(testSessionId), true, 'Valid UUID/string allowed');
  assert.strictEqual(manager.isValidSessionId('../../../etc/passwd'), false, 'Path traversal blocked');
  assert.strictEqual(manager.isValidSessionId('invalid/slash'), false, 'Slashes blocked');

  // Verify prompt dispatch input validation (empty or invalid sessions rejected)
  assert.rejects(async () => {
    await manager.dispatchPrompt('../../../etc/passwd', 'malicious input');
  }, /Invalid session ID/);

  assert.rejects(async () => {
    await manager.dispatchPrompt(testSessionId, '   ');
  }, /Prompt cannot be empty/);

  const discovered = manager.discoverSessions();
  assert.strictEqual(discovered.length, 1, 'Finds test session in mock brain directory');
  assert.strictEqual(discovered[0].sessionId, testSessionId);
  assert.strictEqual(discovered[0].isLocked, true, 'Detects presence lock');
  console.log('  ✓ [PASS] Discovers active session and enforces security validation');
}

// 5. Transcript Parsing & Delta Tailing Tests
console.log('[Suite 5/5] Transcript Parsing & Delta Reading');
{
  const manager = new AgentSessionManager({
    brainDirs: [mockBrainDir],
    presenceDirs: [mockPresenceDir],
  });

  const history = manager.getTranscriptHistory(testSessionId);
  assert.strictEqual(history.success, true, 'Successfully parsed transcript');
  assert.strictEqual(history.turns.length, 1, 'Parsed 1 conversational turn');
  assert.strictEqual(history.turns[0].userInput, 'Check the status of the repository and fix formatting');
  assert.strictEqual(history.turns[0].toolCalls.length, 2, 'Parsed 2 tool calls');
  assert.strictEqual(history.turns[0].thinking.length, 1, 'Parsed thinking block with ANSI stripped');
  assert.strictEqual(history.turns[0].thinking[0], 'I need to run git status to check for modified files.');

  // Test delta read with cursor
  const initialCursor = history.cursor;
  const noDelta = manager.readDelta(testSessionId, initialCursor);
  assert.strictEqual(noDelta.events.length, 0, 'Zero events when cursor is at EOF');

  // Append a new line
  const newLine = JSON.stringify({
    step_index: 4,
    type: 'USER_INPUT',
    content: 'Commit changes with message "Refactor"',
  }) + '\n';
  fs.appendFileSync(transcriptFile, newLine);

  const delta = manager.readDelta(testSessionId, initialCursor);
  assert.strictEqual(delta.events.length, 1, 'Reads newly appended delta line');
  assert.strictEqual(delta.events[0].content, 'Commit changes with message "Refactor"');
  assert.ok(delta.newCursor > initialCursor, 'Cursor advanced correctly');

  // Edge Case: Mid-write partial JSON line flush
  const completeLine = JSON.stringify({
    step_index: 5,
    type: 'PLANNER_RESPONSE',
    content: 'All operations finished cleanly.',
  }) + '\n';
  const half1 = completeLine.slice(0, 30);
  const half2 = completeLine.slice(30);

  // Write first half without newline
  fs.appendFileSync(transcriptFile, half1);
  const partialRead = manager.readDelta(testSessionId, delta.newCursor);
  assert.strictEqual(partialRead.events.length, 0, 'Does not emit incomplete JSON events');
  assert.strictEqual(partialRead.newCursor, delta.newCursor, 'Cursor does not advance over incomplete line');

  // Write second half with newline
  fs.appendFileSync(transcriptFile, half2);
  const completedRead = manager.readDelta(testSessionId, partialRead.newCursor);
  assert.strictEqual(completedRead.events.length, 1, 'Emits event once complete line arrives');
  assert.strictEqual(completedRead.events[0].content, 'All operations finished cleanly.');
  assert.ok(completedRead.newCursor > delta.newCursor, 'Cursor advances after newline is flushed');

  console.log('  ✓ [PASS] Parses turns, thinking, tool calls, and streams real-time delta logs safely');
}

// 6. Custom Environment Variable Brain Resolution & Tool Summaries
console.log('[Suite 6/6] Custom Environment Dirs & Session Completion Resolution');
{
  process.env.SOKO_AGENT_BRAIN_DIR = mockBrainDir;
  process.env.SOKO_AGENT_PRESENCE_DIR = mockPresenceDir;

  const defaultManager = new AgentSessionManager();
  assert.strictEqual(defaultManager.brainDirs.includes(mockBrainDir), true, 'Honors SOKO_AGENT_BRAIN_DIR');
  assert.strictEqual(defaultManager.presenceDirs.includes(mockPresenceDir), true, 'Honors SOKO_AGENT_PRESENCE_DIR');

  const history = defaultManager.getTranscriptHistory(testSessionId);
  assert.strictEqual(history.success, true);
  assert.strictEqual(history.isWaiting, false, 'Turn ending with PLANNER_RESPONSE is not waiting');

  delete process.env.SOKO_AGENT_BRAIN_DIR;
  delete process.env.SOKO_AGENT_PRESENCE_DIR;
  console.log('  ✓ [PASS] Honors SOKO_AGENT_BRAIN_DIR and resolves session completion state accurately');
}

// Cleanup mock files
try {
  fs.rmSync(tempDir, { recursive: true, force: true });
} catch {}

console.log('\n================================================================');
console.log(' RESULTS: 6 / 6 suites passed (100%)');
console.log('================================================================\n');
