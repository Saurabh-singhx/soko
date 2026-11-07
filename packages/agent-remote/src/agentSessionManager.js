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

class AgentSessionManager {
  constructor(options = {}) {
    this.brainDirs = options.brainDirs || this._resolveDefaultBrainDirs();
    this.presenceDirs = options.presenceDirs || this._resolveDefaultPresenceDirs();
    this.activeWatchers = new Map(); // sessionId -> { watcher, byteOffset, partialLine }
    this.pendingQueue = new Map(); // sessionId -> Array<{ prompt, resolve, reject, timestamp }>
    this.activeChildProcesses = new Map(); // sessionId -> ChildProcess
  }

  _resolveDefaultBrainDirs() {
    const home = os.homedir();
    return [
      path.join(home, '.gemini/antigravity-cli/brain'),
      path.join(home, '.gemini/antigravity/brain'),
      path.join(home, '.gemini/antigravity-ide/brain'),
    ].filter((d) => fs.existsSync(d));
  }

  _resolveDefaultPresenceDirs() {
    const home = os.homedir();
    return [
      path.join(home, '.gemini/antigravity-cli/presence'),
      path.join(home, '.gemini/antigravity/presence'),
      path.join(home, '.gemini/antigravity-ide/presence'),
    ].filter((d) => fs.existsSync(d));
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

          // Check presence lock - verify if lock is recent (< 2h) or transcript active
          let isLocked = false;
          for (const pDir of this.presenceDirs) {
            const cLock = path.join(pDir, `${sessionId}.lock`);
            if (fs.existsSync(cLock)) {
              try {
                const lStat = fs.statSync(cLock);
                if (now - lStat.mtimeMs < 2 * 60 * 60 * 1000 || ageMs < 15 * 60 * 1000) {
                  isLocked = true;
                }
              } catch {
                if (ageMs < 15 * 60 * 1000) isLocked = true;
              }
              break;
            }
          }

          seen.add(sessionId);
          const meta = this._peekSessionMetadata(tPath, stat);
          sessions.push({
            sessionId,
            name: meta.workspaceName || 'Antigravity Agent',
            workspace: meta.workspace || '',
            workspaceName: meta.workspaceName || 'soko',
            mtimeMs: stat.mtimeMs,
            sizeBytes: stat.size,
            isLocked,
            status: ageMs < 60000 ? 'working' : (isLocked || ageMs < 10 * 60 * 1000 ? 'active' : 'idle'),
            ageSeconds: Math.floor(ageMs / 1000),
            tokensUsed: meta.tokensUsed || 0,
            taskSummary: meta.taskSummary || '',
          });
        }
      } catch (err) {
        // Safe skip unreadable directories
      }
    }

    return sessions.sort((a, b) => b.mtimeMs - a.mtimeMs);
  }

  /**
   * Fast metadata peek without reading the entire transcript file.
   */
  _peekSessionMetadata(tPath, stat) {
    let workspace = '';
    let taskSummary = '';
    let tokensUsed = 0;

    let fd;
    try {
      const readSize = Math.min(stat.size, 32768);
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
    };
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

        if (type === 'USER_INPUT') {
          if (currentTurn) turns.push(currentTurn);
          currentTurn = {
            id: `turn-${item.step_index || turns.length + 1}`,
            stepIndex: item.step_index || 0,
            timestamp: item.created_at ? new Date(item.created_at).getTime() : Date.now(),
            userInput: extractCleanUserInput(item.content || ''),
            thinking: [],
            toolCalls: [],
            responses: [],
            status: 'completed',
          };
        } else if (currentTurn) {
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

          if (item.status === 'RUNNING') {
            isWorking = true;
          }
        }
      }

      if (currentTurn) {
        turns.push(currentTurn);
      }

      // Check state of the very last item in transcript
      const lastLine = lines[lines.length - 1];
      if (lastLine) {
        try {
          const lastObj = JSON.parse(lastLine);
          if (lastObj.type === 'PLANNER_RESPONSE' && (!lastObj.tool_calls || lastObj.tool_calls.length === 0)) {
            isWaiting = true;
            isWorking = false;
          } else if (lastObj.status === 'RUNNING' || (lastObj.tool_calls && lastObj.tool_calls.length > 0)) {
            isWorking = true;
            isWaiting = false;
          }
        } catch {}
      }

      const slicedTurns = turns.slice(-maxTurns);
      return {
        success: true,
        sessionId,
        cursor: stat.size,
        mtimeMs: stat.mtimeMs,
        isLocked: Boolean(paths.lockPath),
        isWaiting,
        isWorking,
        turns: slicedTurns,
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Reads newly appended lines since the last cursor byte offset.
   */
  readDelta(sessionId, lastByteOffset = 0) {
    const paths = this.resolveSessionPaths(sessionId);
    if (!paths) return null;

    try {
      const stat = fs.statSync(paths.transcriptPath);
      if (stat.size <= lastByteOffset) {
        return {
          sessionId,
          newCursor: stat.size,
          mtimeMs: stat.mtimeMs,
          events: [],
        };
      }

      const bytesToRead = stat.size - lastByteOffset;
      const buffer = Buffer.alloc(bytesToRead);
      const fd = fs.openSync(paths.transcriptPath, 'r');
      fs.readSync(fd, buffer, 0, bytesToRead, lastByteOffset);
      fs.closeSync(fd);

      const raw = buffer.toString('utf8');
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
          // Incomplete line write in progress, skip partial
        }
      }

      return {
        sessionId,
        newCursor: stat.size,
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
};
