const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

/**
 * Strips ANSI escape sequences and terminal control characters from strings.
 */
function cleanAnsi(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
}

/**
 * Strips XML wrapper tags (<USER_REQUEST>, <ADDITIONAL_METADATA>, etc.) from user messages.
 */
function extractCleanUserInput(content) {
  if (!content) return '';
  let cleaned = cleanAnsi(String(content));

  // Match inside <USER_REQUEST>...</USER_REQUEST> if present
  const reqMatch = cleaned.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/i);
  if (reqMatch && reqMatch[1]) {
    cleaned = reqMatch[1];
  }

  // Strip system prompt blocks and metadata tags
  cleaned = cleaned
    .replace(/<ADDITIONAL_METADATA>[\s\S]*?<\/ADDITIONAL_METADATA>/gi, '')
    .replace(/<USER_SETTINGS_CHANGE>[\s\S]*?<\/USER_SETTINGS_CHANGE>/gi, '')
    .replace(/<CONTEXT_SUMMARY>[\s\S]*?<\/CONTEXT_SUMMARY>/gi, '')
    .replace(/<SYSTEM_MESSAGE>[\s\S]*?<\/SYSTEM_MESSAGE>/gi, '')
    .replace(/<identity>[\s\S]*?<\/identity>/gi, '')
    .replace(/<artifacts>[\s\S]*?<\/artifacts>/gi, '')
    .replace(/<user_rules>[\s\S]*?<\/user_rules>/gi, '')
    .replace(/<conversation_transcript>[\s\S]*?<\/conversation_transcript>/gi, '')
    .replace(/<guidelines>[\s\S]*?<\/guidelines>/gi, '')
    .replace(/<communication_style>[\s\S]*?<\/communication_style>/gi, '')
    .replace(/<slash_commands>[\s\S]*?<\/slash_commands>/gi, '')
    .replace(/<messaging>[\s\S]*?<\/messaging>/gi, '')
    .replace(/<subagents>[\s\S]*?<\/subagents>/gi, '')
    .replace(/<skills>[\s\S]*?<\/skills>/gi, '')
    .replace(/<user_information>[\s\S]*?<\/user_information>/gi, '');

  // Strip trailing notes about SYSTEM_MESSAGE if present
  cleaned = cleaned.replace(/The following is a <SYSTEM_MESSAGE>[\s\S]*$/gi, '');

  return cleaned.trim();
}

/**
 * Extracts human-readable summary from a tool call object.
 */
function formatToolCall(tc) {
  if (!tc) return { name: 'unknown', summary: 'Executing tool', args: {} };
  const name = tc.name || 'tool';
  const args = tc.args || {};

  let summary = args.toolSummary || args.toolAction || '';
  if (!summary) {
    if (name === 'run_command') {
      const cmd = cleanAnsi(args.CommandLine || args.command || '').trim();
      summary = cmd ? `$ ${cmd.slice(0, 60)}` : 'Running shell command';
    } else if (name === 'read_file' || name === 'view_file') {
      const p = (args.Path || args.AbsolutePath || args.path || '').trim();
      summary = p ? `Read ${path.basename(p)}` : 'Reading file';
    } else if (name === 'edit_file' || name === 'replace_file_content') {
      const p = (args.Path || args.TargetFile || args.path || '').trim();
      summary = p ? `Edit ${path.basename(p)}` : 'Editing file';
    } else if (name === 'write_file' || name === 'write_to_file') {
      const p = (args.Path || args.TargetFile || '').trim();
      summary = p ? `Create ${path.basename(p)}` : 'Creating file';
    } else if (name === 'search_web') {
      summary = args.query ? `Search: "${args.query.slice(0, 40)}"` : 'Searching web';
    } else if (name === 'ask_question') {
      summary = 'Clarifying requirements with user';
    } else {
      summary = `Execute ${name}`;
    }
  }

  return {
    name,
    summary,
    args,
  };
}

/**
 * Sanitizes and caps large tool outputs to prevent mobile UI memory freezes.
 */
function sanitizeToolOutput(rawOutput, maxLines = 40, maxChars = 4096) {
  if (!rawOutput) return { text: '', truncated: false, lineCount: 0 };
  const cleaned = cleanAnsi(String(rawOutput));
  const lines = cleaned.split('\n');
  const lineCount = lines.length;

  if (lineCount <= maxLines && cleaned.length <= maxChars) {
    return { text: cleaned, truncated: false, lineCount };
  }

  const truncatedLines = lines.slice(0, maxLines);
  let text = truncatedLines.join('\n');
  if (text.length > maxChars) {
    text = text.slice(0, maxChars);
  }
  return {
    text: text + `\n\n... [Truncated ${lineCount - maxLines} lines for mobile display]`,
    truncated: true,
    lineCount,
  };
}

/**
 * Detects if a transcript item is a subagent dispatch envelope.
 */
function isSubagentDispatchEnvelope(item) {
  if (!item) return false;
  const content = item.content ? String(item.content) : '';
  if (content.includes('[Message]') && (content.includes('sender=') || content.includes('content='))) {
    return true;
  }
  if (
    (item.type === 'SYSTEM_MESSAGE' || item.source === 'SYSTEM') &&
    (content.includes('sender=') || content.includes('not actually sent by the user'))
  ) {
    return true;
  }
  return false;
}

/**
 * Extracts prompt/instructions from a subagent dispatch envelope.
 */
