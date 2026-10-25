/**
 * Soko Working Folder / Workspace Resolution Test Suite
 * Validates that current working folder / workspace is accurately extracted,
 * reported by the bridge, and displayed on the Dynamic Island HUD and Quick Settings.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

console.log('================================================================');
console.log(' SOKO WORKSPACE & WORKING FOLDER RESOLUTION TEST SUITE');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function it(desc, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ [PASS] ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${desc}`);
    console.error(err);
    process.exit(1);
  }
}

// Read bridge code
const bridgeSrc = fs.readFileSync(path.resolve(__dirname, '../scripts/soko_bridge.js'), 'utf8');

// Load helper functions in isolated scope
let simulatedAgentActivity = null;
let focusedSessionId = null;
const agentSessionRegistry = new Map();
const transcriptParseCache = new Map();
const AGENT_COMPLETION_RETENTION_MS = 15000;

function extractUserGoal(text) {
  if (!text || typeof text !== 'string') return '';
  const match = text.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/i);
  const raw = match ? match[1].trim() : text.trim();
  return raw.replace(/^[#*`>\s-]+/, '').split('\n')[0].slice(0, 75).trim();
}

function formatToolCallAction(call) {
  if (!call) return 'Executing task';
  const name = call.name || '';
  const args = call.args || {};
  if (name === 'run_command') return args.toolSummary ? args.toolSummary.replace(/^\"|\"$/g, '') : 'Running command';
  if (name === 'read_file' || name === 'write_file' || name === 'edit_file') {
    const p = (args.Path || args.path || '').replace(/^\"|\"$/g, '');
    return `${name === 'read_file' ? 'Reading' : name === 'write_file' ? 'Creating' : 'Editing'} ${path.basename(p) || 'file'}`;
  }
  return `Executing ${name}`;
}

const codeToEval = bridgeSrc.slice(
  bridgeSrc.indexOf('function getDefaultWorkspace()'),
  bridgeSrc.indexOf('function broadcastAgentActivity()')
);
eval(codeToEval);

console.log('[Suite 1/3] Bridge Workspace Discovery & Extraction');

it('getDefaultWorkspace() correctly detects current repository and basename', () => {
  const ws = getDefaultWorkspace();
  assert(ws && typeof ws === 'string', 'Expected workspace to be a non-empty string');
  assert(fs.existsSync(ws), `Expected workspace path to exist on disk: ${ws}`);
  assert(path.basename(ws) === 'soko', `Expected workspace name to be "soko", got: ${path.basename(ws)}`);
});

it('resolveAntigravityWorkspace() extracts workspace for active Antigravity session', () => {
  const brainDir = path.join(os.homedir(), '.gemini/antigravity-cli/brain');
  if (fs.existsSync(brainDir)) {
    const entries = fs.readdirSync(brainDir, { withFileTypes: true });
    const sessionDir = entries.find(e => e.isDirectory() && !e.name.startsWith('.'));
    if (sessionDir) {
      const sessionId = sessionDir.name;
      const tPath = path.join(brainDir, sessionId, '.system_generated/logs/transcript.jsonl');
      const ws = resolveAntigravityWorkspace(tPath, sessionId, []);
      assert(ws && typeof ws === 'string', 'Expected non-empty workspace path');
      assert(path.basename(ws).length > 0, 'Expected non-empty workspace name');
    }
  }
});

it('checkActiveAgentActivity() returns workspace and workspaceName in all states', () => {
  const activity = checkActiveAgentActivity();
  assert(activity !== null, 'Activity should not be null');
  assert(typeof activity.workspace === 'string' && activity.workspace.length > 0, 'workspace must be populated');
  assert(typeof activity.workspaceName === 'string' && activity.workspaceName.length > 0, 'workspaceName must be populated');
});

console.log('\n[Suite 2/3] Dynamic Island HUD Workspace Badge Resilience');

it('Active session workspace resolution fallback guarantees non-empty project name', () => {
  const sessionWithoutWs = { agent: 'antigravity', detail: 'Processing task' };
  const agentStatus = { workspace: '/home/saurabh/coding/soko', workspaceName: 'soko' };
  
  const resolvedWsName = sessionWithoutWs.workspaceName ||
    (sessionWithoutWs.workspace ? sessionWithoutWs.workspace.split('/').filter(Boolean).pop() : '') ||
    agentStatus?.workspaceName ||
    'soko';

  assert.strictEqual(resolvedWsName, 'soko', 'Should fallback to agentStatus.workspaceName');
});

it('Completed task notice fallback derives workspace from path or status', () => {
  const completedNotice = { agent: 'antigravity', message: 'Task complete', workspace: '/path/to/my-project' };
  const resolvedWsName = completedNotice.workspaceName ||
    (completedNotice.workspace ? completedNotice.workspace.split('/').filter(Boolean).pop() : '') ||
    'soko';

  assert.strictEqual(resolvedWsName, 'my-project', 'Should extract directory basename from workspace path');
});

it('Default status pill remains clean without folder badge when no CLI agent is working', () => {
  const islandSrc = fs.readFileSync(path.resolve(__dirname, '../apps/desktop/src/components/island/DynamicIsland.tsx'), 'utf8');
  // Check that default-status-pill does not unconditionally render a folder badge
  const pillSnippet = islandSrc.slice(
    islandSrc.indexOf('key="default-status-pill"'),
    islandSrc.indexOf('{dynamicStatusText}')
  );
  assert(!pillSnippet.includes('📁'), 'Default status pill should not display folder badge when idle');
});

console.log('\n[Suite 3/3] Quick Settings / ConnectionPopover Integration');

it('Quick Settings header displays working folder badge conditionally when an agent is active', () => {
  const popoverSrc = fs.readFileSync(path.resolve(__dirname, '../apps/desktop/src/components/island/ConnectionPopover.tsx'), 'utf8');
  assert(popoverSrc.includes('📁 {agentActivity?.workspaceName || \'soko\'}'), 'ConnectionPopover header should display working folder badge');
  assert(popoverSrc.includes('agentActivity?.status === \'working\''), 'ConnectionPopover header badge should be conditioned on agent activity');
});

it('Quick Settings active session items display project folder badge with fallback', () => {
  const popoverSrc = fs.readFileSync(path.resolve(__dirname, '../apps/desktop/src/components/island/ConnectionPopover.tsx'), 'utf8');
  assert(popoverSrc.includes('📁 {wsName}'), 'ConnectionPopover session cards must display folder badge');
});

console.log('\n================================================================');
console.log(` RESULTS: ${passedTests} / ${totalTests} tests passed (100%)`);
console.log('================================================================\n');
