const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const notifications = [];
const packets = [];
const window = {
  sendPacket: (type, payload) => { packets.push({ type, payload }); return true; },
  showToast() {},
  SokoNative: { postSystemNotification: (...args) => notifications.push(args) },
};
const document = { readyState: 'loading', addEventListener() {} };
const source = fs.readFileSync(path.join(__dirname, '../apps/mobile/companion/agent-terminal/terminal.js'), 'utf8');
vm.runInNewContext(source, { window, document, console, setTimeout: () => 0, clearTimeout() {}, navigator: {} });
const terminal = window.AgentTerminal;
terminal.setMascotState = () => {};
terminal.updatePaginationUI = () => {};
terminal.promptInput = { value: '', disabled: false, placeholder: '' };
terminal.sendBtn = { disabled: false, title: '', setAttribute() {} };
terminal.promptModeNote = { hidden: true, textContent: '' };
terminal.renderFeed = () => {};
terminal.syncCurrentSession = () => {};

terminal.allSessions = [{ sessionId: 'codex-1', agent: 'codex' }, { sessionId: 'agy-1', agent: 'antigravity' }];
terminal.currentSessionId = 'codex-1';
terminal.updatePromptControls();
assert.equal(terminal.promptInput.disabled, true);
assert.equal(terminal.sendBtn.disabled, true);
assert.equal(terminal.promptModeNote.hidden, false);
terminal.handleActivityStatus({ sessionId: 'raw-codex-id', agent: 'codex', status: 'working', activeSessions: [{ sessionId: 'raw-codex-id' }] });
assert.equal(terminal.currentSessionId, 'codex-1', 'island status does not replace terminal session ID');
assert.equal(terminal.allSessions[0].sessionId, 'codex-1');

terminal.currentSessionId = 'agy-1';
terminal.promptInput.value = 'Run focused tests';
terminal.updatePromptControls();
assert.equal(terminal.promptInput.disabled, false);
terminal.sendPrompt('Run focused tests');
assert.equal(terminal.sendBtn.disabled, true);
assert.equal(terminal.promptInput.value, 'Run focused tests');
assert.equal(packets.at(-1).type, 'AGENT_SEND_PROMPT');
terminal.handlePromptResult({ success: false, error: 'Connection lost' });
assert.equal(terminal.promptInput.value, 'Run focused tests', 'failed send keeps instruction');
assert.equal(terminal.sendBtn.disabled, false);
terminal.sendPrompt('Run focused tests');
terminal.handlePromptResult({ success: true, status: 'queued' });
assert.equal(terminal.promptInput.value, '');
assert.equal(terminal.turns.at(-1).userInput, 'Run focused tests');

terminal.notifyAgentDone({ sessionId: 'codex-1', completionRevision: '42:task', title: 'Done', message: 'Finished' });
terminal.notifyAgentDone({ sessionId: 'codex-1', completionRevision: '42:task', title: 'Done', message: 'Finished' });
assert.equal(notifications.length, 1, 'same completion only posts one Android notification');

console.log('Mobile terminal controls and notification deduplication passed.');