function extractDispatchEnvelopePrompt(rawContent) {
  if (!rawContent) return '';
  const cleaned = cleanAnsi(String(rawContent));
  // Look for content=...
  const match = cleaned.match(/\[Message\][\s\S]*?\bcontent=([\s\S]*?)(?:<\/SYSTEM_MESSAGE>|$)/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  // Strip preamble if present
  const stripped = cleaned
    .replace(/The following is a <SYSTEM_MESSAGE>[\s\S]*?attention to\./gi, '')
    .replace(/<\/?SYSTEM_MESSAGE>/gi, '')
    .trim();
  return stripped;
}

class AgentSessionManager {
  constructor(options = {}) {
    this.brainDirs = options.brainDirs || this._resolveDefaultBrainDirs();
    this.presenceDirs = options.presenceDirs || this._resolveDefaultPresenceDirs();
    const home = os.homedir();
    this.codexSessionDirs = options.codexSessionDirs || (options.brainDirs ? [] : (process.env.SOKO_CODEX_SESSIONS_DIR || path.join(home, '.codex/sessions')).split(path.delimiter).filter(Boolean));
    this.claudeProjectDirs = options.claudeProjectDirs || (options.brainDirs ? [] : (process.env.SOKO_CLAUDE_PROJECTS_DIR || path.join(home, '.claude/projects')).split(path.delimiter).filter(Boolean));
    this.discoveredFiles = new Map();
    this.jsonlMetadataCache = new Map();
    this.activeWatchers = new Map(); // sessionId -> { watcher, byteOffset, partialLine }
    this.pendingQueue = new Map(); // sessionId -> Array<{ prompt, resolve, reject, timestamp }>
    this.activeChildProcesses = new Map(); // sessionId -> ChildProcess
  }

  _resolveDefaultBrainDirs() {
    const home = os.homedir();
    const envDirs = (process.env.SOKO_AGENT_BRAIN_DIRS || process.env.SOKO_AGENT_BRAIN_DIR || '')
      .split(path.delimiter)
      .map((d) => d.trim())
      .filter(Boolean);

    return [
      ...envDirs,
      path.join(home, '.gemini/antigravity-cli/brain'),
      path.join(home, '.gemini/antigravity/brain'),
      path.join(home, '.gemini/antigravity-ide/brain'),
    ];
  }

  _resolveDefaultPresenceDirs() {
    const home = os.homedir();
    const envDirs = (process.env.SOKO_AGENT_PRESENCE_DIRS || process.env.SOKO_AGENT_PRESENCE_DIR || '')
      .split(path.delimiter)
      .map((d) => d.trim())
      .filter(Boolean);

    return [
      ...envDirs,
      path.join(home, '.gemini/antigravity-cli/presence'),
      path.join(home, '.gemini/antigravity/presence'),
      path.join(home, '.gemini/antigravity-ide/presence'),
    ];
  }

  /**
   * Validates sessionId format to prevent directory traversal attacks.
   */
  isValidSessionId(id) {
    return typeof id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_\-\.]*$/.test(id) && !id.includes('..');
  }

  /**
   * Resolves paths to transcript and lock file for a given session.
   */
  resolveSessionPaths(sessionId) {
    if (!this.isValidSessionId(sessionId)) return null;

    const discovered = this.discoveredFiles.get(sessionId);
    if (discovered && discovered.provider !== 'antigravity' && fs.existsSync(discovered.transcriptPath)) {
      return {
        sessionId,
        provider: discovered.provider,
        transcriptPath: discovered.transcriptPath,
        lockPath: null,
      };
    }

    for (const bDir of this.brainDirs) {
      const candidateTranscript = path.join(bDir, sessionId, '.system_generated/logs/transcript.jsonl');
      if (fs.existsSync(candidateTranscript)) {
        let lockPath = null;
        for (const pDir of this.presenceDirs) {
          const cLock = path.join(pDir, `${sessionId}.lock`);
          if (fs.existsSync(cLock)) {
            lockPath = cLock;
            break;
          }
        }
        return {
          sessionId,
          brainDir: path.join(bDir, sessionId),
          transcriptPath: candidateTranscript,
          lockPath,
        };
      }
    }
    return null;
  }

  /**
   * Discovers all active and recent sessions across brain directories.
   */
  discoverSessions(recentLimitMs = 7 * 24 * 60 * 60 * 1000) {
    const sessions = [];
    const now = Date.now();
    const seen = new Set();
    this.discoveredFiles.clear();

    for (const bDir of this.brainDirs) {
      if (!fs.existsSync(bDir)) continue;
      try {
        const entries = fs.readdirSync(bDir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
          const sessionId = entry.name;
          if (seen.has(sessionId)) continue;

          const tPath = path.join(bDir, sessionId, '.system_generated/logs/transcript.jsonl');
          if (!fs.existsSync(tPath)) continue;

          let stat;
          try {
            stat = fs.statSync(tPath);
          } catch {
            continue;
          }

          const ageMs = now - stat.mtimeMs;
          if (ageMs > recentLimitMs) continue;

          // Check presence lock - verify if lock is recent (< 20m) and transcript active (< 20m)
          const STALE_LOCK_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes
          let hasLockFile = false;
          let isLocked = false;
          for (const pDir of this.presenceDirs) {
            const cLock = path.join(pDir, `${sessionId}.lock`);
            if (fs.existsSync(cLock)) {
              hasLockFile = true;
              try {
                const lStat = fs.statSync(cLock);
                const lockAgeMs = now - lStat.mtimeMs;
                if (lockAgeMs < STALE_LOCK_TIMEOUT_MS && ageMs < STALE_LOCK_TIMEOUT_MS) {
                  isLocked = true;
                }
              } catch {
                if (ageMs < STALE_LOCK_TIMEOUT_MS) isLocked = true;
              }
              break;
            }
          }

          seen.add(sessionId);
          const meta = this._peekSessionMetadata(tPath, stat, sessionId);
          this.discoveredFiles.set(sessionId, { provider: 'antigravity', transcriptPath: tPath });

          let status = 'idle';
          if (ageMs >= STALE_LOCK_TIMEOUT_MS || (hasLockFile && !isLocked)) {
            status = 'completed';
          } else if (isLocked) {
            status = ageMs < 60000 ? 'working' : 'active';
          } else if (ageMs < 60000) {
            status = 'working';
          } else if (ageMs < 10 * 60 * 1000) {
            status = 'active';
          } else {
            status = 'idle';
          }

          sessions.push({
            sessionId,
            agent: 'antigravity',
            name: (meta.isSubagent && meta.role && meta.role !== 'Sub-Agent') ? meta.role : (meta.workspaceName || 'Antigravity Agent'),
            workspace: meta.workspace || '',
            workspaceName: meta.workspaceName || '',
            mtimeMs: stat.mtimeMs,
            sizeBytes: stat.size,
            isLocked,
            status,
            ageSeconds: Math.floor(ageMs / 1000),
            tokensUsed: meta.tokensUsed || 0,
            taskSummary: meta.taskSummary || '',
            isSubagent: meta.isSubagent || false,
            parentSessionId: meta.parentSessionId || null,
            role: meta.role || '',
            detail: meta.detail || '',
            timestamp: stat.mtimeMs,
          });
        }
      } catch (err) {
        // Safe skip unreadable directories
      }
    }

    for (const root of this.codexSessionDirs) {
      this._discoverJsonlSessions(root, 'codex', now, recentLimitMs, sessions, seen);
    }
    for (const root of this.claudeProjectDirs) {
      this._discoverJsonlSessions(root, 'claude', now, recentLimitMs, sessions, seen);
    }

    return sessions.sort((a, b) => b.mtimeMs - a.mtimeMs);
  }

  /** Discover CLI session logs as observations. Activity is inferred only from log
   * timestamps and explicit provider metadata; missing values remain empty/unknown. */
  _discoverJsonlSessions(root, provider, now, recentLimitMs, sessions, seen) {
    if (!root || !fs.existsSync(root)) return;
    const maxDepth = 10;
    const walk = (dir, depth) => {
      if (depth > maxDepth) return;
      let entries;
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full, depth + 1);
          continue;
        }
        if (!entry.isFile() || !entry.name.endsWith('.jsonl')) continue;
        if (provider === 'codex' && !entry.name.startsWith('rollout-')) continue;
        try {
          const stat = fs.statSync(full);
          const ageMs = now - stat.mtimeMs;
          if (ageMs > recentLimitMs) continue;
          const meta = this._peekJsonlMetadata(full, stat, provider);
          const rawId = meta.sessionId || path.basename(entry.name, '.jsonl').replace(/^rollout-/, '');
          if (!rawId) continue;

          const subagentParent = provider === 'claude' ? this._claudeSubagentParent(full, root) : null;
          const isSubagent = Boolean(meta.isSubagent || subagentParent || meta.parentSessionId);
          const parentSessionId = meta.parentSessionId || subagentParent || null;
          const sourceId = provider === 'claude' && subagentParent
            ? path.basename(entry.name, '.jsonl')
            : rawId;
          const sessionId = `${provider}-${sourceId}`;
          if (seen.has(sessionId)) continue;
          seen.add(sessionId);
          const isLocked = !meta.isComplete && ageMs <= 60000;
          const status = isLocked ? 'working' : 'completed';
          const workspace = meta.workspace || '';
          const workspaceName = workspace ? path.basename(workspace) : '';
          const role = meta.role || (isSubagent ? 'Sub-Agent' : '');
          const normalizedParentId = parentSessionId && !String(parentSessionId).startsWith(`${provider}-`)
            ? `${provider}-${parentSessionId}`
            : parentSessionId;
          const session = {
            sessionId,
            agent: provider,
            name: role || workspaceName || `${provider} session ${rawId.slice(0, 8)}`,
            workspace,
            workspaceName,
            mtimeMs: stat.mtimeMs,
            timestamp: stat.mtimeMs,
            sizeBytes: stat.size,
            isLocked,
            status,
            ageSeconds: Math.floor(ageMs / 1000),
            tokensUsed: meta.tokensUsed,
            taskSummary: meta.taskSummary,
            detail: meta.detail,
            isSubagent,
            parentSessionId: normalizedParentId,
            role,
          };
          this.discoveredFiles.set(sessionId, { provider, transcriptPath: full, rawId: sourceId });
          sessions.push(session);
        } catch {
          // Logs may be rotated or actively written while discovery runs.
        }
      }
    };
    walk(root, 0);
  }

  _claudeSubagentParent(filePath, root) {
    const relativeParts = path.relative(root, filePath).split(path.sep);
    const subagentsIndex = relativeParts.lastIndexOf('subagents');
    if (subagentsIndex < 1) return null;
    return `claude-${relativeParts[subagentsIndex - 1]}`;
  }

  _peekJsonlMetadata(filePath, stat, provider) {
    const cached = this.jsonlMetadataCache.get(filePath);
    if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) return cached.data;
    const maxBytes = 256 * 1024;
    if (!stat.size) return {};
    let fd;
    try {
      fd = fs.openSync(filePath, 'r');
      const headSize = Math.min(stat.size, Math.floor(maxBytes / 2));
      const tailSize = Math.min(Math.max(0, stat.size - headSize), Math.floor(maxBytes / 2));
      const head = Buffer.alloc(headSize);
      fs.readSync(fd, head, 0, headSize, 0);
      const tail = Buffer.alloc(tailSize);
      if (tailSize) fs.readSync(fd, tail, 0, tailSize, stat.size - tailSize);
      const lines = `${head.toString('utf8')}\n${tail.toString('utf8')}`.split('\n').filter(Boolean);
      const records = [];
      for (const line of lines) {
        try { records.push(JSON.parse(line)); } catch {}
      }
      let sessionId = '';
      let workspace = '';
      let taskSummary = '';
      let detail = '';
      let role = '';
      let parentSessionId = null;
      let isSubagent = false;
      let tokensUsed;
      let isComplete = false;

      for (const item of records) {
        const payload = item.payload || item.data || {};
        const message = item.message || payload.message || {};
        const content = message.content || payload.content || item.content;
        if (provider === 'codex') {
          if (item.type === 'session_meta') {
            sessionId = payload.id || sessionId;
            workspace = payload.cwd || workspace;
            parentSessionId = payload.parent_session_id || payload.parentSessionId || parentSessionId;
            isSubagent = Boolean(payload.is_subagent || payload.isSubagent || parentSessionId);
            role = payload.role || payload.agent_role || role;
          }
          workspace = workspace || payload.cwd || '';
          if (payload.parent_session_id || payload.parentSessionId) {
            parentSessionId = payload.parent_session_id || payload.parentSessionId;
            isSubagent = true;
          }
          if (item.type === 'token_count') {
            const usage = payload.info?.total_token_usage || payload.usage || {};
            if (Number.isFinite(usage.total_tokens)) tokensUsed = usage.total_tokens;
          }
          if (item.type === 'response_item') {
            const body = Array.isArray(content) ? content.map((part) => part.text || '').join('\n') : String(content || '');
            if (payload.role === 'user' || message.role === 'user') {
              isComplete = false;
              if (!taskSummary) taskSummary = body.trim().slice(0, 160);
            }
            const calls = payload.name || payload.tool_name || message.name;
            if (calls) detail = String(calls);
            if (body && (payload.role === 'assistant' || message.role === 'assistant')) detail = body.trim().split('\n')[0].slice(0, 160) || detail;
          }
          if (item.type === 'event_msg') {
            const eventType = payload.type || '';
            if (/tool|command|spawn_agent/i.test(eventType)) detail = eventType;
            if (/turn_complete|task_complete|turn_aborted/i.test(eventType)) isComplete = true;
            if (/turn_started|task_started/i.test(eventType)) isComplete = false;
          }
        } else {
          sessionId = item.sessionId || item.session_id || sessionId;
          workspace = item.cwd || workspace;
          parentSessionId = item.parentSessionId || item.parent_session_id || parentSessionId;
          isSubagent = Boolean(item.isSidechain || item.isSubagent || item.agentId || parentSessionId);
          role = item.agentName || item.role || role;
          if (message.usage) {
            const input = Number(message.usage.input_tokens || 0);
            const output = Number(message.usage.output_tokens || 0);
            const cache = Number(message.usage.cache_read_input_tokens || 0);
            tokensUsed = (tokensUsed || 0) + input + output + cache;
          }
          if (message.stop_reason === 'end_turn') isComplete = true;
          else if (message.stop_reason === 'tool_use') isComplete = false;
          const body = Array.isArray(content)
            ? content.map((part) => part.text || part.name || '').join('\n')
            : String(content || '');
          if (item.type === 'user') {
            isComplete = false;
            if (!taskSummary) taskSummary = body.trim().slice(0, 160);
          }
          if (item.type === 'assistant') {
            const tool = Array.isArray(content) ? content.find((part) => part.type === 'tool_use') : null;
            if (tool) detail = tool.name || 'Tool action';
            else if (body.trim()) detail = body.trim().split('\n')[0].slice(0, 160);
          }
        }
      }
      const data = { sessionId, workspace, taskSummary, detail, role, parentSessionId, isSubagent, tokensUsed, isComplete };
      this.jsonlMetadataCache.set(filePath, { mtimeMs: stat.mtimeMs, size: stat.size, data });
      return data;
    } catch {
      return {};
    } finally {
      if (fd !== undefined) {
        try { fs.closeSync(fd); } catch {}
      }
    }
  }

  /**
   * Parses real sub-agent roles from envelope content or swarm briefs.
   */
  _parseRoleFromText(text) {
    if (!text || typeof text !== 'string') return '';
    const cleaned = cleanAnsi(text);

    // 0a. Header inside <Identity> block, e.g. # SWE Light Implementer
    const identityHeaderMatch = cleaned.match(/<Identity>[\s\S]*?#+\s*([A-Za-z0-9_\- ]{3,40})/i);
    if (identityHeaderMatch && identityHeaderMatch[1]) {
      return identityHeaderMatch[1].trim();
    }

    // 0b. Explicit roles tag, e.g. "roles: reviewer, qa" or "Role: Security Auditor"
    const rolesMatch = cleaned.match(/(?:roles?|Identity|Role)\s*:\s*([A-Za-z0-9_\-, ]{3,40})/i);
    if (rolesMatch && rolesMatch[1]) {
      return rolesMatch[1].trim();
    }

    // 1. "You are <name>, the <role>"
    // E.g. content matching 'You are ([a-zA-Z0-9_\- ]+), the ([a-zA-Z0-9_\- ]+)'
    const youAreTheMatch = cleaned.match(/(?:You are|you are)\s+[a-zA-Z0-9_\- ]+,\s+(?:the|an?)\s+([a-zA-Z0-9_\- ]+)/i);
    if (youAreTheMatch && youAreTheMatch[1]) {
      const candidate = youAreTheMatch[1].split(/[.\n\r,]/)[0].trim();
      if (candidate) return candidate;
    }

    const youAreMatch2 = cleaned.match(/You are ([a-zA-Z0-9_\- ]+), the ([a-zA-Z0-9_\- ]+)/i);
    if (youAreMatch2 && youAreMatch2[2]) {
      const candidate = youAreMatch2[2].split(/[.\n\r,]/)[0].trim();
      if (candidate) return candidate;
    }

    // 2. "Role:\s*([^\n\r]+)" or "YOUR ROLE:\s*([^\n\r]+)"
    const roleMatch = cleaned.match(/(?:YOUR\s+ROLE|Your\s+role|ROLE|Role)[:\s]+[*_]*([^\n\r*]+)/i);
    if (roleMatch && roleMatch[1]) {
      const candidate = roleMatch[1].replace(/[*_.]+$|^[*_.\s]+/, '').trim();
      if (candidate) return candidate;
    }

    // 3. Parenthetical role: "You are Reviewer 1 (Primary Full-Suite Reviewer)"
    const parenRoleMatch = cleaned.match(/(?:You are|you are)\s+[a-zA-Z0-9_\- ]+\s*\(([^)\n\r]+)\)/i);
    if (parenRoleMatch && parenRoleMatch[1]) {
      const candidate = parenRoleMatch[1].replace(/[*_.]+$|^[*_.\s]+/, '').trim();
      if (candidate) return candidate;
    }

    // 4. "You are <name>, one agent in a swarm"
    const swarmWorkerMatch = cleaned.match(/(?:You are|you are)\s+([a-zA-Z0-9_\- ]+),\s+one agent in a swarm/i);
    if (swarmWorkerMatch && swarmWorkerMatch[1]) {
      return swarmWorkerMatch[1].trim();
    }

    // 5. Swarm board mention: "recorded on the board as #2 for @backend-remote"
    const swarmBoardMatch = cleaned.match(/(?:recorded on the board as #\d+ for @([a-zA-Z0-9_\-]+))/i);
    if (swarmBoardMatch && swarmBoardMatch[1]) {
      return swarmBoardMatch[1].trim();
    }

    // 6. Swarm roster mentions: "@backend-remote You own packages/..."
    const swarmBriefMatch = cleaned.match(/@([a-zA-Z0-9_\-]+)\s+(?:You own|You are|Your job|Check|Verify|Please)/i);
    if (swarmBriefMatch && swarmBriefMatch[1]) {
      return swarmBriefMatch[1].trim();
    }

    return '';
  }

  /**
   * Scans parent transcript for invoke_subagent or swarm tool calls targeting this subagent.
   */
  _extractRoleFromParent(parentSessionId, childSessionId) {
    if (!parentSessionId || !this.isValidSessionId(parentSessionId)) return '';
    try {
      const parentPaths = this.resolveSessionPaths(parentSessionId);
      if (!parentPaths || !fs.existsSync(parentPaths.transcriptPath)) return '';

      const stat = fs.statSync(parentPaths.transcriptPath);
      const readSize = Math.min(stat.size, 131072); // Read last 128KB of parent transcript
      const buffer = Buffer.alloc(readSize);
      const fd = fs.openSync(parentPaths.transcriptPath, 'r');
      fs.readSync(fd, buffer, 0, readSize, Math.max(0, stat.size - readSize));
      fs.closeSync(fd);

      const text = buffer.toString('utf8');
      const lines = text.trim().split('\n');

      let fallbackRole = '';
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (!line) continue;
        try {
          const item = JSON.parse(line);
          const toolCalls = item.tool_calls;
          if (Array.isArray(toolCalls)) {
            for (const tc of toolCalls) {
              const name = tc.name || '';
              const args = tc.args || {};
              if (name === 'invoke_subagent') {
                const r = args.Role || args.role || args.TypeName || args.typeName || args.subagent_type || args.description || args.name;
                const matchesChild = childSessionId && (line.includes(childSessionId) || (lines[i + 1] && lines[i + 1].includes(childSessionId)));
                if (matchesChild && r) {
                  return cleanAnsi(String(r)).trim();
                }
                if (r && !fallbackRole) {
                  fallbackRole = cleanAnsi(String(r)).trim();
                }
              } else if (name === 'swarm') {
                const subName = args.name || '';
                const brief = args.brief || '';
                const roleFromBrief = this._parseRoleFromText(brief);
                const roleFound = roleFromBrief || (subName ? cleanAnsi(String(subName)).trim() : '');
                const matchesChild = childSessionId && (line.includes(childSessionId) || (lines[i + 1] && lines[i + 1].includes(childSessionId)));
                if (matchesChild && roleFound) {
                  return roleFound;
                }
                if (roleFound && !fallbackRole) {
                  fallbackRole = roleFound;
                }
              }
            }
          }
        } catch {}
      }
      return fallbackRole;
    } catch {
      return '';
    }
  }

  /**
   * Fast metadata peek without reading the entire transcript file.
   */
  _peekSessionMetadata(tPath, stat, sessionId) {
    let workspace = '';
    let taskSummary = '';
    let tokensUsed = 0;
    let isSubagent = false;
    let parentSessionId = null;
    let role = '';
    let subagentPrompt = '';

    const currentSessionId = sessionId || path.basename(path.dirname(path.dirname(path.dirname(tPath))));

    // 0. Check .system_generated/messages for instant, accurate subagent & parent dispatch detection
    const sessionDir = path.dirname(path.dirname(path.dirname(tPath)));
    const messagesDir = path.join(sessionDir, '.system_generated', 'messages');
    if (fs.existsSync(messagesDir)) {
      try {
        const msgFiles = fs.readdirSync(messagesDir);
        for (const mf of msgFiles) {
          if (!mf.endsWith('.json')) continue;
          try {
            const rawMsg = fs.readFileSync(path.join(messagesDir, mf), 'utf8');
            const msgObj = JSON.parse(rawMsg);
            if (msgObj.sender && msgObj.sender !== currentSessionId) {
              isSubagent = true;
              parentSessionId = msgObj.sender;
            }
            const tc = msgObj.sourceMetadata?.tool?.toolCall;
            if (tc) {
              isSubagent = true;
              if (msgObj.sourceMetadata?.tool?.conversationId) {
                parentSessionId = msgObj.sourceMetadata.tool.conversationId;
              }
              let args = tc.argumentsJson;
              if (typeof args === 'string') {
                try { args = JSON.parse(args); } catch {}
              }
              if (args) {
                if (tc.name === 'invoke_subagent') {
                  const r = args.Role || args.TypeName || args.role || args.typeName;
                  if (r) role = cleanAnsi(String(r)).trim();
                  if (args.Prompt && !subagentPrompt) subagentPrompt = extractDispatchEnvelopePrompt(args.Prompt);
                } else if (tc.name === 'swarm') {
                  const r = this._parseRoleFromText(args.brief) || args.name;
                  if (r) role = cleanAnsi(String(r)).trim();
                  if (args.brief && !subagentPrompt) subagentPrompt = extractDispatchEnvelopePrompt(args.brief);
                }
              }
            }
            if (msgObj.content) {
              const r = this._parseRoleFromText(msgObj.content);
              if (r && !role) role = r;
              if (!subagentPrompt) subagentPrompt = extractDispatchEnvelopePrompt(msgObj.content);
            }
            if (isSubagent && role && parentSessionId) break;
          } catch {}
        }
      } catch {}
    }

    let fd;
    try {
      const readSize = Math.min(stat.size, 131072);
      if (readSize > 0) {
        fd = fs.openSync(tPath, 'r');
        const buffer = Buffer.alloc(readSize);
        fs.readSync(fd, buffer, 0, readSize, 0);

        const text = buffer.toString('utf8');
        const wsMatch = text.match(/Active Workspaces:\s*\n\s*-\s*([^\n\r]+)/i) ||
                        text.match(/Command Working Directory:\s*([^\n\r]+)/i);
        if (wsMatch && wsMatch[1]) {
          workspace = wsMatch[1].trim();
        }

        // Subagent detection:
        // Main agent starts with source: 'USER_EXPLICIT' or a user prompt <USER_REQUEST>.
        // Subagent starts with source: 'SYSTEM' or content containing sender= or <SYSTEM_MESSAGE> not actually sent by the user.
        const headLines = text.trim().split('\n');
        for (let i = 0; i < Math.min(headLines.length, 25); i++) {
          if (!headLines[i].trim()) continue;
          try {
            const item = JSON.parse(headLines[i]);
            const src = item.source ? String(item.source) : '';
            const content = item.content ? String(item.content) : '';

            if (i === 0 || !isSubagent) {
              if (
                src.startsWith('SYSTEM') ||
                content.includes('sender=') ||
                content.includes('Message from') ||
                content.includes('not actually sent by the user') ||
                content.includes('[Message]')
              ) {
                isSubagent = true;
              } else if (
                !parentSessionId &&
                (src === 'USER_EXPLICIT' ||
                content.includes('<USER_REQUEST>'))
              ) {
                isSubagent = false;
              }
            }

            if (!parentSessionId) {
              if (item.parent_session_id || item.parentSessionId) {
                parentSessionId = item.parent_session_id || item.parentSessionId;
                isSubagent = true;
              } else if (content.includes('sender=')) {
                const sMatch = content.match(/sender=([a-zA-Z0-9_-]{8,})/i) ||
                              content.match(/parent[_-]?session[_-]?id[:=]\s*["']?([a-zA-Z0-9_-]{8,})/i);
                if (sMatch && sMatch[1]) {
                  parentSessionId = sMatch[1];
                  isSubagent = true;
                }
              }
            }

            if (!role) {
              if (item.role) {
                role = cleanAnsi(String(item.role)).trim();
              } else if (content) {
                role = this._parseRoleFromText(content);
              }
            }

            if (isSubagent && !subagentPrompt && content) {
              subagentPrompt = extractDispatchEnvelopePrompt(content);
            }
          } catch {}
        }

        // Dynamic Sub-Agent Role Extraction:
        // If subagent role was not in child transcript envelope, parse from parent invoke_subagent / swarm calls
        if (isSubagent && !role && parentSessionId) {
          role = this._extractRoleFromParent(parentSessionId, currentSessionId);
        }

        const tailBuf = Buffer.alloc(readSize);
        fs.readSync(fd, tailBuf, 0, readSize, Math.max(0, stat.size - readSize));

        const tailLines = tailBuf.toString('utf8').trim().split('\n');
        for (let i = tailLines.length - 1; i >= 0; i--) {
          try {
            const item = JSON.parse(tailLines[i]);
            if (!taskSummary && item.type === 'USER_INPUT') {
              taskSummary = extractCleanUserInput(item.content);
            }
            if (item.input_tokens || item.output_tokens) {
              tokensUsed += (item.input_tokens || 0) + (item.output_tokens || 0);
            }
          } catch {}
        }

        // Subagents without explicit USER_INPUT can use their dispatch prompt as taskSummary
        if (!taskSummary && isSubagent && subagentPrompt) {
          taskSummary = subagentPrompt.slice(0, 120).trim();
        }
      }
    } catch {} finally {
      if (fd !== undefined) {
        try { fs.closeSync(fd); } catch {}
      }
    }

    const workspaceName = workspace ? path.basename(workspace) : 'soko';
    return {
      workspace,
      workspaceName,
      taskSummary,
      tokensUsed,
      isSubagent,
      parentSessionId,
      role: role || (isSubagent ? 'Sub-Agent' : ''),
    };
  }

  /**
   * Helper to accumulate thinking, tool_calls, and responses into a conversational turn.
   */
  _accumulateTurnItem(currentTurn, item, type) {
    if (item.thinking) {
      const cleanThinking = cleanAnsi(item.thinking).trim();
      if (cleanThinking) {
        currentTurn.thinking.push(cleanThinking);
      }
    }

    if (item.tool_calls && Array.isArray(item.tool_calls)) {
      for (const tc of item.tool_calls) {
        const formatted = formatToolCall(tc);
        currentTurn.toolCalls.push(formatted);
      }
    }

    // In Antigravity transcripts, tool outputs (command stdout, read_file dumps, search redirects)
    // are recorded with type 'GENERIC' (and source 'MODEL').
    // These are NOT agent conversational responses and must not clutter the mobile screen.
    // Only actual PLANNER_RESPONSE / MODEL assistant messages to the user should be treated as responses.
    if (
      item.content &&
      (type === 'PLANNER_RESPONSE' || type === 'MODEL') &&
      type !== 'GENERIC' &&
      item.type !== 'GENERIC'
    ) {
      const cleanText = cleanAnsi(item.content).trim();
      if (
        cleanText &&
        !cleanText.startsWith('<') &&
        !cleanText.includes('vertexaisearch.cloud.google.com') &&
        !cleanText.includes('grounding-api-redirect') &&
        !cleanText.startsWith('Created At:') &&
        !currentTurn.responses.includes(cleanText)
      ) {
        currentTurn.responses.push(cleanText);
      }
    }
  }

  /**
   * Parses the transcript file and returns structured conversational turns.
   */
  getTranscriptHistory(sessionId, options = {}) {
    const maxTurns = options.maxTurns || 30;
    const paths = this.resolveSessionPaths(sessionId);
    if (!paths) {
      return { success: false, error: `Session '${sessionId}' not found or invalid.` };
    }

    try {
      const stat = fs.statSync(paths.transcriptPath);
      // Read up to last 1MB of file for performance
      const readSize = Math.min(stat.size, 1024 * 1024);
      const buffer = Buffer.alloc(readSize);
      const fd = fs.openSync(paths.transcriptPath, 'r');
      fs.readSync(fd, buffer, 0, readSize, Math.max(0, stat.size - readSize));
      fs.closeSync(fd);

      const raw = buffer.toString('utf8');
      const lines = raw.trim().split('\n');

      if (paths.provider === 'codex' || paths.provider === 'claude') {
        const turns = [];
        let current = null;
        const pushTurn = () => {
          if (!current) return;
          current.status = 'completed';
          turns.push(current);
          current = null;
        };
        const textOf = (content) => Array.isArray(content)
          ? content.map((part) => part.text || '').filter(Boolean).join('\n')
          : (typeof content === 'string' ? content : '');
        const addUserTurn = (content, timestamp) => {
          pushTurn();
          current = {
            id: `turn-${turns.length + 1}`,
            stepIndex: turns.length,
            timestamp: timestamp ? new Date(timestamp).getTime() : Date.now(),
            userInput: extractCleanUserInput(textOf(content)),
            thinking: [],
            toolCalls: [],
            responses: [],
            status: 'running',
          };
        };

        for (const line of lines) {
          let item;
          try { item = JSON.parse(line); } catch { continue; }
          const payload = item.payload || {};
          const message = item.message || payload.message || {};
          const content = message.content || payload.content || item.content;
          const role = message.role || payload.role || item.role;
          const type = item.type || '';

          if (paths.provider === 'codex') {
            if (type === 'response_item' && role === 'user') {
              addUserTurn(content, item.timestamp || payload.timestamp);
            } else if (type === 'response_item' && role === 'assistant') {
              if (!current) addUserTurn('', item.timestamp || payload.timestamp);
              const parts = Array.isArray(content) ? content : [];
              for (const part of parts) {
                if (part.type === 'tool_call' || part.type === 'function_call') {
                  const name = part.name || part.function?.name || 'tool';
                  current.toolCalls.push(formatToolCall({ name, args: part.arguments || part.function?.arguments || {} }));
                } else if (part.type === 'output_text' || part.type === 'text') {
                  const response = String(part.text || '').trim();
                  if (response) current.responses.push(response);
                }
              }
            } else if (type === 'response_item' && payload.type === 'function_call') {
              if (!current) addUserTurn('', item.timestamp || payload.timestamp);
              let args = payload.arguments || {};
              if (typeof args === 'string') {
                try { args = JSON.parse(args); } catch { args = { raw: args }; }
              }
              current.toolCalls.push(formatToolCall({ name: payload.name, args }));
            } else if (type === 'event_msg' && /turn_complete|task_complete/i.test(payload.type || '')) {
              pushTurn();
            }
          } else {
            if (type === 'user' && !item.isMeta) {
              addUserTurn(content, item.timestamp);
            } else if (type === 'assistant') {
              if (!current) addUserTurn('', item.timestamp);
              const parts = Array.isArray(content) ? content : [];
              for (const part of parts) {
                if (part.type === 'thinking' && part.thinking) current.thinking.push(String(part.thinking));
                else if (part.type === 'tool_use') {
                  current.toolCalls.push(formatToolCall({ name: part.name, args: part.input || {} }));
                } else if (part.type === 'text' && part.text) current.responses.push(String(part.text));
              }
            }
          }
        }
        if (current) {
          const stat = fs.statSync(paths.transcriptPath);
          current.status = Date.now() - stat.mtimeMs <= 15000 ? 'running' : 'completed';
          turns.push(current);
        }
        const stat = fs.statSync(paths.transcriptPath);
        return {
          success: true,
          sessionId,
          totalTurns: turns.length,
          isWorking: Date.now() - stat.mtimeMs <= 15000,
          isWaiting: false,
          turns: turns.slice(-30),
        };
      }

      const meta = this._peekSessionMetadata(paths.transcriptPath, stat, sessionId);

      const turns = [];
      let currentTurn = null;
      let isWaiting = false;
      let isWorking = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        let item;
        try {
          item = JSON.parse(line);
        } catch {
          continue;
        }

        const type = item.type || '';

        // 1. Explicit USER_INPUT
        if (type === 'USER_INPUT') {
          if (currentTurn) turns.push(currentTurn);
          currentTurn = {
            id: `turn-${item.step_index !== undefined ? item.step_index : turns.length + 1}`,
            stepIndex: item.step_index || 0,
            timestamp: item.created_at ? new Date(item.created_at).getTime() : Date.now(),
            userInput: extractCleanUserInput(item.content || ''),
            thinking: [],
            toolCalls: [],
            responses: [],
            status: 'completed',
          };
        }
        // 2. Sub-agent dispatch envelope (turn 0 or subsequent turn envelope)
        else if (isSubagentDispatchEnvelope(item)) {
          if (currentTurn) turns.push(currentTurn);
          const prompt = extractDispatchEnvelopePrompt(item.content);
          currentTurn = {
            id: `turn-${item.step_index !== undefined ? item.step_index : turns.length + 1}`,
            stepIndex: item.step_index || 0,
            timestamp: item.created_at ? new Date(item.created_at).getTime() : Date.now(),
            userInput: prompt || 'Subagent Task',
            thinking: [],
            toolCalls: [],
            responses: [],
            status: 'completed',
          };
        }
        // 3. Sub-agent starting directly with PLANNER_RESPONSE (no USER_INPUT or SYSTEM_MESSAGE)
        else if (!currentTurn && turns.length === 0 && (type === 'PLANNER_RESPONSE' || type === 'MODEL')) {
          currentTurn = {
            id: `turn-${item.step_index !== undefined ? item.step_index : 0}`,
            stepIndex: item.step_index || 0,
            timestamp: item.created_at ? new Date(item.created_at).getTime() : Date.now(),
            userInput: meta.taskSummary || 'Subagent Task',
            thinking: [],
            toolCalls: [],
            responses: [],
            status: 'completed',
          };
          this._accumulateTurnItem(currentTurn, item, type);
          if (item.status === 'RUNNING') {
            isWorking = true;
          }
        }
        // 4. Accumulate into current active turn
        else if (currentTurn) {
          this._accumulateTurnItem(currentTurn, item, type);
          if (item.status === 'RUNNING') {
            isWorking = true;
          }
        }
      }

      if (currentTurn) {
        turns.push(currentTurn);
      }

      const STALE_LOCK_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes
      const now = Date.now();
      const ageMs = now - stat.mtimeMs;

      let hasLockFile = Boolean(paths.lockPath);
      let isLocked = false;
      if (paths.lockPath) {
        try {
          const lStat = fs.statSync(paths.lockPath);
          const lockAgeMs = now - lStat.mtimeMs;
          if (lockAgeMs < STALE_LOCK_TIMEOUT_MS && ageMs < STALE_LOCK_TIMEOUT_MS) {
            isLocked = true;
          }
        } catch {
          if (ageMs < STALE_LOCK_TIMEOUT_MS) {
            isLocked = true;
          }
        }
      }

      // Check state of the very last item in transcript
      const lastLine = lines[lines.length - 1];
      if (lastLine) {
        try {
          const lastObj = JSON.parse(lastLine);
          if ((lastObj.type === 'PLANNER_RESPONSE' || lastObj.type === 'MODEL' || lastObj.type === 'ASSISTANT') && (!lastObj.tool_calls || lastObj.tool_calls.length === 0)) {
            isWaiting = false;
            isWorking = false;
          } else if (lastObj.status === 'RUNNING' || (lastObj.tool_calls && lastObj.tool_calls.length > 0)) {
            isWorking = true;
            isWaiting = false;
          }
        } catch {}
      }

      // Accurate running status: check isLocked and verify timestamp (< 20m)
      // so dead sessions with stale locks are marked idle/completed, not working
      if (ageMs >= STALE_LOCK_TIMEOUT_MS || (hasLockFile && !isLocked)) {
        isWorking = false;
        isWaiting = false;
      }

      const slicedTurns = turns.slice(-maxTurns);
      return {
        success: true,
        sessionId,
        cursor: stat.size,
        mtimeMs: stat.mtimeMs,
        isLocked,
        isWaiting,
        isWorking,
        isSubagent: meta.isSubagent || false,
        parentSessionId: meta.parentSessionId || null,
        role: meta.role || '',
        turns: slicedTurns,
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Reads newly appended lines since the last cursor byte offset.
   * Handles concurrent mid-write flushes safely: only advances cursor
   * up to the last complete newline (\n) so partial JSON lines are never corrupted.
   */
  readDelta(sessionId, lastByteOffset = 0) {
    const paths = this.resolveSessionPaths(sessionId);
    if (!paths) return null;

    try {
      const stat = fs.statSync(paths.transcriptPath);
      // If file was truncated or recreated
      const safeOffset = (lastByteOffset > stat.size) ? 0 : lastByteOffset;

      if (stat.size <= safeOffset) {
        return {
          sessionId,
          newCursor: stat.size,
          mtimeMs: stat.mtimeMs,
          events: [],
        };
      }

      const bytesToRead = stat.size - safeOffset;
      const buffer = Buffer.alloc(bytesToRead);
      const fd = fs.openSync(paths.transcriptPath, 'r');
      fs.readSync(fd, buffer, 0, bytesToRead, safeOffset);
      fs.closeSync(fd);

      // Find the last complete newline byte (0x0A) in the buffer.
      // If the buffer does not end with a newline, the trailing slice is an incomplete
      // JSON line currently being flushed by the writer. We must NOT consume it yet.
      const lastNewlineIdx = buffer.lastIndexOf(0x0A);
      if (lastNewlineIdx === -1) {
        // No complete newline in this read window. Do not advance cursor; wait for completion.
        return {
          sessionId,
          newCursor: safeOffset,
          mtimeMs: stat.mtimeMs,
          events: [],
        };
      }

      const bytesConsumed = lastNewlineIdx + 1;
      const raw = buffer.subarray(0, bytesConsumed).toString('utf8');
      const lines = raw.split('\n');
      const events = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed);
          // Omit noisy raw tool execution dumps (e.g. 50KB-1MB file reads, raw shell stdout, search redirects)
          if (parsed.type === 'GENERIC') {
            continue;
          }
          events.push(parsed);
        } catch {
          // Skip unparseable lines safely
        }
      }

      return {
        sessionId,
        newCursor: safeOffset + bytesConsumed,
        mtimeMs: stat.mtimeMs,
        events,
      };
    } catch {
      return null;
    }
  }

  /**
   * Dispatches a user prompt to the active session.
   */
  async dispatchPrompt(sessionId, prompt, options = {}) {
    if (!this.isValidSessionId(sessionId)) {
      throw new Error(`Invalid session ID '${sessionId}'.`);
    }
    const cleanPrompt = String(prompt || '').trim();
    if (!cleanPrompt) {
      throw new Error('Prompt cannot be empty.');
    }

    const paths = this.resolveSessionPaths(sessionId);
    if (!paths) {
      throw new Error(`Cannot dispatch prompt: Session '${sessionId}' not found.`);
    }

    // Edge Case: If another command execution for this session is active, queue it
    if (this.activeChildProcesses.has(sessionId)) {
      return {
        success: true,
        status: 'queued',
        sessionId,
        message: 'Agent is busy. Prompt queued for execution when active turn concludes.',
        timestamp: Date.now(),
      };
    }

    // Method A: CLI dispatch via `agy --conversation <sessionId> -p "<prompt>"`
    return new Promise((resolve, reject) => {
      // Validate mode and effort against strict allowlists to prevent CLI flag injection
      const ALLOWED_MODES = new Set(['auto', 'interactive', 'plan', 'code']);
      const ALLOWED_EFFORTS = new Set(['low', 'medium', 'high', 'max']);
      const mode = ALLOWED_MODES.has(options.mode) ? options.mode : 'auto';
      const effort = ALLOWED_EFFORTS.has(options.effort) ? options.effort : 'medium';

      const child = spawn(
        'agy',
        [
          '--conversation',
          sessionId,
          '--mode',
          mode,
          '--effort',
          effort,
          '--dangerously-skip-permissions',
          '-p',
          cleanPrompt,
        ],
        {
          env: { ...process.env, TERM: 'dumb', CI: 'true' },
        }
      );

      this.activeChildProcesses.set(sessionId, child);

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (d) => (stdout += d.toString()));
      child.stderr.on('data', (d) => (stderr += d.toString()));

      const timer = setTimeout(() => {
        // Detach process for asynchronous background execution without terminating
        child.unref();
        this.activeChildProcesses.delete(sessionId);
        resolve({
          success: true,
          status: 'dispatched_background',
          sessionId,
          message: 'Prompt dispatched to agent session (running in background).',
        });
      }, 5000); // Wait up to 5s before backgrounding

      child.on('error', (err) => {
        clearTimeout(timer);
        this.activeChildProcesses.delete(sessionId);
        // If agy is not in system path, fall back to mock queue mode
        if (err.code === 'ENOENT') {
          resolve({
            success: true,
            status: 'queued_file',
            sessionId,
            message: 'agy binary not found in PATH; message queued in session inbox.',
          });
        } else {
          reject(err);
        }
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        this.activeChildProcesses.delete(sessionId);
        resolve({
          success: code === 0,
          status: 'completed',
          exitCode: code,
          sessionId,
          stdout: stdout.trim(),
        });
      });
    });
  }
}

module.exports = {
  AgentSessionManager,
  cleanAnsi,
  formatToolCall,
  sanitizeToolOutput,
  extractCleanUserInput,
  isSubagentDispatchEnvelope,
  extractDispatchEnvelopePrompt,
};
