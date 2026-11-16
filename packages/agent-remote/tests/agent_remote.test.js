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
console.log('[Suite 1/10] ANSI Escape Sequence Cleaning');
{
  const raw = '\x1b[32mSuccess!\x1b[0m \x1b[1;34mBold Blue\x1b[0m';
  const cleaned = cleanAnsi(raw);
  assert.strictEqual(cleaned, 'Success! Bold Blue', 'Strips ANSI color codes');
  assert.strictEqual(cleanAnsi(''), '', 'Handles empty string');
  assert.strictEqual(cleanAnsi(null), '', 'Handles null input safely');
  console.log('  ✓ [PASS] Strips ANSI color and styling escape sequences');
}

// 2. Tool Output Sanitization & Capping Tests
console.log('[Suite 2/10] Tool Output Sanitization & Capping (Mobile Ergonomics)');
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
console.log('[Suite 3/10] Tool Call Summary Resolution');
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
console.log('[Suite 4/10] Session Discovery & Path Traversal Guardrails');
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
console.log('[Suite 5/10] Transcript Parsing & Delta Reading');
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
console.log('[Suite 6/10] Custom Environment Dirs & Session Completion Resolution');
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

// 7. Subagent Detection & Parent Session Linkage
console.log('[Suite 7/10] Subagent Detection & Parent Session Linkage');
{
  const mainSessionId = 'main-agent-session-001';
  const subSessionId = 'sub-agent-session-002';

  const mainDir = path.join(mockBrainDir, mainSessionId, '.system_generated/logs');
  const subDir = path.join(mockBrainDir, subSessionId, '.system_generated/logs');
  fs.mkdirSync(mainDir, { recursive: true });
  fs.mkdirSync(subDir, { recursive: true });

  // Main agent transcript: starts with USER_EXPLICIT and <USER_REQUEST>
  const mainTranscript = path.join(mainDir, 'transcript.jsonl');
  const mainContent = [
    JSON.stringify({
      step_index: 0,
      source: 'USER_EXPLICIT',
      type: 'USER_INPUT',
      content: '<USER_REQUEST>\nRefactor the authentication module\n</USER_REQUEST>',
    }),
    JSON.stringify({
      step_index: 1,
      source: 'MODEL',
      type: 'PLANNER_RESPONSE',
      content: 'I will analyze the authentication module and delegate subtasks.',
    }),
  ].join('\n') + '\n';
  fs.writeFileSync(mainTranscript, mainContent);

  // Subagent transcript: starts with SYSTEM and <SYSTEM_MESSAGE> not actually sent by the user, with sender
  const subTranscript = path.join(subDir, 'transcript.jsonl');
  const subContent = [
    JSON.stringify({
      step_index: 0,
      source: 'SYSTEM',
      type: 'SYSTEM_MESSAGE',
      content: 'The following is a <SYSTEM_MESSAGE> not actually sent by the user. It is provided by the system as important information to pay attention to.\n\n<SYSTEM_MESSAGE>\n[Message] timestamp=2026-11-14T16:08:16Z sender=main-agent-session-001 priority=MESSAGE_PRIORITY_HIGH content=Analyze crypto algorithms\n</SYSTEM_MESSAGE>',
    }),
    JSON.stringify({
      step_index: 1,
      source: 'MODEL',
      type: 'PLANNER_RESPONSE',
      content: 'Completed cryptographic audit.',
    }),
  ].join('\n') + '\n';
  fs.writeFileSync(subTranscript, subContent);

  const manager = new AgentSessionManager({
    brainDirs: [mockBrainDir],
    presenceDirs: [mockPresenceDir],
  });

  // Verify _peekSessionMetadata
  const mainStat = fs.statSync(mainTranscript);
  const mainMeta = manager._peekSessionMetadata(mainTranscript, mainStat);
  assert.strictEqual(mainMeta.isSubagent, false, 'Main agent is not marked as subagent');
  assert.strictEqual(mainMeta.parentSessionId, null, 'Main agent has null parentSessionId');

  const subStat = fs.statSync(subTranscript);
  const subMeta = manager._peekSessionMetadata(subTranscript, subStat);
  assert.strictEqual(subMeta.isSubagent, true, 'Subagent correctly detected as isSubagent: true');
  assert.strictEqual(subMeta.parentSessionId, mainSessionId, 'Subagent parentSessionId matches sender');

  // Verify discoverSessions includes isSubagent & parentSessionId
  const discovered = manager.discoverSessions();
  const discMain = discovered.find((s) => s.sessionId === mainSessionId);
  const discSub = discovered.find((s) => s.sessionId === subSessionId);

  assert.ok(discMain, 'Main session discovered');
  assert.strictEqual(discMain.isSubagent, false, 'Discovered main session has isSubagent: false');
  assert.strictEqual(discMain.parentSessionId, null);

  assert.ok(discSub, 'Subagent session discovered');
  assert.strictEqual(discSub.isSubagent, true, 'Discovered subagent session has isSubagent: true');
  assert.strictEqual(discSub.parentSessionId, mainSessionId, 'Discovered subagent session links parentSessionId');

  // Verify getTranscriptHistory includes isSubagent & parentSessionId
  const mainHistory = manager.getTranscriptHistory(mainSessionId);
  assert.strictEqual(mainHistory.isSubagent, false);
  assert.strictEqual(mainHistory.parentSessionId, null);

  const subHistory = manager.getTranscriptHistory(subSessionId);
  assert.strictEqual(subHistory.isSubagent, true);
  assert.strictEqual(subHistory.parentSessionId, mainSessionId);

  console.log('  ✓ [PASS] Correctly identifies main vs subagents and links parent session ID');
}

