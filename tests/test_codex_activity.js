const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseCodexActivity, readCodexActivityTail } = require('../scripts/codex_activity');

const event = (type, extra = {}) => ({ type: 'event_msg', payload: { type, ...extra } });
const message = (role, text) => ({ type: 'response_item', payload: {
  type: 'message', role, content: [{ type: role === 'user' ? 'input_text' : 'output_text', text }],
} });
const rollout = (items) => items.map((item) => JSON.stringify(item)).join('\n') + '\n';

const firstTurn = [
  { type: 'session_meta', payload: { cwd: '/work/soko' } },
  event('task_started'), message('user', 'Fix the search screen'),
  message('assistant', 'I am checking the search UI'),
  event('task_complete'),
];
const secondTurn = [event('task_started'), message('user', 'Fix the Codex island text')];

let activity = parseCodexActivity(rollout([...firstTurn, ...secondTurn]));
assert.equal(activity.isDone, false, 'old completion does not finish the new turn');
assert.equal(activity.taskSummary, 'Fix the Codex island text');
assert.equal(activity.detail, 'Working on: Fix the Codex island text');
assert.equal(activity.cwd, '/work/soko');

activity = parseCodexActivity(rollout([...firstTurn, ...secondTurn,
  message('assistant', 'I am tracing the rollout records'),
  { type: 'response_item', payload: { type: 'custom_tool_call', name: 'exec' } },
  event('token_count', { info: { total_token_usage: { total_tokens: 4210 } } }),
]));
assert.equal(activity.detail, 'Working on: Fix the Codex island text');
assert.equal(activity.tokensUsed, 4210);
assert.equal(activity.taskSummary, 'Fix the Codex island text');

activity = parseCodexActivity(rollout([...firstTurn, ...secondTurn,
  message('assistant', 'I am tracing the rollout records'), event('task_complete'),
]));
assert.equal(activity.isDone, true);
assert.equal(activity.taskSummary, 'Fix the Codex island text');

activity = parseCodexActivity(rollout([...firstTurn, ...secondTurn,
  event('task_complete'), event('task_started'), message('user', 'Third distinct turn'),
]));
assert.equal(activity.isDone, false);
assert.equal(activity.taskSummary, 'Third distinct turn');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'soko-codex-'));
try {
  const file = path.join(temp, 'rollout.jsonl');
  const longTurn = rollout([...firstTurn, ...secondTurn,
    { type: 'response_item', payload: { type: 'function_call_output', output: 'x'.repeat(100000) } },
    message('assistant', 'Checking the current turn'),
  ]);
  fs.writeFileSync(file, longTurn);
  activity = parseCodexActivity(readCodexActivityTail(file, Buffer.byteLength(longTurn)));
  assert.equal(activity.taskSummary, 'Fix the Codex island text');
  assert.equal(activity.detail, 'Checking the current turn');
  assert.equal(activity.isDone, false);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

console.log('Codex activity turn parsing passed.');
