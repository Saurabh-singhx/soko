/** Concurrent CLI discovery and activity regressions, using isolated provider logs. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { AgentSessionManager } = require('../packages/agent-remote/src');
const { importTs } = require('./import_ts');

globalThis.WebSocket = class { send() {} close() {} };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'soko-activity-'));
const write = (file, records) => {
  const target = path.join(temp, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, records.map(r => JSON.stringify(r)).join('\n') + '\n');
  return target;
};
let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log(`✓ ${name}`); }
async function main() {
  const { SwarmDataEngine } = await importTs('../apps/desktop/src/features/swarm-visualizer/services/swarmDataEngine.ts', __dirname);
  const { connectionService } = await importTs('../apps/desktop/src/services/connection.ts', __dirname);
  const manager = new AgentSessionManager({ brainDirs: [path.join(temp, 'brain')], presenceDirs: [],
    codexSessionDirs: [path.join(temp, 'codex')], claudeProjectDirs: [path.join(temp, 'claude')] });
  const codex = (id, cwd, parent) => [
    { type: 'session_meta', payload: { id, cwd, source: parent ? { subagent: { thread_spawn: { parent_thread_id: parent, agent_role: 'reviewer' } } } : 'cli' } },
    { type: 'response_item', payload: { role: 'user', content: [{ text: `Implement ${id}` }] } },
    { type: 'event_msg', payload: { type: 'task_started' } },
    { type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { total_tokens: 1234 } } } },
  ];
  const claude = (sessionId, cwd, complete = false) => [
    { type: 'user', sessionId, cwd, message: { content: `Review ${sessionId}` } },
    { type: 'assistant', sessionId, message: { model: 'claude-fixture', content: [{ type: 'text', text: 'Checking changes' }], stop_reason: complete ? 'end_turn' : 'tool_use' } },
  ];
  write('brain/antigravity-1/.system_generated/logs/transcript.jsonl', [
    { type: 'USER_INPUT', content: 'Build the desktop UI', created_at: new Date().toISOString() },
    { type: 'PLANNER_RESPONSE', content: 'Building interface', status: 'RUNNING' },
  ]);
  write('codex/rollout-sameprefix-a.jsonl', codex('sameprefix-a', '/work/app'));
  write('codex/rollout-sameprefix-b.jsonl', codex('sameprefix-b', '/work/app'));
  write('codex/rollout-child.jsonl', codex('child', '/work/app', 'sameprefix-a'));
  write('codex/rollout-grandchild.jsonl', codex('grandchild', '/work/app', 'child'));
  const slowFile = write('codex/rollout-slow.jsonl', codex('slow', '/another/app'));
  fs.utimesSync(slowFile, new Date(), new Date(Date.now() - 120000));
  write('claude/project/claude-a.jsonl', claude('claude-a', '/work/app'));
  write('claude/project/claude-b.jsonl', claude('claude-b', '/another/app'));
  write('claude/project/claude-a/subagents/agent-same.jsonl', claude('claude-a', '/work/app'));
  write('claude/project/claude-b/subagents/agent-same.jsonl', claude('claude-b', '/another/app'));
  write('claude/project/completed.jsonl', claude('completed', '/finished', true));
  let sessions = manager.discoverSessions();
  connectionService.fetchDiscoveredAgentSessions = async () => sessions;
  connectionService.fetchSessionTranscript = async id => manager.getTranscriptHistory(id);

  await test('Discovers all three providers and keeps same-project sessions distinct', () => {
    assert.equal(sessions.length, 11);
    assert.equal(new Set(sessions.map(s => s.sessionId)).size, 11);
    assert.deepEqual([...new Set(sessions.map(s => s.agent))].sort(), ['antigravity', 'claude', 'codex']);
  });
  await test('Codex nested parent metadata and event token counts are preserved', () => {
    const child = sessions.find(s => s.sessionId === 'codex-child');
    assert.equal(child.parentSessionId, 'codex-sameprefix-a');
    assert.equal(child.isSubagent, true);
    assert.equal(child.tokensUsed, 1234);
    assert.equal(sessions.find(s => s.sessionId === 'codex-slow').status, 'working');
  });
  await test('Claude workers with equal filenames in different parents remain distinct', () => {
    const workers = sessions.filter(s => s.agent === 'claude' && s.isSubagent);
    assert.equal(workers.length, 2);
    assert.equal(new Set(workers.map(s => s.sessionId)).size, 2);
    for (const worker of workers) assert(manager.resolveSessionPaths(worker.sessionId));
  });
  await test('Explicit completion wins over recent file modification', () => {
    assert.equal(sessions.find(s => s.sessionId === 'claude-completed').status, 'completed');
    assert.equal(manager.getTranscriptHistory('claude-completed').isWorking, false);
  });
  const engine = new SwarmDataEngine();
  await engine.syncLiveTelemetry();
  const agents = () => engine.state.clusters.flatMap(c => c.agents);
  await test('Live overview includes all concurrent roots, workers and nested workers', () => {
    assert.equal(agents().length, 10);
    assert.equal(engine.state.stats.totalParallel, 10);
    assert.equal(agents().find(a => a.id === 'codex-grandchild').depth, 2);
    assert.equal(agents().find(a => a.id === 'codex-sameprefix-a').provider, 'codex');
  });
  await test('Full IDs select the correct agent; ambiguous prefixes never select another session', () => {
    assert.equal(engine.findAgent('codex-sameprefix'), null);
    engine.selectAgent('codex-sameprefix-b');
    assert.equal(engine.state.selectedAgent.sessionId, 'codex-sameprefix-b');
  });
  await test('A polling update preserves the selected agent while all other sessions remain visible', async () => {
    await engine.syncLiveTelemetry();
    assert.equal(engine.state.selectedAgent.id, 'codex-sameprefix-b');
    assert.equal(agents().length, 10);
  });
  await test('A single independent agent is visible and inspectable', async () => {
    const single = new SwarmDataEngine();
    const before = sessions; sessions = sessions.filter(s => s.sessionId === 'codex-slow');
    await single.syncLiveTelemetry();
    assert.equal(single.state.clusters.flatMap(c => c.agents).length, 1);
    single.selectAgent('codex-slow'); assert.equal(single.state.selectedAgent.id, 'codex-slow');
    sessions = before;
  });
  await test('Orphan workers are visible without being assigned to an unrelated root', async () => {
    const before = sessions;
    sessions = [...sessions, { sessionId: 'orphan', agent: 'antigravity', isSubagent: true, status: 'working', mtimeMs: Date.now(), workspace: '/elsewhere' }];
    await engine.syncLiveTelemetry();
    assert.equal(engine.findAgent('orphan').parentSessionId, null);
    sessions = before;
  });
  await test('History includes the selected root itself and does not absorb unrelated live events', async () => {
    await engine.loadSession('codex-sameprefix-a', { mode: 'history' });
    assert.deepEqual(agents().map(a => a.sessionId).sort(), ['codex-child', 'codex-grandchild', 'codex-sameprefix-a']);
    engine.state.isRunning = true;
    const oldStatus = engine.findAgent('codex-sameprefix-a').status;
    engine.handleExternalAgentActivity({ sessionId: 'codex-sameprefix-a', status: 'completed' });
    assert.equal(engine.findAgent('codex-sameprefix-a').status, oldStatus);
    await engine.syncLiveTelemetry();
    assert.equal(engine.state.viewMode, 'history');
    engine.stop();
  });
  await test('Bridge failures retain the last snapshot with an explicit connection error', async () => {
    const before = agents().length;
    connectionService.fetchDiscoveredAgentSessions = async () => { throw new Error('offline'); };
    await engine.syncLiveTelemetry();
    assert.equal(agents().length, before);
    assert(engine.state.telemetryError);
    connectionService.fetchDiscoveredAgentSessions = async () => sessions;
    await engine.syncLiveTelemetry(); assert.equal(engine.state.telemetryError, null);
  });
  await test('Pausing discards in-flight polling results', async () => {
    const paused = new SwarmDataEngine(); paused.state.isRunning = true;
    let resolve;
    connectionService.fetchDiscoveredAgentSessions = () => new Promise(r => { resolve = r; });
    const pending = paused.syncLiveTelemetry();
    paused.stop(); resolve(sessions); await pending;
    assert.equal(paused.state.clusters.length, 0);
    assert.equal(paused.state.isRunning, false);
    connectionService.fetchDiscoveredAgentSessions = async () => sessions;
  });
  await test('Large concurrent teams preserve all sessions and bound transcript read concurrency', async () => {
    const before = sessions;
    sessions = Array.from({ length: 60 }, (_, index) => ({ sessionId: `codex-parallel-${index}`,
      agent: 'codex', workspace: `/project/${index % 3}`, status: 'working', mtimeMs: Date.now() }));
    const savedFetch = connectionService.fetchSessionTranscript;
    let inFlight = 0, peak = 0;
    connectionService.fetchSessionTranscript = async () => {
      inFlight++; peak = Math.max(peak, inFlight);
      await new Promise(resolve => setTimeout(resolve, 1)); inFlight--;
      return { success: true, turns: [] };
    };
    const many = new SwarmDataEngine(); await many.syncLiveTelemetry();
    assert.equal(many.state.clusters.flatMap(c => c.agents).length, 60);
    assert(peak <= 6);
    connectionService.fetchSessionTranscript = savedFetch;
    sessions = before;
  });
  await test('Switching to live while history is loading prevents a late history response from taking over', async () => {
    const switching = new SwarmDataEngine();
    switching.state.availableSessions = sessions;
    const savedFetch = connectionService.fetchSessionTranscript;
    let resolve;
    connectionService.fetchSessionTranscript = () => new Promise(r => { resolve = r; });
    const loading = switching.loadSession('codex-slow', { mode: 'history' });
    assert.equal(switching.state.viewMode, 'history');
    connectionService.fetchSessionTranscript = savedFetch;
    switching.setViewMode('live');
    resolve({ success: true, turns: [] }); await loading;
    assert.equal(switching.state.viewMode, 'live');
    await switching.syncLiveTelemetry();
  });
  await test('Concurrent history selections apply only the most recent selection', async () => {
    const switching = new SwarmDataEngine(); switching.state.availableSessions = sessions;
    const savedFetch = connectionService.fetchSessionTranscript;
    let resolve;
    connectionService.fetchSessionTranscript = () => new Promise(r => { resolve = r; });
    const first = switching.loadSession('codex-slow', { mode: 'history' });
    connectionService.fetchSessionTranscript = savedFetch;
    await switching.loadSession('claude-claude-a', { mode: 'history' });
    resolve({ success: true, turns: [] }); await first;
    assert.equal(switching.state.selectedSessionId, 'claude-claude-a');
  });
  await test('Codex and Claude sessions cannot accidentally dispatch to Antigravity', async () => {
    await assert.rejects(manager.dispatchPrompt('codex-sameprefix-a', 'hello'), /observation-only/);
    await assert.rejects(manager.dispatchPrompt('claude-claude-a', 'hello'), /observation-only/);
  });
  await test('Codex live deltas show turns and actions without private rollout records', () => {
    const file = path.join(temp, 'codex/rollout-sameprefix-a.jsonl');
    const cursor = fs.statSync(file).size;
    fs.appendFileSync(file, [
      { type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Fix mobile stream' }] } },
      { type: 'response_item', payload: { type: 'message', role: 'developer', content: [{ type: 'input_text', text: 'PRIVATE_INSTRUCTION' }] } },
      { type: 'response_item', payload: { type: 'custom_tool_call', name: 'exec', input: 'PRIVATE_COMMAND' } },
      { type: 'response_item', payload: { type: 'custom_tool_call_output', output: 'PRIVATE_TOOL_OUTPUT' } },
      { type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Stream fixed' }] } },
      { type: 'event_msg', payload: { type: 'task_complete' } },
    ].map(record => JSON.stringify(record)).join('\n') + '\n');
    const delta = manager.readDelta('codex-sameprefix-a', cursor);
    assert.deepEqual(delta.events.map(event => event.type), ['USER_INPUT', 'TOOL_CALL', 'ASSISTANT', 'TURN_COMPLETE']);
    assert.equal(delta.events[0].content, 'Fix mobile stream');
    assert.equal(delta.events[1].tool_calls[0].name, 'exec');
    assert.equal(delta.events[2].content, 'Stream fixed');
    assert(!JSON.stringify(delta).includes('PRIVATE_'));
    const history = manager.getTranscriptHistory('codex-sameprefix-a');
    assert.equal(history.cursor, fs.statSync(file).size);
    assert(history.turns.some(turn => turn.responses.includes('Stream fixed')));
  });
  console.log(`\n${passed} agent activity regressions passed.`);
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => fs.rmSync(temp, { recursive: true, force: true }));