// 8. Dynamic Sub-Agent Role Extraction
console.log('[Suite 8/10] Dynamic Sub-Agent Role Extraction');
{
  const testBrainDir = path.join(tempDir, 'brain-role-test');
  const testPresenceDir = path.join(tempDir, 'presence-role-test');
  fs.mkdirSync(testBrainDir, { recursive: true });
  fs.mkdirSync(testPresenceDir, { recursive: true });

  const parentId = 'parent-orch-001';
  const sub1Id = 'sub-role-envelope-1';
  const sub2Id = 'sub-role-envelope-2';
  const sub3Id = 'sub-role-parent-invoke';
  const sub4Id = 'sub-role-parent-swarm';

  const makeSession = (sid, lines) => {
    const sDir = path.join(testBrainDir, sid, '.system_generated/logs');
    fs.mkdirSync(sDir, { recursive: true });
    fs.writeFileSync(path.join(sDir, 'transcript.jsonl'), lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
  };

  // Sub 1: Envelope with "You are backend-remote, the backend session manager author"
  makeSession(sub1Id, [
    {
      step_index: 0,
      source: 'SYSTEM',
      type: 'SYSTEM_MESSAGE',
      content: `<SYSTEM_MESSAGE>\n[Message] timestamp=${new Date().toISOString()} sender=${parentId} priority=HIGH content=You are backend-remote, the backend session manager author. Your job is: Refactor transcript parser.\n</SYSTEM_MESSAGE>`,
    },
    {
      step_index: 1,
      source: 'MODEL',
      type: 'PLANNER_RESPONSE',
      content: 'Refactoring started.',
    },
  ]);

  // Sub 2: Envelope with "Role: Security Policy Validator"
  makeSession(sub2Id, [
    {
      step_index: 0,
      source: 'SYSTEM',
      type: 'SYSTEM_MESSAGE',
      content: `<SYSTEM_MESSAGE>\n[Message] timestamp=${new Date().toISOString()} sender=${parentId} priority=HIGH content=Role: Security Policy Validator\nAudit all network socket bindings.\n</SYSTEM_MESSAGE>`,
    },
    {
      step_index: 1,
      source: 'MODEL',
      type: 'PLANNER_RESPONSE',
      content: 'Auditing socket bindings.',
    },
  ]);

  // Sub 3: No role in subagent envelope, but parent called invoke_subagent with Role: "Database Migration Specialist"
  makeSession(sub3Id, [
    {
      step_index: 0,
      source: 'SYSTEM',
      type: 'SYSTEM_MESSAGE',
      content: `<SYSTEM_MESSAGE>\n[Message] timestamp=${new Date().toISOString()} sender=${parentId} priority=HIGH content=Run migrations for v2 schema.\n</SYSTEM_MESSAGE>`,
    },
    {
      step_index: 1,
      source: 'MODEL',
      type: 'PLANNER_RESPONSE',
      content: 'Running migration batch.',
    },
  ]);

  // Sub 4: No role in subagent envelope, but parent called swarm with name: "qa-verifier", brief: "You are qa-verifier, the End-to-End Test Specialist"
  makeSession(sub4Id, [
    {
      step_index: 0,
      source: 'SYSTEM',
      type: 'SYSTEM_MESSAGE',
      content: `<SYSTEM_MESSAGE>\n[Message] timestamp=${new Date().toISOString()} sender=${parentId} priority=HIGH content=Run Cypress regression tests.\n</SYSTEM_MESSAGE>`,
    },
    {
      step_index: 1,
      source: 'MODEL',
      type: 'PLANNER_RESPONSE',
      content: 'Executing tests.',
    },
  ]);

  // Parent transcript with invoke_subagent and swarm calls
  makeSession(parentId, [
    {
      step_index: 0,
      source: 'USER_EXPLICIT',
      type: 'USER_INPUT',
      content: 'Orchestrate architecture overhaul and testing',
    },
    {
      step_index: 1,
      source: 'MODEL',
      type: 'PLANNER_RESPONSE',
      tool_calls: [
        {
          name: 'invoke_subagent',
          args: {
            Role: 'Database Migration Specialist',
            TypeName: 'database',
          },
        },
      ],
      content: `Dispatched subagent session ${sub3Id}`,
    },
    {
      step_index: 2,
      source: 'MODEL',
      type: 'PLANNER_RESPONSE',
      tool_calls: [
        {
          name: 'swarm',
          args: {
            action: 'add',
            name: 'qa-verifier',
            brief: 'You are qa-verifier, the End-to-End Test Specialist',
          },
        },
      ],
      content: `Added swarm worker ${sub4Id}`,
    },
  ]);

  const manager = new AgentSessionManager({
    brainDirs: [testBrainDir],
    presenceDirs: [testPresenceDir],
  });

  // Verify Sub 1 role extraction from "You are X, the Y"
  const history1 = manager.getTranscriptHistory(sub1Id);
  assert.strictEqual(history1.isSubagent, true);
  assert.strictEqual(history1.role, 'backend session manager author');

  // Verify Sub 2 role extraction from "Role: X"
  const history2 = manager.getTranscriptHistory(sub2Id);
  assert.strictEqual(history2.isSubagent, true);
  assert.strictEqual(history2.role, 'Security Policy Validator');

  // Verify Sub 3 role extraction from parent invoke_subagent
  const history3 = manager.getTranscriptHistory(sub3Id);
  assert.strictEqual(history3.isSubagent, true);
  assert.strictEqual(history3.role, 'Database Migration Specialist');

  // Verify Sub 4 role extraction from parent swarm brief
  const history4 = manager.getTranscriptHistory(sub4Id);
  assert.strictEqual(history4.isSubagent, true);
  assert.strictEqual(history4.role, 'End-to-End Test Specialist');

  // Verify discoverSessions returns role for each
  const discovered = manager.discoverSessions();
  const d1 = discovered.find((s) => s.sessionId === sub1Id);
  const d2 = discovered.find((s) => s.sessionId === sub2Id);
  const d3 = discovered.find((s) => s.sessionId === sub3Id);
  const d4 = discovered.find((s) => s.sessionId === sub4Id);
  assert.strictEqual(d1.role, 'backend session manager author');
  assert.strictEqual(d2.role, 'Security Policy Validator');
  assert.strictEqual(d3.role, 'Database Migration Specialist');
  assert.strictEqual(d4.role, 'End-to-End Test Specialist');

  console.log('  ✓ [PASS] Parses dynamic roles from envelopes ("You are..., the...", "Role:...") and parent invoke_subagent/swarm calls');
}

// 9. Sub-Agent Turn Parsing
console.log('[Suite 9/10] Sub-Agent Turn Parsing (Envelope & Direct PLANNER_RESPONSE)');
{
  const testBrainDir = path.join(tempDir, 'brain-turn-test');
  fs.mkdirSync(testBrainDir, { recursive: true });

  const subTurn1Id = 'sub-turn-envelope';
  const subTurn2Id = 'sub-turn-planner-first';
  const subMultiTurnId = 'sub-multi-turn';

  const makeSession = (sid, lines) => {
    const sDir = path.join(testBrainDir, sid, '.system_generated/logs');
    fs.mkdirSync(sDir, { recursive: true });
    fs.writeFileSync(path.join(sDir, 'transcript.jsonl'), lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
  };

  // Case A: Transcript starts with SYSTEM_MESSAGE dispatch envelope (no USER_INPUT)
  makeSession(subTurn1Id, [
    {
      step_index: 0,
      source: 'SYSTEM',
      type: 'SYSTEM_MESSAGE',
      created_at: new Date(Date.now() - 20000).toISOString(),
      content: '<SYSTEM_MESSAGE>\n[Message] timestamp=2026-11-16T12:00:00Z sender=parent-01 priority=HIGH content=Run memory leak diagnostic\n</SYSTEM_MESSAGE>',
    },
    {
      step_index: 1,
      source: 'MODEL',
      type: 'PLANNER_RESPONSE',
      thinking: '\x1b[33mInspecting heap allocations...\x1b[0m',
      tool_calls: [
        {
          name: 'run_command',
          args: { CommandLine: 'node --inspect memory-check.js', toolSummary: 'Run memory inspector' },
        },
      ],
      content: 'Diagnostic in progress.',
    },
    {
      step_index: 2,
      source: 'MODEL',
      type: 'PLANNER_RESPONSE',
      content: 'No memory leaks detected.',
    },
  ]);

  // Case B: Transcript starts directly with PLANNER_RESPONSE (no USER_INPUT or SYSTEM_MESSAGE)
  makeSession(subTurn2Id, [
    {
      step_index: 0,
      source: 'MODEL',
      type: 'PLANNER_RESPONSE',
      created_at: new Date(Date.now() - 15000).toISOString(),
      thinking: 'Autonomous startup check.',
      tool_calls: [
        {
          name: 'read_file',
          args: { Path: '/app/health.json', toolSummary: 'Read health config' },
        },
      ],
      content: 'Health config verified.',
    },
  ]);

  // Case C: Multi-turn subagent with two dispatch envelopes
  makeSession(subMultiTurnId, [
    {
      step_index: 0,
      source: 'SYSTEM',
      type: 'SYSTEM_MESSAGE',
      content: '[Message] sender=parent-01 content=Phase 1: Build project',
    },
    {
      step_index: 1,
      source: 'MODEL',
      type: 'PLANNER_RESPONSE',
      tool_calls: [{ name: 'run_command', args: { CommandLine: 'npm run build' } }],
      content: 'Build succeeded.',
    },
    {
      step_index: 2,
      source: 'SYSTEM',
      type: 'SYSTEM_MESSAGE',
      content: '[Message] sender=parent-01 content=Phase 2: Deploy artifacts',
    },
    {
      step_index: 3,
      source: 'MODEL',
      type: 'PLANNER_RESPONSE',
      tool_calls: [{ name: 'run_command', args: { CommandLine: 'npm run deploy' } }],
      content: 'Deploy complete.',
    },
  ]);

  const manager = new AgentSessionManager({
    brainDirs: [testBrainDir],
    presenceDirs: [],
  });

  // Verify Case A
  const h1 = manager.getTranscriptHistory(subTurn1Id);
  assert.strictEqual(h1.success, true);
  assert.strictEqual(h1.turns.length, 1, 'Initializes turn 0 from dispatch envelope');
  assert.strictEqual(h1.turns[0].userInput, 'Run memory leak diagnostic');
  assert.strictEqual(h1.turns[0].thinking.length, 1);
  assert.strictEqual(h1.turns[0].thinking[0], 'Inspecting heap allocations...');
  assert.strictEqual(h1.turns[0].toolCalls.length, 1);
  assert.strictEqual(h1.turns[0].toolCalls[0].summary, 'Run memory inspector');
  assert.ok(h1.turns[0].responses.includes('Diagnostic in progress.'));
  assert.ok(h1.turns[0].responses.includes('No memory leaks detected.'));

  // Verify Case B
  const h2 = manager.getTranscriptHistory(subTurn2Id);
  assert.strictEqual(h2.success, true);
  assert.strictEqual(h2.turns.length, 1, 'Initializes turn 0 directly from PLANNER_RESPONSE');
  assert.strictEqual(h2.turns[0].thinking[0], 'Autonomous startup check.');
  assert.strictEqual(h2.turns[0].toolCalls.length, 1);
  assert.strictEqual(h2.turns[0].responses[0], 'Health config verified.');

  // Verify Case C
  const h3 = manager.getTranscriptHistory(subMultiTurnId);
  assert.strictEqual(h3.success, true);
  assert.strictEqual(h3.turns.length, 2, 'Parses multiple sub-agent turns from consecutive dispatch envelopes');
  assert.strictEqual(h3.turns[0].userInput, 'Phase 1: Build project');
  assert.strictEqual(h3.turns[0].responses[0], 'Build succeeded.');
  assert.strictEqual(h3.turns[1].userInput, 'Phase 2: Deploy artifacts');
  assert.strictEqual(h3.turns[1].responses[0], 'Deploy complete.');

  console.log('  ✓ [PASS] Initializes turn 0 for subagents from dispatch envelopes and PLANNER_RESPONSE with thinking and tool calls');
}

// 10. Accurate Running Status & Stale Lock Invalidation (< 20m)
console.log('[Suite 10/10] Accurate Running Status & Stale Lock Invalidation (< 20m)');
{
  const testBrainDir = path.join(tempDir, 'brain-status-test');
  const testPresenceDir = path.join(tempDir, 'presence-status-test');
  fs.mkdirSync(testBrainDir, { recursive: true });
  fs.mkdirSync(testPresenceDir, { recursive: true });

  const activeSessionId = 'active-session-fresh';
  const staleSessionId = 'dead-session-stale-lock';

  const now = Date.now();
  const freshTime = new Date(now - 30 * 1000); // 30s ago (< 20m)
  const staleTime = new Date(now - 25 * 60 * 1000); // 25m ago (> 20m)

  // 1. Fresh active session
  const activeDir = path.join(testBrainDir, activeSessionId, '.system_generated/logs');
  fs.mkdirSync(activeDir, { recursive: true });
  const activeTranscript = path.join(activeDir, 'transcript.jsonl');
  fs.writeFileSync(activeTranscript, JSON.stringify({
    step_index: 0,
    type: 'USER_INPUT',
    content: 'Process streaming logs',
  }) + '\n' + JSON.stringify({
    step_index: 1,
    type: 'PLANNER_RESPONSE',
    status: 'RUNNING',
    tool_calls: [{ name: 'run_command', args: { CommandLine: 'tail -f logs.txt' } }],
  }) + '\n');
  fs.utimesSync(activeTranscript, freshTime, freshTime);

  const activeLock = path.join(testPresenceDir, `${activeSessionId}.lock`);
  fs.writeFileSync(activeLock, '');
  fs.utimesSync(activeLock, freshTime, freshTime);

  // 2. Dead session with stale lock (> 20m)
  const staleDir = path.join(testBrainDir, staleSessionId, '.system_generated/logs');
  fs.mkdirSync(staleDir, { recursive: true });
  const staleTranscript = path.join(staleDir, 'transcript.jsonl');
  fs.writeFileSync(staleTranscript, JSON.stringify({
    step_index: 0,
    type: 'USER_INPUT',
    content: 'Crashed build task',
  }) + '\n' + JSON.stringify({
    step_index: 1,
    type: 'PLANNER_RESPONSE',
    status: 'RUNNING',
    tool_calls: [{ name: 'run_command', args: { CommandLine: 'build --crash' } }],
  }) + '\n');
  fs.utimesSync(staleTranscript, staleTime, staleTime);

  const staleLock = path.join(testPresenceDir, `${staleSessionId}.lock`);
  fs.writeFileSync(staleLock, '');
  fs.utimesSync(staleLock, staleTime, staleTime);

  const manager = new AgentSessionManager({
    brainDirs: [testBrainDir],
    presenceDirs: [testPresenceDir],
  });

  // Verify discoverSessions status and lock resolution
  const discovered = manager.discoverSessions();
  const discActive = discovered.find((s) => s.sessionId === activeSessionId);
  const discStale = discovered.find((s) => s.sessionId === staleSessionId);

  assert.ok(discActive, 'Active session found');
  assert.strictEqual(discActive.isLocked, true, 'Active session is marked isLocked: true');
  assert.strictEqual(discActive.status, 'working', 'Fresh active session is marked status: "working"');

  assert.ok(discStale, 'Stale session found');
  assert.strictEqual(discStale.isLocked, false, 'Dead session with stale lock (> 20m) is marked isLocked: false');
  assert.notStrictEqual(discStale.status, 'working', 'Dead session with stale lock is NOT marked "working"');
  assert.strictEqual(discStale.status, 'completed', 'Dead session with stale lock is marked "completed"');

  // Verify getTranscriptHistory status resolution
  const activeHistory = manager.getTranscriptHistory(activeSessionId);
  assert.strictEqual(activeHistory.isLocked, true);
  assert.strictEqual(activeHistory.isWorking, true, 'Fresh active session with RUNNING status isWorking: true');

  const staleHistory = manager.getTranscriptHistory(staleSessionId);
  assert.strictEqual(staleHistory.isLocked, false, 'Stale lock causes history.isLocked: false');
  assert.strictEqual(staleHistory.isWorking, false, 'Dead session with stale lock (> 20m) is marked isWorking: false despite RUNNING step');

  console.log('  ✓ [PASS] Accurately validates locks (< 20m) and marks dead sessions with stale locks as idle/completed, not working');
}

// Cleanup mock files
try {
  fs.rmSync(tempDir, { recursive: true, force: true });
} catch {}

console.log('\n================================================================');
console.log(' RESULTS: 10 / 10 suites passed (100%)');
console.log('================================================================\n');
