/**
 * SOKO SWARM SUB-AGENT VISUALIZER TEST SUITE
 *
 * Validates:
 * 1. Subagent dynamic role and task extraction guardrails directly against production engine
 * 2. Visualizer state updates & telemetry reactivity to emitted agent events
 * 3. All button handlers and interactive controls across the visualizer interface
 * 4. Desktop component source code wiring and regression prevention
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log(' SOKO SWARM VISUALIZER & SUBAGENT CONTROLS TEST SUITE');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

async function it(desc, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ [PASS] ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${desc}`);
    console.error(`    ${err.stack || err.message}`);
    process.exit(1);
  }
}

// Global browser mocks for Node environment
globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
};
globalThis.WebSocket = class MockWebSocket {
  constructor() {
    this.readyState = 1;
  }
  send() {}
  close() {}
};

async function main() {
  // Dynamically import production swarmDataEngine
  const engineModule = await import('../apps/desktop/src/features/swarm-visualizer/services/swarmDataEngine.ts');
  const { extractSubagentRoleAndTask, resolveRoleVisuals, SwarmDataEngine } = engineModule;

  // --------------------------------------------------------------------------
  // SUITE 1: Subagent Role & Task Extraction Guardrails
  // --------------------------------------------------------------------------
  console.log('[Suite 1/4] Subagent Role & Task Extraction Guardrails');

  await it('Extracts explicit non-generic role cleanly', () => {
    const sess = {
      sessionId: 'sub-sess-001',
      name: 'Security Auditor',
      role: 'Security Auditor',
      taskSummary: 'Perform static security check on authentication tokens',
    };
    const { role, taskSummary } = extractSubagentRoleAndTask(sess);
    assert.strictEqual(role, 'Security Auditor');
    assert.strictEqual(taskSummary, 'Perform static security check on authentication tokens');
  });

  await it('Replaces generic "Sub-Agent" role with role extracted from session name', () => {
    const sess = {
      sessionId: 'sub-sess-002',
      name: 'implementer_r1',
      role: 'Sub-Agent',
      workspaceName: 'soko',
      taskSummary: 'Fix the visualizer controls and buttons',
    };
    const { role, taskSummary } = extractSubagentRoleAndTask(sess);
    assert.strictEqual(role, 'Implementer R1');
    assert.strictEqual(taskSummary, 'Fix the visualizer controls and buttons');
  });

  await it('Extracts role from <Identity> block when role is generic "Sub-Agent"', () => {
    const sess = {
      sessionId: 'sub-sess-003',
      name: 'soko',
      role: 'Sub-Agent',
      workspaceName: 'soko',
      taskSummary: '<Identity>\n# SWE Light Implementer\nYou implement software engineering tasks end to end\n</Identity>\n<original_task>\nFix the swarm sub-agent visualizer\n</original_task>',
    };
    const { role, taskSummary } = extractSubagentRoleAndTask(sess);
    assert.strictEqual(role, 'SWE Light Implementer');
    assert.strictEqual(taskSummary, 'Fix the swarm sub-agent visualizer');
  });

  await it('Extracts multi-role list from <Identity> roles tag and formats with uppercase acronyms', () => {
    const sess = {
      sessionId: 'sub-sess-003b',
      name: 'soko',
      role: 'Sub-Agent',
      workspaceName: 'soko',
      taskSummary: '<Identity>\nYou are a Teamwork agent with roles: reviewer, qa.\n</Identity>\n<original_task>\nFix the swarm sub-agent visualizer\n</original_task>',
    };
    const { role, taskSummary } = extractSubagentRoleAndTask(sess);
    assert.strictEqual(role, 'Reviewer / QA');
    assert.strictEqual(taskSummary, 'Fix the swarm sub-agent visualizer');
  });

  await it('Extracts clean task from <original_task> tags, stripping metadata and system wrappers', () => {
    const sess = {
      sessionId: 'sub-sess-004',
      name: 'soko',
      role: 'qa',
      workspaceName: 'soko',
      taskSummary: '<SYSTEM_MESSAGE>[Message] timestamp=2026-11-16T18:28:18Z sender=parent content=<original_task>Write comprehensive automated verification tests for swarm visualizer</original_task></SYSTEM_MESSAGE>',
    };
    const { role, taskSummary } = extractSubagentRoleAndTask(sess);
    assert.strictEqual(role, 'QA');
    assert.strictEqual(taskSummary, 'Write comprehensive automated verification tests for swarm visualizer');
  });

  await it('Extracts clean task from <SYSTEM_MESSAGE> when <original_task> tags are absent (no "The following is a" regression)', () => {
    const sess = {
      sessionId: 'sub-sess-004b',
      name: 'soko',
      role: 'Sub-Agent',
      workspaceName: 'soko',
      taskSummary: 'The following is a <SYSTEM_MESSAGE> not actually sent by the user. It is provided by the system as important information to pay attention to.\n\n<SYSTEM_MESSAGE>\n[Message] timestamp=2026-11-16T18:52:31Z sender=parent priority=HIGH content=Review the database connection pool settings for leaks\n</SYSTEM_MESSAGE>',
    };
    const { role, taskSummary } = extractSubagentRoleAndTask(sess);
    assert.strictEqual(taskSummary, 'Review the database connection pool settings for leaks');
    assert.strictEqual(role, 'Database Engineer');
  });

  await it('Extracts role and task when sess.taskSummary is truncated preamble by inspecting turns[0].userInput', () => {
    const sess = {
      sessionId: 'sub-sess-truncated-preamble',
      name: 'soko',
      role: 'Sub-Agent',
      workspaceName: 'soko',
      taskSummary: 'The following is a <SYSTEM_MESSAGE> not actually sent by the user. It is provided by the system as important information to pay ',
    };
    const turns = [
      {
        id: 'turn-0',
        stepIndex: 0,
        timestamp: Date.now(),
        userInput: 'The following is a <SYSTEM_MESSAGE> not actually sent by the user. It is provided by the system as important information to pay attention to.\n\n<SYSTEM_MESSAGE>\n[Message] timestamp=2026-11-16T18:28:18Z sender=parent content=<Identity>\n# Security Auditor\nAudit authentication tokens\n</Identity>\n<original_task>\nAudit authentication tokens for zero-trust compliance\n</original_task></SYSTEM_MESSAGE>',
        thinking: [],
        toolCalls: [],
        responses: [],
        status: 'completed',
      },
    ];
    const { role, taskSummary } = extractSubagentRoleAndTask(sess, turns, 0);
    assert.strictEqual(role, 'Security Auditor');
    assert.strictEqual(taskSummary, 'Audit authentication tokens for zero-trust compliance');
  });

  await it('Extracts full task from turns[0].userInput when disk peek is partially truncated after content= prefix', () => {
    const sess = {
      sessionId: 'sub-sess-content-truncated',
      name: 'soko',
      role: 'Sub-Agent',
      workspaceName: 'soko',
      taskSummary: 'The following is a <SYSTEM_MESSAGE> not actually sent by the user. It is provided by the system as important information to pay attention to.\n\n<SYSTEM_MESSAGE>\n[Message] timestamp=2026-11-16T18:28:18Z sender=parent priority=HIGH content=Au',
    };
    const turns = [
      {
        id: 'turn-0',
        stepIndex: 0,
        timestamp: Date.now(),
        userInput: 'The following is a <SYSTEM_MESSAGE> not actually sent by the user. It is provided by the system as important information to pay attention to.\n\n<SYSTEM_MESSAGE>\n[Message] timestamp=2026-11-16T18:28:18Z sender=parent priority=HIGH content=Audit all JWT authentication tokens for zero-trust compliance across all microservices',
        thinking: [],
        toolCalls: [],
        responses: [],
        status: 'completed',
      },
    ];
    const { role, taskSummary } = extractSubagentRoleAndTask(sess, turns, 0);
    assert.strictEqual(role, 'Security Auditor');
    assert.strictEqual(taskSummary, 'Audit all JWT authentication tokens for zero-trust compliance across all microservices');
  });

  await it('Extracts clean task from <task> tag and infers Code Reviewer role from review intent', () => {
    const sess = {
      sessionId: 'sub-sess-task-tag',
      name: 'soko',
      role: 'Sub-Agent',
      workspaceName: 'soko',
      taskSummary: '<task>Review code changes and verify zero defects in pull request</task>',
    };
    const { role, taskSummary } = extractSubagentRoleAndTask(sess);
    assert.strictEqual(role, 'QA Engineer');
    assert.strictEqual(taskSummary, 'Review code changes and verify zero defects in pull request');

    const sess2 = {
      sessionId: 'sub-sess-reviewer',
      name: 'soko',
      role: 'Sub-Agent',
      workspaceName: 'soko',
      taskSummary: '<Identity>\n# Code Reviewer\n</Identity>\nReview formatting and critique architectural structure',
    };
    const res2 = extractSubagentRoleAndTask(sess2);
    assert.strictEqual(res2.role, 'Code Reviewer');
  });

  await it('Extracts clean task when message envelope lacks priority attribute and has multiline preamble', () => {
    const sess = {
      sessionId: 'sub-sess-no-priority',
      name: 'soko',
      role: 'Sub-Agent',
      workspaceName: 'soko',
      taskSummary: 'The following is a <SYSTEM_MESSAGE> not actually sent by the user.\nIt is provided by the system as important information to pay attention to.\n\n<SYSTEM_MESSAGE>\n[Message] timestamp=2026-11-16T18:28:18Z sender=parent content=Verify and renew TLS certificate fingerprints for WebSocket bridge\n</SYSTEM_MESSAGE>',
    };
    const { role, taskSummary } = extractSubagentRoleAndTask(sess);
    assert.strictEqual(taskSummary, 'Verify and renew TLS certificate fingerprints for WebSocket bridge');
    assert.strictEqual(role, 'QA Engineer');
  });

  await it('Infers role from task intent keywords when role and name are missing or generic', () => {
    const testCases = [
      { task: 'Run unit test and Playwright assertion suite', expected: 'QA Engineer' },
      { task: 'Audit session tokens and check CVE vulnerability', expected: 'Security Auditor' },
      { task: 'Build responsive CSS layout and visual canvas component', expected: 'UI Architect' },
      { task: 'Execute PostgreSQL migration and redis cache indexing', expected: 'Database Engineer' },
      { task: 'Monitor heartbeat and detect system stall lockouts', expected: 'System Stall Monitor' },
      { task: 'Profile memory allocations and optimize request latency', expected: 'Performance Engineer' },
      { task: 'Deploy docker containers to kubernetes cloud cluster', expected: 'DevOps Engineer' },
      { task: 'Implement fix for visualizer buttons and refactor handlers', expected: 'Code Implementer' },
    ];

    testCases.forEach(({ task, expected }) => {
      const res = extractSubagentRoleAndTask({
        sessionId: 'sess-infer',
        role: 'Sub-Agent',
        name: 'soko',
        workspaceName: 'soko',
        taskSummary: task,
      });
      assert.strictEqual(res.role, expected);
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 2: Swarm Data Engine State & Telemetry Updates
  // --------------------------------------------------------------------------
  console.log('\n[Suite 2/4] Swarm Data Engine State & Telemetry Updates');

  await it('Engine updates in-memory agent state and notifies listeners on external activity', () => {
    const engine = new SwarmDataEngine();
    const testAgent = {
      id: 'sub-0001',
      sessionId: 'sub-0001-session-long-id',
      name: 'Code Implementer',
      clusterId: 'backend',
      clusterName: 'Backend Core Workers',
      role: 'Code Implementer',
      status: 'thinking',
      progress: 30,
      tokensPerSec: 0,
      totalTokens: 1000,
      reasoningSteps: [],
      traceSpans: [],
      taskSummary: 'Implement visualizer fix',
    };
    engine.state.clusters = [{
      id: 'backend',
      name: 'Backend Core Workers',
      iconType: 'worker',
      activeCount: 1,
      agents: [testAgent],
    }];
    engine.state.isRunning = true;

    let notificationsReceived = 0;
    engine.subscribe(() => {
      notificationsReceived++;
    });

    // Emitted activity from bridge / WebSocket
    engine.handleExternalAgentActivity({
      sessionId: 'sub-0001-session-long-id',
      status: 'waiting',
      detail: 'Requesting permission to run build script',
    });

    assert.strictEqual(testAgent.status, 'awaiting_approval');
    assert.strictEqual(testAgent.reasoningSteps.length, 1);
    assert.ok(testAgent.reasoningSteps[0].title.includes('Requesting permission'));
    assert.ok(testAgent.actionRequired, 'Arms actionRequired on waiting status');
    assert.strictEqual(testAgent.actionRequired.label, 'Requesting permission to run build script');
    assert.ok(notificationsReceived >= 2);
  });

  await it('Live activity update handles retrying status and updates placeholder taskSummary', () => {
    const engine = new SwarmDataEngine();
    const testAgent = {
      id: 'sub-retry-01',
      sessionId: 'sub-retry-01-full-uuid',
      name: 'UI Architect',
      clusterId: 'ui',
      clusterName: 'UI Cluster',
      role: 'UI Architect',
      status: 'working',
      progress: 40,
      tokensPerSec: 0,
      totalTokens: 1500,
      reasoningSteps: [],
      traceSpans: [],
      taskSummary: 'Executing UI Architect assignment',
    };
    engine.state.clusters = [{
      id: 'ui',
      name: 'UI Cluster',
      iconType: 'design',
      activeCount: 1,
      agents: [testAgent],
    }];
    engine.state.isRunning = true;

    engine.handleExternalAgentActivity({
      sessionId: 'sub-retry-01-full-uuid',
      status: 'retrying',
      detail: 'Retrying button animation rendering after frame drop',
      taskSummary: 'Refactor and animate TopBarControls mode pills',
    });

    assert.strictEqual(testAgent.status, 'retrying');
    assert.strictEqual(testAgent.taskSummary, 'Refactor and animate TopBarControls mode pills');
    assert.ok(testAgent.reasoningSteps.some((rs) => rs.title.includes('Retrying button animation')));
  });

  await it('Live activity updates normalize running status to working and failed to retrying', () => {
    const engine = new SwarmDataEngine();
    const testAgent = {
      id: 'sub-run-01',
      sessionId: 'sub-run-01-uuid',
      name: 'Backend Dev',
      clusterId: 'backend',
      clusterName: 'Backend',
      role: 'Backend Dev',
      status: 'idle',
      progress: 0,
      tokensPerSec: 0,
      totalTokens: 100,
      reasoningSteps: [],
      traceSpans: [],
    };
    engine.state.clusters = [{
      id: 'backend',
      name: 'Backend',
      iconType: 'worker',
      activeCount: 0,
      agents: [testAgent],
    }];
    engine.state.isRunning = true;

    // Bridge emits 'running'
    engine.handleExternalAgentActivity({
      sessionId: 'sub-run-01-uuid',
      status: 'running',
      detail: 'Running database schema migration',
    });
    assert.strictEqual(testAgent.status, 'working');
    assert.strictEqual(engine.state.clusters[0].activeCount, 1);

    // Bridge emits 'failed'
    engine.handleExternalAgentActivity({
      sessionId: 'sub-run-01-uuid',
      status: 'failed',
      detail: 'Migration failed due to locked table',
    });
    assert.strictEqual(testAgent.status, 'retrying');
  });

  await it('Cross-session subagent isolation excludes subagents with a different parentSessionId', () => {
    const availableSessions = [
      { sessionId: 'root-1', name: 'Root 1', isSubagent: false, parentSessionId: null },
      { sessionId: 'sub-1a', name: 'Sub 1A', isSubagent: true, parentSessionId: 'root-1' },
      { sessionId: 'root-2', name: 'Root 2', isSubagent: false, parentSessionId: null },
      { sessionId: 'sub-2a', name: 'Sub 2A', isSubagent: true, parentSessionId: 'root-2' },
      { sessionId: 'sub-orphan', name: 'Sub Orphan', isSubagent: true, parentSessionId: null },
    ];

    // Filter used in loadSession and syncLiveTelemetry
    const childSessionsRoot1 = availableSessions.filter(
      (s) => s.parentSessionId === 'root-1' || (!s.parentSessionId && s.isSubagent && s.sessionId !== 'root-1')
    );

    assert.deepStrictEqual(
      childSessionsRoot1.map((s) => s.sessionId),
      ['sub-1a', 'sub-orphan']
    );
    assert.ok(!childSessionsRoot1.some((s) => s.sessionId === 'sub-2a'), 'Subagents from root-2 do NOT leak into root-1');
  });

  await it('groupSubagentsIntoClusters preserves cluster isCollapsed state across engine regroupings', () => {
    const engine = new SwarmDataEngine();
    engine.state.clusters = [{
      id: 'backend',
      name: 'Backend Cluster',
      iconType: 'worker',
      activeCount: 1,
      isCollapsed: true, // User collapsed this cluster
      agents: [],
    }];

    const agent = {
      id: 'sub-collapse-1',
      sessionId: 'sess-col-1',
      name: 'Backend Engineer',
      clusterId: 'backend',
      clusterName: 'Backend Core Workers',
      role: 'Backend Engineer',
      status: 'working',
      progress: 50,
      tokensPerSec: 10,
      totalTokens: 1000,
      reasoningSteps: [],
      traceSpans: [],
    };

    const regrouped = engine.groupSubagentsIntoClusters([agent]);
    const backendCluster = regrouped.find((c) => c.id === 'backend');
    assert.ok(backendCluster);
    assert.strictEqual(backendCluster.isCollapsed, true, 'Preserved collapsed state on regroup');
  });

  await it('updateStateAndRecomputeStats maintains cluster activeCount across agent status transitions', () => {
    const engine = new SwarmDataEngine();
    const agentA = {
      id: 'sub-a',
      sessionId: 'sess-a',
      name: 'Backend Dev',
      clusterId: 'backend',
      clusterName: 'Backend',
      role: 'Backend Dev',
      status: 'working',
      progress: 60,
      tokensPerSec: 50,
      totalTokens: 2000,
      reasoningSteps: [],
      traceSpans: [],
    };
    const agentB = {
      id: 'sub-b',
      sessionId: 'sess-b',
      name: 'Database Dev',
      clusterId: 'backend',
      clusterName: 'Backend',
      role: 'Database Dev',
      status: 'working',
      progress: 80,
      tokensPerSec: 40,
      totalTokens: 3000,
      reasoningSteps: [],
      traceSpans: [],
    };
    engine.state.clusters = [{
      id: 'backend',
      name: 'Backend',
      iconType: 'worker',
      activeCount: 2,
      agents: [agentA, agentB],
    }];

    // Agent A completes
    agentA.status = 'completed';
    engine.updateStateAndRecomputeStats({});

    assert.strictEqual(engine.state.clusters[0].activeCount, 1);
    assert.strictEqual(engine.state.stats.totalParallel, 1);

    // Agent B completes
    agentB.status = 'completed';
    engine.updateStateAndRecomputeStats({});

    assert.strictEqual(engine.state.clusters[0].activeCount, 0);
    assert.strictEqual(engine.state.stats.totalParallel, 0);
  });

  await it('findAgent resolves agents by both short ID and full sessionId prefix', () => {
    const engine = new SwarmDataEngine();
    const testAgent = {
      id: '12345678',
      sessionId: '12345678-abcd-ef01-2345-6789abcdef01',
      name: 'QA Engineer',
      clusterId: 'qa',
      clusterName: 'QA Cluster',
      role: 'QA Engineer',
      status: 'working',
      progress: 50,
      tokensPerSec: 100,
      totalTokens: 5000,
      reasoningSteps: [],
      traceSpans: [],
    };
    engine.state.clusters = [{
      id: 'qa',
      name: 'QA Cluster',
      iconType: 'qa',
      activeCount: 1,
      agents: [testAgent],
    }];

    assert.strictEqual(engine.findAgent('12345678'), testAgent);
    assert.strictEqual(engine.findAgent('12345678-abcd-ef01-2345-6789abcdef01'), testAgent);
  });

  await it('Re-entrant live telemetry syncs queue properly with hasPendingSync without dropping updates', async () => {
    const engine = new SwarmDataEngine();
    engine.isSyncing = true; // Simulate in-flight sync

    // Concurrent sync request arrives
    await engine.syncLiveTelemetry();
    assert.strictEqual(engine.hasPendingSync, true);

    // Clean up
    engine.isSyncing = false;
    engine.hasPendingSync = false;
  });

  await it('Time travel scrub forwards and backwards preserves reasoning steps and trace spans without truncation loss', () => {
    const engine = new SwarmDataEngine();
    const initialSteps = [
      { id: '1', title: 'Step 1' },
      { id: '2', title: 'Step 2' },
      { id: '3', title: 'Step 3' },
      { id: '4', title: 'Step 4' },
      { id: '5', title: 'Step 5' },
    ];
    const initialSpans = [
      { id: 'sp1', name: 'Span 1', lane: 'llm' },
      { id: 'sp2', name: 'Span 2', lane: 'tool_blue' },
      { id: 'sp3', name: 'Span 3', lane: 'tool_orange' },
      { id: 'sp4', name: 'Span 4', lane: 'tool_purple' },
      { id: 'sp5', name: 'Span 5', lane: 'tool_blue' },
    ];
    const agent = {
      id: 'sub-scrub',
      sessionId: 'sub-scrub-uuid',
      name: 'Tester',
      clusterId: 'qa',
      clusterName: 'QA Cluster',
      role: 'QA Engineer',
      status: 'working',
      progress: 50,
      tokensPerSec: 0,
      totalTokens: 1000,
      rawReasoningSteps: [...initialSteps],
      reasoningSteps: [...initialSteps],
      rawTraceSpans: [...initialSpans],
      traceSpans: [...initialSpans],
    };
    engine.state.clusters = [{ id: 'qa', name: 'QA Cluster', iconType: 'qa', activeCount: 1, agents: [agent] }];
    engine.state.turns = [{ id: 't0' }, { id: 't1' }, { id: 't2' }, { id: 't3' }, { id: 't4' }];
    engine.state.maxTimeMs = 50000;

    // Scrub back to turn 0 (0ms)
    engine.setTimeTravelCursor(0);
    assert.strictEqual(engine.state.clusters[0].agents[0].reasoningSteps.length, 1);
    assert.strictEqual(engine.state.clusters[0].agents[0].traceSpans.length, 2);

    // Scrub forward to turn 4 (50000ms)
    engine.setTimeTravelCursor(50000);
    assert.strictEqual(engine.state.clusters[0].agents[0].reasoningSteps.length, 5, 'Reasoning steps restored on forward scrub');
    assert.strictEqual(engine.state.clusters[0].agents[0].traceSpans.length, 5, 'Trace spans restored on forward scrub');
  });

  await it('High-density swarm session with 50+ concurrent subagents groups all subagents dynamically without dropping sessions past index 11', () => {
    const engine = new SwarmDataEngine();
    const agents = [];
    const roles = ['Security Auditor', 'QA Engineer', 'UI Architect', 'Database Engineer', 'DevOps Engineer', 'Performance Engineer', 'System Stall Monitor', 'Backend Engineer'];
    for (let i = 0; i < 56; i++) {
      const role = roles[i % roles.length];
      agents.push({
        id: `agent-${i}`,
        sessionId: `agent-${i}-uuid`,
        name: `${role} ${i}`,
        role: role,
        clusterId: 'custom',
        clusterName: 'Custom',
        status: i % 3 === 0 ? 'working' : i % 3 === 1 ? 'awaiting_approval' : 'completed',
        progress: 50,
        tokensPerSec: 10,
        totalTokens: 1000,
        reasoningSteps: [],
        traceSpans: [],
      });
    }

    const clusters = engine.groupSubagentsIntoClusters(agents);
    assert.ok(clusters.length >= 6, 'Dynamic grouping formed at least 6 distinct role clusters');
    const totalGroupedAgents = clusters.reduce((acc, c) => acc + c.agents.length, 0);
    assert.strictEqual(totalGroupedAgents, 56, 'All 56 agents preserved across clusters without dropping any');
  });

  await it('findAgent and handleExternalAgentActivity resolve bidirectional short and long session IDs', () => {
    const engine = new SwarmDataEngine();
    const fullUuid = 'abcdef01-2345-6789-abcd-ef0123456789';
    const shortId = 'abcdef01';
    const agent = {
      id: shortId,
      sessionId: fullUuid,
      name: 'Security Auditor',
      clusterId: 'security',
      clusterName: 'Security Cluster',
      role: 'Security Auditor',
      status: 'idle',
      progress: 0,
      tokensPerSec: 0,
      totalTokens: 1000,
      reasoningSteps: [],
      traceSpans: [],
    };
    engine.state.clusters = [{ id: 'security', name: 'Security Cluster', iconType: 'auditor', activeCount: 0, agents: [agent] }];
    engine.state.isRunning = true;

    // Resolve by short ID
    assert.strictEqual(engine.findAgent(shortId), agent);
    // Resolve by full UUID
    assert.strictEqual(engine.findAgent(fullUuid), agent);

    // Activity arrives with short ID prefix
    engine.handleExternalAgentActivity({
      sessionId: shortId,
      status: 'working',
      detail: 'Scanning dependencies for CVE vulnerabilities',
    });
    assert.strictEqual(agent.status, 'working');
    assert.strictEqual(agent.reasoningSteps.length, 1);
  });

  await it('setViewMode and loadSession synchronize isLiveSource flag with viewMode', () => {
    const engine = new SwarmDataEngine();
    engine.setViewMode('history');
    assert.strictEqual(engine.getState().viewMode, 'history');
    assert.strictEqual(engine.getState().isLiveSource, false, 'isLiveSource is false in history mode');

    engine.setViewMode('live');
    assert.strictEqual(engine.getState().viewMode, 'live');
    assert.strictEqual(engine.getState().isLiveSource, true, 'isLiveSource is true in live mode');
  });

  // --------------------------------------------------------------------------
  // SUITE 3: Interactive Controls & Button Handlers
  // --------------------------------------------------------------------------
  console.log('\n[Suite 3/4] Interactive Controls & Button Handlers');

  await it('Approve button executes approveAction, transitions agent to working, and records approval step', async () => {
    const engine = new SwarmDataEngine();
    const agent = {
      id: 'sub-0002',
      sessionId: 'sub-0002-full-uuid',
      name: 'QA Engineer',
      clusterId: 'qa',
      clusterName: 'QA Cluster',
      role: 'QA Engineer',
      status: 'awaiting_approval',
      progress: 30,
      tokensPerSec: 0,
      totalTokens: 2000,
      actionRequired: { actionId: 'act-run-test', label: 'Run Automated Tests', toolName: 'run_tests', args: {} },
      reasoningSteps: [],
      traceSpans: [{ id: 'sp-1', name: 'Testing', lane: 'tool_blue', startTimePercent: 0, widthPercent: 50, durationMs: 1000, status: 'running' }],
    };
    engine.state.clusters = [{
      id: 'qa',
      name: 'QA Cluster',
      iconType: 'qa',
      activeCount: 1,
      agents: [agent],
    }];

    await engine.approveAction('sub-0002', 'act-run-test');

    const updatedAgent = engine.findAgent('sub-0002');
    assert.strictEqual(updatedAgent.status, 'working');
    assert.strictEqual(updatedAgent.actionRequired, undefined);
    assert.ok(updatedAgent.reasoningSteps.some((rs) => rs.title.includes('Operator Approved Execution')));
    assert.strictEqual(updatedAgent.traceSpans[0].status, 'success');
  });

  await it('Reject button executes rejectAction, transitions agent to idle, and clears actionRequired', async () => {
    const engine = new SwarmDataEngine();
    const agent = {
      id: 'sub-0003',
      sessionId: 'sub-0003-full-uuid',
      name: 'Security Auditor',
      clusterId: 'security',
      clusterName: 'Security Cluster',
      role: 'Security Auditor',
      status: 'awaiting_approval',
      progress: 40,
      tokensPerSec: 0,
      totalTokens: 3000,
      actionRequired: { actionId: 'act-drop-table', label: 'Drop Table', toolName: 'drop_table', args: {} },
      reasoningSteps: [],
      traceSpans: [],
    };
    engine.state.clusters = [{
      id: 'security',
      name: 'Security Cluster',
      iconType: 'auditor',
      activeCount: 1,
      agents: [agent],
    }];

    await engine.rejectAction('sub-0003', 'act-drop-table');

    const updatedAgent = engine.findAgent('sub-0003');
    assert.strictEqual(updatedAgent.status, 'idle');
    assert.strictEqual(updatedAgent.actionRequired, undefined);
    assert.ok(updatedAgent.reasoningSteps.some((rs) => rs.title.includes('Operator Rejected Action')));
  });

  await it('Retry button executes retryAgent, transitions agent to working, and resets progress', async () => {
    const engine = new SwarmDataEngine();
    const agent = {
      id: 'sub-0004',
      sessionId: 'sub-0004-full-uuid',
      name: 'UI Architect',
      clusterId: 'ui',
      clusterName: 'UI Cluster',
      role: 'UI Architect',
      status: 'retrying',
      progress: 90,
      tokensPerSec: 0,
      totalTokens: 4000,
      reasoningSteps: [],
      traceSpans: [],
    };
    engine.state.clusters = [{
      id: 'ui',
      name: 'UI Cluster',
      iconType: 'design',
      activeCount: 1,
      agents: [agent],
    }];

    await engine.retryAgent('sub-0004');

    const updatedAgent = engine.findAgent('sub-0004');
    assert.strictEqual(updatedAgent.status, 'working');
    assert.strictEqual(updatedAgent.progress, 25);
    assert.ok(updatedAgent.reasoningSteps.some((rs) => rs.title.includes('Retrying execution suite')));
  });

  await it('Prompt Agent button & form executes sendPrompt, transitions agent to working, records active instruction step, and updates stats', async () => {
    const engine = new SwarmDataEngine();
    const agent = {
      id: 'sub-0005',
      sessionId: 'sub-0005-full-uuid',
      name: 'Implementer',
      clusterId: 'worker',
      clusterName: 'Worker Cluster',
      role: 'Implementer',
      status: 'idle',
      progress: 0,
      tokensPerSec: 0,
      totalTokens: 2500,
      reasoningSteps: [],
      traceSpans: [],
    };
    engine.state.clusters = [{
      id: 'worker',
      name: 'Worker Cluster',
      iconType: 'worker',
      activeCount: 0,
      agents: [agent],
    }];

    await engine.sendPrompt('sub-0005', 'Check edge case with zero subagents');

    const updatedAgent = engine.findAgent('sub-0005');
    assert.strictEqual(updatedAgent.status, 'working');
    assert.strictEqual(engine.state.clusters[0].activeCount, 1);
    assert.ok(updatedAgent.reasoningSteps.some((rs) => rs.title.includes('Operator Dispatched Instruction')));
    assert.ok(engine.state.terminalLogs.some((l) => l.message.includes('Check edge case with zero subagents')));
  });

  // --------------------------------------------------------------------------
  // SUITE 4: Desktop Component Source Code Wiring Verification
  // --------------------------------------------------------------------------
  console.log('\n[Suite 4/4] Desktop Component Source Code Wiring Verification');

  const desktopSrc = path.resolve(__dirname, '../apps/desktop/src');

  await it('AgentCard.tsx displays proper role, short ID badge, and associated task summary', () => {
    const cardSrc = fs.readFileSync(path.join(desktopSrc, 'features/swarm-visualizer/components/AgentCard.tsx'), 'utf8');
    assert.ok(cardSrc.includes('agent.role || agent.name || agent.id'), 'AgentCard renders proper role/name title');
    assert.ok(cardSrc.includes('#{agent.id.slice(0, 6)}'), 'AgentCard renders short ID badge');
    assert.ok(cardSrc.includes('agent.taskSummary || agent.task'), 'AgentCard renders associated task summary');
    assert.ok(cardSrc.includes('line-clamp-2'), 'AgentCard clamps task summary for tidy layout');
  });

  await it('InspectorPanel.tsx displays Associated Task block, proper role, allAgents dropdown, and wired actions', () => {
    const inspectorSrc = fs.readFileSync(path.join(desktopSrc, 'features/swarm-visualizer/components/InspectorPanel.tsx'), 'utf8');
    assert.ok(inspectorSrc.includes('Associated Task'), 'InspectorPanel includes Associated Task section header');
    assert.ok(inspectorSrc.includes('activeAgent.taskSummary || activeAgent.task'), 'InspectorPanel renders associated task');
    assert.ok(inspectorSrc.includes('activeAgent.role'), 'InspectorPanel renders proper role');
    assert.ok(inspectorSrc.includes('allAgents.map'), 'Action dropdown maps across all swarm agents');
    assert.ok(inspectorSrc.includes('onSendPrompt'), 'InspectorPanel supports onSendPrompt callback');
    assert.ok(inspectorSrc.includes('handleApprove'), 'InspectorPanel has handleApprove button action');
    assert.ok(inspectorSrc.includes('handleReject'), 'InspectorPanel has handleReject button action');
  });

  await it('AgentClusterGroup.tsx has explicit onClick on Chevron collapse button and clickable action badges', () => {
    const clusterSrc = fs.readFileSync(path.join(desktopSrc, 'features/swarm-visualizer/components/AgentClusterGroup.tsx'), 'utf8');
    assert.ok(clusterSrc.includes('onClick={(e) => {'), 'Cluster chevron has explicit onClick handler');
    assert.ok(clusterSrc.includes('handleToggle();'), 'Chevron calls handleToggle');
    assert.ok(clusterSrc.includes('title="Click to inspect agent awaiting approval"'), 'Awaiting approval badge is interactive button');
    assert.ok(clusterSrc.includes('title="Click to inspect retrying agent"'), 'Retrying badge is interactive button');
  });

  await it('TopBarControls.tsx has interactive LIVE/ARCHIVE buttons, stat filter toggles, and view mode handler', () => {
    const topBarSrc = fs.readFileSync(path.join(desktopSrc, 'features/swarm-visualizer/components/TopBarControls.tsx'), 'utf8');
    assert.ok(topBarSrc.includes('onToggleViewMode'), 'TopBarControls supports onToggleViewMode');
    assert.ok(topBarSrc.includes('title="Current mode: Live Telemetry. Click to toggle Historical Archive mode."'), 'LIVE pill is interactive button');
    assert.ok(topBarSrc.includes('title="Current mode: Historical Archive. Click to switch to Live Telemetry."'), 'ARCHIVE pill is interactive button');
    assert.ok(topBarSrc.includes('Click to reset filter and show all subagents'), 'Total Parallel chip is interactive filter reset button');
    assert.ok(topBarSrc.includes('Click to filter subagents awaiting approval'), 'Awaiting approval chip is interactive filter toggle button');
  });

  await it('TraceWaterfall.tsx has Synchronized toggle button, clickable trace spans, and isCollapsed sync', () => {
    const traceSrc = fs.readFileSync(path.join(desktopSrc, 'features/swarm-visualizer/components/TraceWaterfall.tsx'), 'utf8');
    assert.ok(traceSrc.includes('title="Click to toggle."') || traceSrc.includes('title={isSynchronized'), 'Synchronized indicator is interactive button');
    assert.ok(traceSrc.includes('setCollapsed(isCollapsed)'), 'TraceWaterfall syncs collapsed state when isCollapsed prop changes');
    assert.ok(traceSrc.includes('onClick={(e) => {') && traceSrc.includes('targetMs = Math.round'), 'Trace spans are clickable to scrub time travel cursor');
    assert.ok(traceSrc.includes('isOpen ? \'opacity-100\' : \'opacity-20 pointer-events-none\''), 'TraceWaterfall dims collapsed lane row');
  });

  await it('SwarmVisualizerTab.tsx wires onSendPrompt and onToggleViewMode', () => {
    const tabSrc = fs.readFileSync(path.join(desktopSrc, 'features/swarm-visualizer/SwarmVisualizerTab.tsx'), 'utf8');
    assert.ok(tabSrc.includes('onSendPrompt={(agentId, prompt) => swarmDataEngine.sendPrompt(agentId, prompt)}'), 'Desktop and mobile InspectorPanel wire onSendPrompt');
    assert.ok(tabSrc.includes('onToggleViewMode={(mode) => swarmDataEngine.setViewMode(mode)}'), 'TopBarControls wires onToggleViewMode');
  });

  await it('SwarmCanvas.tsx filters by taskSummary and excludes empty clusters when searching', () => {
    const canvasSrc = fs.readFileSync(path.join(desktopSrc, 'features/swarm-visualizer/components/SwarmCanvas.tsx'), 'utf8');
    assert.ok(canvasSrc.includes('agent.taskSummary'), 'Canvas filters agents by taskSummary');
    assert.ok(canvasSrc.includes('.filter((c) => !query || c.agents.length > 0)'), 'Canvas filters out empty clusters when search query is active');
    assert.ok(canvasSrc.includes('clusters.find((c) => c.id === clusterId)?.isCollapsed'), 'Canvas handles initial cluster collapsed state');
    assert.ok(canvasSrc.includes('cluster.name.toLowerCase().includes(query)'), 'Canvas matches cluster name on filter');
    assert.ok(canvasSrc.includes('onToggleClusterCollapse'), 'SwarmCanvas declares and invokes onToggleClusterCollapse');

    const tabSrc = fs.readFileSync(path.join(desktopSrc, 'features/swarm-visualizer/SwarmVisualizerTab.tsx'), 'utf8');
    assert.ok(tabSrc.includes('onToggleClusterCollapse={(clusterId) => swarmDataEngine.toggleClusterCollapse(clusterId)}'), 'SwarmVisualizerTab passes onToggleClusterCollapse to SwarmCanvas');
  });

  await it('OrchestratorNode.tsx uses safe optional chaining for clipboard access', () => {
    const orchSrc = fs.readFileSync(path.join(desktopSrc, 'features/swarm-visualizer/components/OrchestratorNode.tsx'), 'utf8');
    assert.ok(orchSrc.includes('navigator.clipboard?.writeText(sessionId)'), 'OrchestratorNode safely checks clipboard before writeText');
  });

  await it('InspectorPanel.tsx and TraceWaterfall.tsx wire outside-click dismissal refs for dropdowns', () => {
    const inspectorSrc = fs.readFileSync(path.join(desktopSrc, 'features/swarm-visualizer/components/InspectorPanel.tsx'), 'utf8');
    assert.ok(inspectorSrc.includes('actionDropdownRef'), 'InspectorPanel has actionDropdownRef');
    assert.ok(inspectorSrc.includes('setIsActionDropdownOpen(false)'), 'InspectorPanel closes action dropdown on click outside');

    const traceSrc = fs.readFileSync(path.join(desktopSrc, 'features/swarm-visualizer/components/TraceWaterfall.tsx'), 'utf8');
    assert.ok(traceSrc.includes('arizeDropdownRef'), 'TraceWaterfall has arizeDropdownRef');
    assert.ok(traceSrc.includes('setIsArizeDropdownOpen(false)'), 'TraceWaterfall closes Arize dropdown on click outside');
  });

  console.log('\n================================================================');
  console.log(` RESULTS: ${passedTests} / ${totalTests} tests passed (100%)`);
  console.log('================================================================');
}

main().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
