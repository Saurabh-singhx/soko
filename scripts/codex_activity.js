const fs = require('fs');

// Read back to the current turn boundary. Codex tool output can be much larger
// than a fixed tail buffer, so the prompt may be hundreds of kilobytes back.
function readCodexActivityTail(file, size) {
  const fd = fs.openSync(file, 'r');
  try {
    let length = Math.min(size, 65536);
    let raw = '';
    while (true) {
      const buffer = Buffer.alloc(length);
      fs.readSync(fd, buffer, 0, length, size - length);
      raw = buffer.toString('utf8');
      if (length === size || /"type"\s*:\s*"(?:task|turn)_started"/.test(raw) || length >= 8 * 1024 * 1024) {
        return raw;
      }
      length = Math.min(size, length * 2);
    }
  } finally {
    fs.closeSync(fd);
  }
}

// Extract the current turn from the recent tail of a Codex rollout JSONL file.
function parseCodexActivity(raw) {
  const records = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try { records.push(JSON.parse(line)); } catch {}
  }

  const isEvent = (item, type) => item.type === 'event_msg' && item.payload?.type === type;
  let start = records.findLastIndex((item) => isEvent(item, 'task_started') || isEvent(item, 'turn_started'));
  if (start < 0) {
    start = records.findLastIndex((item) => item.type === 'response_item' &&
      item.payload?.type === 'message' && item.payload?.role === 'user');
  }
  const turn = start >= 0 ? records.slice(start) : records;
  let taskSummary = '';
  let assistantDetail = '';
  let toolDetail = '';
  let detailKind = '';
  let tokensUsed = 0;
  let cwd = '';
  let completed = false;

  const shortText = (value) => {
    if (typeof value !== 'string') return '';
    const first = value.split('\n').map((part) => part.replace(/^[#*>`\s-]+/, '').trim())
      .find((part) => part && !part.startsWith('<environment_context>'));
    return first ? first.slice(0, 90) : '';
  };

  for (const item of records) {
    if (typeof item.payload?.cwd === 'string') cwd = item.payload.cwd;
    const usage = item.payload?.info?.total_token_usage?.total_tokens || item.payload?.usage?.total_tokens;
    if (Number.isFinite(usage)) tokensUsed = usage;
  }

  for (const item of turn) {
    if (isEvent(item, 'task_started') || isEvent(item, 'turn_started')) completed = false;
    if (isEvent(item, 'task_complete') || isEvent(item, 'turn_complete')) completed = true;

    const payload = item.payload;
    if (item.type !== 'response_item' || !payload) continue;
    completed = false;
    if (payload.type === 'message' && payload.role === 'user') {
      const text = payload.content?.filter((part) => part.type === 'input_text')
        .map((part) => shortText(part.text)).find(Boolean);
      if (text) taskSummary = text;
      completed = false;
      assistantDetail = '';
      toolDetail = '';
      detailKind = '';
    } else if (payload.type === 'message' && payload.role === 'assistant') {
      const text = payload.content?.filter((part) => part.type === 'output_text')
        .map((part) => shortText(part.text)).find(Boolean);
      if (text) {
        assistantDetail = text;
        detailKind = 'assistant';
      }
    } else if (payload.type === 'function_call' || payload.type === 'custom_tool_call') {
      if (payload.name) {
        toolDetail = payload.name;
        detailKind = 'tool';
      }
    }
  }

  return {
    isDone: completed,
    taskSummary: taskSummary || 'Codex task',
    detail: detailKind === 'assistant' ? assistantDetail : detailKind === 'tool' ?
      `${toolDetail === 'exec' ? 'Working on' : `Using ${toolDetail} for`}: ${taskSummary || 'Codex task'}`
      : taskSummary ? `Working on: ${taskSummary}` : 'Working on Codex task',
    tokensUsed: tokensUsed || 1200,
    cwd,
  };
}

module.exports = { parseCodexActivity, readCodexActivityTail };
