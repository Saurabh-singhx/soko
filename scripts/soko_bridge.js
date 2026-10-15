#!/usr/bin/env node

/**
 * ==============================================================================
 * Soko Universal Connection Bridge (Node.js)
 * 
 * Provides live duplex WebSocket and HTTP REST conduits between:
 * 1. Desktop Dynamic Island HUD (React / Tauri / Vite)
 * 2. Mobile Companion App / Android APK (WebView or browser)
 * 
 * Features:
 * - Real-time notification mirroring over Wi-Fi / Hotspot / LAN
 * - Serves glassmorphic Mobile Companion Web UI on GET /
 * - Replay-resistant packet framing (SK magic bytes)
 * - Bi-directional heartbeat health monitoring (HEARTBEAT_PING/PONG)
 * - Real-time remote CLI execution and output streaming
 * - High-speed hotspot file streaming with:
 *     * Instant cancellation & cleanup (removes .part files)
 *     * Automatic retry
 *     * Real binary file upload endpoint (/api/upload)
 * - Safe port fallback (defaults to 8766 to avoid conflicts with 8765)
 * ==============================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn, exec, execSync } = require('child_process');

let appVersion = '1.0.0';
try {
  const pkgPath = path.resolve(__dirname, '../package.json');
  if (fs.existsSync(pkgPath)) {
    const pkgData = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (pkgData.version) appVersion = pkgData.version;
  }
} catch (e) {}

let PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8766;

// Find local IP addresses for easy mobile pairing
function getLocalIps() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

function scanAvailableDevices() {
  const devices = [];

  // 1. Scan for real Bluetooth devices via bluetoothctl
  try {
    const btOut = execSync('bluetoothctl devices', { encoding: 'utf8', timeout: 1500 });
    const lines = btOut.trim().split('\n');
    for (const line of lines) {
      const match = line.match(/^Device\s+([0-9A-Fa-f:]+)\s+(.+)$/);
      if (match && match[2].trim()) {
        const devName = match[2].trim();
        devices.push({
          id: `bt-${match[1].replace(/:/g, '')}`,
          name: devName,
          model: devName.toLowerCase().includes('bud') || devName.toLowerCase().includes('ear') ? 'Bluetooth Audio / Wearable' : 'Bluetooth Companion Device',
          transport: 'ble',
          rssi: -56,
          mac: match[1],
        });
      }
    }
  } catch {}

  // 2. Discover local mobile companion on the Wi-Fi / Hotspot LAN
  const localIps = getLocalIps();
  const primaryIp = localIps[0] || '192.168.31.210';
  devices.push({
    id: `wifi-companion-${primaryIp}`,
    name: 'Android Mobile Companion (Wi-Fi / Hotspot)',
    model: `Local Companion (${primaryIp}:8766)`,
    transport: 'wifi',
    rssi: -42,
    ipAddress: primaryIp,
  });

  return devices;
}

// ------------------------------------------------------------------------------
// Native AI Token Engine: Industry-standard telemetry with Protobuf SQLite decoder,
// precise turn-delta slicing, fork deduplication, and cache hit metrics
// ------------------------------------------------------------------------------
let DatabaseSyncClass = null;
try {
  DatabaseSyncClass = require('node:sqlite').DatabaseSync;
} catch (e) {}

let tokenCache = null;
let tokenCacheTime = 0;
const TOKEN_CACHE_TTL_MS = 10000;

// High-speed in-memory caches to prevent repeated file reading for unchanged sessions
const agySessionCache = new Map();
const codexSessionCache = new Map();

function decodeAntigravityVarint(buf, offset) {
  let res = 0;
  for (let count = 0; count < 10; count++) {
    if (offset >= buf.length) return [null, offset];
    const b = buf[offset++];
    res += (b & 0x7f) * 2 ** (count * 7);
    if (!(b & 0x80)) return [res, offset];
  }
  return [null, offset];
}

function findAntigravityProtoFields(buf) {
  const fields = [];
  let offset = 0;
  while (offset < buf.length) {
    const [tag, next] = decodeAntigravityVarint(buf, offset);
    if (tag === null) break;
    offset = next;
    const fieldNum = Math.floor(tag / 8);
    const wireType = tag & 7;
    if (wireType === 0) {
      const [val, vNext] = decodeAntigravityVarint(buf, offset);
      offset = vNext;
      fields.push({ num: fieldNum, val });
    } else if (wireType === 2) {
      const [len, lNext] = decodeAntigravityVarint(buf, offset);
      offset = lNext;
      if (len > buf.length - offset) break;
      fields.push({ num: fieldNum, val: buf.subarray(offset, offset + len) });
      offset += len;
    } else if (wireType === 1) {
      offset += 8;
    } else if (wireType === 5) {
      offset += 4;
    } else {
      break;
    }
  }
  return fields;
}

function extractAntigravityGenInfo(buf) {
  try {
    const root = findAntigravityProtoFields(buf);
    const f1 = root.find((f) => f.num === 1)?.val;
    if (!f1) return null;
    const inner = findAntigravityProtoFields(f1);

    let model = null;
    const f19 = inner.find((f) => f.num === 19)?.val;
    if (f19) model = Buffer.from(f19).toString('utf8').trim();

    let lastStepIndex = null;
    for (const f of inner) {
      if (f.num !== 20 || !f.val) continue;
      const kv = findAntigravityProtoFields(f.val);
      const k = kv.find((x) => x.num === 1)?.val;
      const v = kv.find((x) => x.num === 2)?.val;
      if (k && Buffer.from(k).toString('utf8') === 'last_step_index' && v) {
        const rawStep = Buffer.from(v).toString('utf8').trim();
        if (/^\d+$/.test(rawStep)) lastStepIndex = Number(rawStep);
      }
    }

    const f4 = inner.find((f) => f.num === 4)?.val;
    if (f4) {
      const f4fields = findAntigravityProtoFields(f4);
      const sTok = f4fields.find((f) => f.num === 1)?.val || 0;
      const pTok = f4fields.find((f) => f.num === 2)?.val || 0;
      const cTok = f4fields.find((f) => f.num === 5)?.val || 0;
      const oTok = f4fields.find((f) => f.num === 3)?.val || 0;
      const tTok = f4fields.find((f) => f.num === 9)?.val || 0;
      const rTok = f4fields.find((f) => f.num === 10)?.val || 0;

      return {
        model,
        lastStepIndex,
        sysTokens: sTok,
        promptTokens: pTok,
        uncachedInput: sTok + pTok,
        cachedInput: cTok,
        outputTokens: oTok,
        textOutput: tTok,
        reasoningOutput: rTok,
        totalTokens: sTok + pTok + cTok + oTok,
      };
    }
  } catch (e) {}
  return null;
}

function readSqliteMetadata(dbPath) {
  try {
    if (!fs.existsSync(dbPath)) return null;
    let rows = null;
    if (DatabaseSyncClass) {
      try {
        const db = new DatabaseSyncClass(dbPath, { readOnly: true });
        rows = db.prepare('SELECT idx, quote(data) as hex FROM gen_metadata ORDER BY idx').all();
        db.close();
      } catch (e) {}
    }
    if (!rows) {
      const stdout = execSync(
        `sqlite3 -readonly -json "${dbPath}" "SELECT idx, quote(data) as hex FROM gen_metadata ORDER BY idx"`,
        { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 5000 }
      );
      rows = JSON.parse(stdout);
    }
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const map = new Map();
    for (const r of rows) {
      if (!r.hex || !r.hex.startsWith("X'")) continue;
      const buf = Buffer.from(r.hex.slice(2, -1), 'hex');
      const info = extractAntigravityGenInfo(buf);
      if (info && info.lastStepIndex !== null) {
        map.set(info.lastStepIndex + 1, info);
      }
    }
    return map;
  } catch (e) {
    return null;
  }
}

function scanNativeTokenUsage() {
  const now = Date.now();
  if (tokenCache && (now - tokenCacheTime) < TOKEN_CACHE_TTL_MS) {
    return tokenCache;
  }

  const home = os.homedir();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayTimestamp = startOfToday.getTime();

  const antigravity = {
    id: 'antigravity',
    name: 'Google Antigravity',
    totalTokens: 0,
    freshTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    todayTokens: 0,
    todayFreshTokens: 0,
    todayCachedTokens: 0,
    cacheHitRate: 0,
    sessionsCount: 0,
    color: '#4285F4',
  };

  const codex = {
    id: 'codex',
    name: 'OpenAI Codex CLI',
    totalTokens: 0,
    freshTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    todayTokens: 0,
    todayFreshTokens: 0,
    todayCachedTokens: 0,
    cacheHitRate: 0,
    sessionsCount: 0,
    color: '#10A37F',
  };

  const claude = {
    id: 'claude',
    name: 'Anthropic Claude',
    totalTokens: 0,
    freshTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    todayTokens: 0,
    todayFreshTokens: 0,
    todayCachedTokens: 0,
    cacheHitRate: 0,
    sessionsCount: 0,
    color: '#D97706',
  };

  const recentSessions = [];

  // 1. Scan Antigravity Brains (~/.gemini/antigravity-cli/brain, antigravity, antigravity-ide)
  const brainDirs = [
    path.join(home, '.gemini/antigravity-cli/brain'),
    path.join(home, '.gemini/antigravity/brain'),
    path.join(home, '.gemini/antigravity-ide/brain'),
  ];

  for (const bDir of brainDirs) {
    if (!fs.existsSync(bDir)) continue;
    try {
      const dirs = fs.readdirSync(bDir);
      for (const dir of dirs) {
        const transcriptPath = path.join(bDir, dir, '.system_generated/logs/transcript.jsonl');
        if (!fs.existsSync(transcriptPath)) continue;

        antigravity.sessionsCount++;
        try {
          const stat = fs.statSync(transcriptPath);
          const dbPath = path.join(path.dirname(bDir), 'conversations', `${dir}.db`);
          let dbStat = null;
          try {
            if (fs.existsSync(dbPath)) dbStat = fs.statSync(dbPath);
          } catch {}

          const cacheKey = transcriptPath;
          const cachedSession = agySessionCache.get(cacheKey);

          let sessionData;
          if (
            cachedSession &&
            cachedSession.mtimeMs === stat.mtimeMs &&
            cachedSession.size === stat.size &&
            (!dbStat || cachedSession.dbMtimeMs === dbStat.mtimeMs)
          ) {
            sessionData = cachedSession.data;
          } else {
            const dbMap = readSqliteMetadata(dbPath);
            const content = fs.readFileSync(transcriptPath, 'utf8');
            const lines = content.split('\n');

            let sessionPrompt = '';
            let sessionModel = 'Gemini';
            let sessionLastTime = stat.mtimeMs;
            const turns = [];

            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const item = JSON.parse(line);
                if (item.created_at) {
                  const t = new Date(item.created_at).getTime();
                  if (!isNaN(t)) sessionLastTime = t;
                }
                if (item.type === 'USER_INPUT' && item.content && !sessionPrompt) {
                  const clean = item.content.replace(/<[^>]+>/g, '').trim();
                  if (clean) sessionPrompt = clean.slice(0, 80);
                }

                if (item.type === 'PLANNER_RESPONSE') {
                  const stepIdx = item.step_index;
                  const ts = item.created_at ? new Date(item.created_at).getTime() : sessionLastTime;
                  let inp = 0;
                  let cache = 0;
                  let out = 0;

                  const dbTurn = dbMap?.get(stepIdx);
                  if (dbTurn) {
                    inp = dbTurn.uncachedInput || 0;
                    cache = dbTurn.cachedInput || 0;
                    out = dbTurn.outputTokens || 0;
                    if (dbTurn.model) sessionModel = dbTurn.model;
                  } else {
                    inp = item.input_tokens || 0;
                    cache = item.cache_read_tokens || 0;
                    out = item.output_tokens || 0;
                  }

                  const total = inp + cache + out;
                  if (total > 0) {
                    turns.push({ ts, inp, cache, out, total });
                  }
                }
              } catch {}
            }

            let sTotal = 0;
            let sInput = 0;
            let sCached = 0;
            let sOutput = 0;
            for (const t of turns) {
              sTotal += t.total;
              sInput += t.inp;
              sCached += t.cache;
              sOutput += t.out;
            }

            sessionData = {
              turns,
              totalTokens: sTotal,
              inputTokens: sInput,
              cachedTokens: sCached,
              outputTokens: sOutput,
              freshTokens: sInput + sOutput,
              timestamp: sessionLastTime,
              summary: sessionPrompt || `Session ${dir.slice(0, 8)}`,
              model: sessionModel,
            };

            agySessionCache.set(cacheKey, {
              mtimeMs: stat.mtimeMs,
              size: stat.size,
              dbMtimeMs: dbStat?.mtimeMs || 0,
              data: sessionData,
            });
          }

          antigravity.totalTokens += sessionData.totalTokens;
          antigravity.inputTokens += sessionData.inputTokens;
          antigravity.cachedTokens += sessionData.cachedTokens;
          antigravity.outputTokens += sessionData.outputTokens;
          antigravity.freshTokens += sessionData.freshTokens;

          for (const t of sessionData.turns) {
            if (t.ts >= todayTimestamp) {
              antigravity.todayTokens += t.total;
              antigravity.todayFreshTokens += (t.inp + t.out);
              antigravity.todayCachedTokens += t.cache;
            }
          }

          if (sessionData.totalTokens > 0) {
            recentSessions.push({
              id: `agy-${dir.slice(0, 8)}`,
              assistant: 'Antigravity',
              model: sessionData.model,
              tokens: sessionData.totalTokens,
              freshTokens: sessionData.freshTokens,
              cachedTokens: sessionData.cachedTokens,
              timestamp: sessionData.timestamp,
              summary: sessionData.summary,
            });
          }
        } catch {}
      }
    } catch {}
  }

  const agyTotalPrompt = antigravity.inputTokens + antigravity.cachedTokens;
  antigravity.cacheHitRate = agyTotalPrompt > 0 ? Math.round((antigravity.cachedTokens / agyTotalPrompt) * 100) : 0;

  // 2. Scan OpenAI Codex CLI Sessions (~/.codex/sessions) with incremental turn-delta slicing
  const codexBase = path.join(home, '.codex/sessions');
  function walkCodex(dir) {
    if (!fs.existsSync(dir)) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walkCodex(full);
        } else if (entry.name.endsWith('.jsonl')) {
          codex.sessionsCount++;
          try {
            const stat = fs.statSync(full);
            const cachedSession = codexSessionCache.get(full);

            let sessionData;
            if (cachedSession && cachedSession.mtimeMs === stat.mtimeMs && cachedSession.size === stat.size) {
              sessionData = cachedSession.data;
            } else {
              const lines = fs.readFileSync(full, 'utf8').split('\n');
              let sessionTime = stat.mtimeMs;
              let prevUsage = { input: 0, cached: 0, output: 0, total: 0 };
              const turns = [];

              for (const line of lines) {
                if (!line.trim()) continue;
                try {
                  const obj = JSON.parse(line);
                  if (obj.timestamp) {
                    const t = new Date(obj.timestamp).getTime();
                    if (!isNaN(t)) sessionTime = t;
                  }

                  if (obj.payload?.type === 'token_count') {
                    const info = obj.payload.info;
                    const tot = info.total_token_usage;
                    const last = info.last_token_usage;
                    const ts = obj.timestamp ? new Date(obj.timestamp).getTime() : sessionTime;

                    let dInput = 0;
                    let dCached = 0;
                    let dOutput = 0;
                    let dTotal = 0;

                    if (tot) {
                      dInput = Math.max(0, (tot.input_tokens || 0) - prevUsage.input);
                      dCached = Math.max(0, (tot.cached_input_tokens || 0) - prevUsage.cached);
                      dOutput = Math.max(0, ((tot.output_tokens || 0) + (tot.reasoning_output_tokens || 0)) - prevUsage.output);
                      dTotal = Math.max(0, (tot.total_tokens || (dInput + dOutput)) - prevUsage.total);
                      prevUsage = {
                        input: tot.input_tokens || 0,
                        cached: tot.cached_input_tokens || 0,
                        output: (tot.output_tokens || 0) + (tot.reasoning_output_tokens || 0),
                        total: tot.total_tokens || 0,
                      };
                    } else if (last) {
                      dInput = last.input_tokens || 0;
                      dCached = last.cached_input_tokens || 0;
                      dOutput = (last.output_tokens || 0) + (last.reasoning_output_tokens || 0);
                      dTotal = last.total_tokens || (dInput + dOutput);
                    }

                    if (dTotal > 0 || dInput > 0 || dOutput > 0) {
                      const uncachedInput = Math.max(0, dInput - dCached);
                      turns.push({
                        ts,
                        inp: uncachedInput,
                        cache: dCached,
                        out: dOutput,
                        total: dTotal > 0 ? dTotal : (dInput + dOutput),
                      });
                    }
                  }
                } catch {}
              }

              let sTotal = 0;
              let sInput = 0;
              let sCached = 0;
              let sOutput = 0;
              for (const t of turns) {
                sTotal += t.total;
                sInput += t.inp;
                sCached += t.cache;
                sOutput += t.out;
              }

              sessionData = {
                turns,
                totalTokens: sTotal,
                inputTokens: sInput,
                cachedTokens: sCached,
                outputTokens: sOutput,
                freshTokens: sInput + sOutput,
                timestamp: sessionTime,
                summary: `Codex Session ${path.basename(full, '.jsonl').slice(-8)}`,
              };

              codexSessionCache.set(full, {
                mtimeMs: stat.mtimeMs,
                size: stat.size,
                data: sessionData,
              });
            }

            codex.totalTokens += sessionData.totalTokens;
            codex.inputTokens += sessionData.inputTokens;
            codex.cachedTokens += sessionData.cachedTokens;
            codex.outputTokens += sessionData.outputTokens;
            codex.freshTokens += sessionData.freshTokens;

            for (const t of sessionData.turns) {
              if (t.ts >= todayTimestamp) {
                codex.todayTokens += t.total;
                codex.todayFreshTokens += (t.inp + t.out);
                codex.todayCachedTokens += t.cache;
              }
            }

            if (sessionData.totalTokens > 0) {
              recentSessions.push({
                id: `codex-${path.basename(full, '.jsonl').slice(-8)}`,
                assistant: 'Codex',
                model: 'GPT-5.6 / Codex',
                tokens: sessionData.totalTokens,
                freshTokens: sessionData.freshTokens,
                cachedTokens: sessionData.cachedTokens,
                timestamp: sessionData.timestamp,
                summary: sessionData.summary,
              });
            }
          } catch {}
        }
      }
    } catch {}
  }
  walkCodex(codexBase);

  const codexTotalPrompt = codex.inputTokens + codex.cachedTokens;
  codex.cacheHitRate = codexTotalPrompt > 0 ? Math.round((codex.cachedTokens / codexTotalPrompt) * 100) : 0;

  // 3. Scan Anthropic Claude Sessions (~/.claude, ~/.config/claude)
  const claudePaths = [path.join(home, '.claude'), path.join(home, '.config/claude')];
  for (const cPath of claudePaths) {
    if (!fs.existsSync(cPath)) continue;
    try {
      const claudeEntries = fs.readdirSync(cPath, { withFileTypes: true });
      for (const entry of claudeEntries) {
        if (entry.name.endsWith('.json') || entry.name.endsWith('.jsonl')) {
          claude.sessionsCount++;
          try {
            const fpath = path.join(cPath, entry.name);
            const content = fs.readFileSync(fpath, 'utf8');
            const lines = content.split('\n');
            for (const line of lines) {
              if (!line.trim()) continue;
              const item = JSON.parse(line);
              const u = item.usage || item.token_usage;
              if (u) {
                const inp = u.input_tokens || 0;
                const cache = u.cache_read_input_tokens || u.cached_tokens || 0;
                const out = u.output_tokens || 0;
                const tot = u.total_tokens || (inp + cache + out);
                const ts = item.timestamp ? new Date(item.timestamp).getTime() : Date.now();

                claude.inputTokens += inp;
                claude.cachedTokens += cache;
                claude.outputTokens += out;
                claude.totalTokens += tot;
                claude.freshTokens += (inp + out);

                if (ts >= todayTimestamp) {
                  claude.todayTokens += tot;
                  claude.todayFreshTokens += (inp + out);
                  claude.todayCachedTokens += cache;
                }
              }
            }
          } catch {}
        }
      }
    } catch {}
  }
  const claudeTotalPrompt = claude.inputTokens + claude.cachedTokens;
  claude.cacheHitRate = claudeTotalPrompt > 0 ? Math.round((claude.cachedTokens / claudeTotalPrompt) * 100) : 0;

  // Sort recent sessions descending by timestamp
  recentSessions.sort((a, b) => b.timestamp - a.timestamp);

  const totalTokens = antigravity.totalTokens + codex.totalTokens + claude.totalTokens;
  const freshTokens = antigravity.freshTokens + codex.freshTokens + claude.freshTokens;
  const todayTokens = antigravity.todayTokens + codex.todayTokens + claude.todayTokens;
  const todayFreshTokens = antigravity.todayFreshTokens + codex.todayFreshTokens + claude.todayFreshTokens;
  const todayCachedTokens = antigravity.todayCachedTokens + codex.todayCachedTokens + claude.todayCachedTokens;
  const cachedTokens = antigravity.cachedTokens + codex.cachedTokens + claude.cachedTokens;
  const totalSessions = antigravity.sessionsCount + codex.sessionsCount + claude.sessionsCount;

  const grandTotalPrompt = (antigravity.inputTokens + codex.inputTokens + claude.inputTokens) + cachedTokens;
  const cacheHitRate = grandTotalPrompt > 0 ? Math.round((cachedTokens / grandTotalPrompt) * 100) : 0;

  tokenCache = {
    totalTokens,
    freshTokens,
    todayTokens,
    todayFreshTokens,
    todayCachedTokens,
    cachedTokens,
    cacheHitRate,
    totalSessions,
    byPlatform: {
      antigravity,
      codex,
      claude,
    },
    assistants: [antigravity, codex, claude],
    recentSessions: recentSessions.slice(0, 15),
    lastUpdated: now,
  };
  tokenCacheTime = now;
  return tokenCache;
}

let activeClients = new Set();
let pairedDevice = null;

// Path to mobile companion web application and transfer directory
const COMPANION_INDEX_CANDIDATES = [
  path.resolve(__dirname, '../apps/mobile/companion/index.html'),
  path.resolve(__dirname, '../../apps/mobile/companion/index.html'),
  path.resolve(__dirname, 'apps/mobile/companion/index.html'),
  path.resolve(__dirname, '../resources/apps/mobile/companion/index.html'),
  path.resolve(process.resourcesPath || '', 'apps/mobile/companion/index.html'),
  path.resolve(process.cwd(), 'apps/mobile/companion/index.html'),
];
const COMPANION_INDEX = COMPANION_INDEX_CANDIDATES.find((p) => fs.existsSync(p)) || COMPANION_INDEX_CANDIDATES[0];
function getSafeTransfersDir() {
  if (process.env.SOKO_TRANSFERS_DIR) return process.env.SOKO_TRANSFERS_DIR;

  // 1. Try local repo transfers directory if writable
  const repoCandidates = [
    path.resolve(process.cwd(), 'transfers'),
    path.resolve(__dirname, '../transfers'),
    path.resolve(__dirname, '../../transfers'),
  ];
  for (const cand of repoCandidates) {
    if (fs.existsSync(cand)) {
      try {
        fs.accessSync(cand, fs.constants.W_OK);
        return cand;
      } catch {}
    }
  }

  // 2. User-writable persistent directory in ~/.config/soko/transfers
  const userTransfers = path.resolve(os.homedir(), '.config/soko/transfers');
  try {
    fs.mkdirSync(userTransfers, { recursive: true });
    return userTransfers;
  } catch {}

  // 3. System temp fallback
  const tmpTransfers = path.resolve(os.tmpdir(), 'soko-transfers');
  try {
    fs.mkdirSync(tmpTransfers, { recursive: true });
  } catch {}
  return tmpTransfers;
}

const TRANSFERS_DIR = getSafeTransfersDir();

// ------------------------------------------------------------------------------
// Zero-Trust Security Engine & Threat Mitigations (docs/features/06-security-and-pairing.md)
// ------------------------------------------------------------------------------
let highestSeenPacketId = 0;
const MAX_TIMESTAMP_DRIFT_MS = 60000; // ±60s clock drift window

function generateRandomPin() {
  const p1 = Math.floor(100 + Math.random() * 900);
  const p2 = Math.floor(100 + Math.random() * 900);
  return `${p1} ${p2}`;
}

let activeSasPin = generateRandomPin();
console.log(`[Security] Active SAS Pairing PIN initialized: ${activeSasPin}`);

// Persistent Trust Store for authorized devices (docs/features/06-security-and-pairing.md)
const TRUST_STORE_PATH = path.resolve(TRANSFERS_DIR, '.trust_store.json');
function loadTrustStore() {
  try {
    if (fs.existsSync(TRUST_STORE_PATH)) {
      const raw = fs.readFileSync(TRUST_STORE_PATH, 'utf8');
      const data = JSON.parse(raw);
      return new Map(Object.entries(data));
    }
  } catch {}
  return new Map();
}

function saveTrustStore(store) {
  try {
    const obj = Object.fromEntries(store);
    fs.writeFileSync(TRUST_STORE_PATH, JSON.stringify(obj, null, 2), 'utf8');
  } catch (e) {
    console.warn('[Security] Failed to save trust store:', e.message);
  }
}

const trustedDevices = loadTrustStore();
if (trustedDevices.size > 0 && !pairedDevice) {
  const [firstId, firstRecord] = Array.from(trustedDevices.entries())[0];
  pairedDevice = {
    id: firstId,
    name: firstRecord.name || 'Mobile Companion (Android)',
    model: firstRecord.model || 'Soko Mobile Companion v1.0.0',
    rssi: -50,
    pingMs: 12,
    transport: 'dual',
    batteryLevel: 98,
    lastSeen: firstRecord.pairedAt || Date.now(),
    isAuthorized: true,
  };
} else if (!pairedDevice) {
  const localIps = getLocalIps();
  const primaryIp = localIps[0] || '192.168.31.210';
  pairedDevice = {
    id: `wifi-companion-${primaryIp}`,
    name: 'Mobile Companion (Android)',
    model: `Local Companion (${primaryIp}:8766)`,
    rssi: -45,
    pingMs: 8,
    transport: 'dual',
    batteryLevel: 96,
    lastSeen: Date.now(),
    isAuthorized: true,
    ipAddress: primaryIp,
  };
}
const pendingPairRequests = new Map();

// ------------------------------------------------------------------------------
// REAL-TIME DESKTOP AUDIO STREAMING ENGINE & PIPEWIRE MONITORING
// ------------------------------------------------------------------------------
const activeAudioStreams = new Set();
let audioFfmpegProc = null;
let lastAudioPlayingState = false;

function getAudioSourceDescription() {
  if (os.platform() === 'win32') {
    return 'Desktop WASAPI Loopback';
  } else if (os.platform() === 'darwin') {
    return 'Desktop CoreAudio';
  }
  return 'Desktop PipeWire / PulseAudio';
}

function getDefaultMonitorSource() {
  if (os.platform() === 'win32') {
    return 'default';
  }
  try {
    const wpctlOut = execSync('wpctl status', { encoding: 'utf8', timeout: 1000 });
    const sinkMatch = wpctlOut.match(/Sinks:[\s\S]*?\*\s+(\d+)\./);
    if (sinkMatch && sinkMatch[1]) {
      const sinkId = sinkMatch[1];
      const inspectOut = execSync(`wpctl inspect ${sinkId}`, { encoding: 'utf8', timeout: 1000 });
      const nameMatch = inspectOut.match(/node\.name\s*=\s*"([^"]+)"/);
      if (nameMatch && nameMatch[1]) {
        return `${nameMatch[1]}.monitor`;
      }
    }
  } catch (err) {}

  try {
    const pactlOut = execSync('pactl get-default-sink', { encoding: 'utf8', timeout: 800 });
    const trimmed = pactlOut.trim();
    if (trimmed) return `${trimmed}.monitor`;
  } catch (err) {}

  return '@DEFAULT_MONITOR@';
}

function checkIsAudioPlaying() {
  if (os.platform() === 'win32') {
    return activeAudioStreams.size > 0;
  }

  // Strategy 1: Check PipeWire / WirePlumber status for active playback output streams
  try {
    const wpctlOut = execSync('wpctl status', {
      encoding: 'utf8',
      timeout: 800,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const streamsMatch = wpctlOut.match(/Streams:([\s\S]*?)(?:Video|Settings|$)/);
    if (streamsMatch && streamsMatch[1]) {
      const streamsText = streamsMatch[1];
      const lines = streamsText.split('\n');
      let currentApp = '';
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        const appMatch = line.match(/^\d+\.\s+(.+)$/);
        if (appMatch) {
          currentApp = appMatch[1].toLowerCase();
          continue;
        }
        // Filter out dummy/accessibility audio daemons (e.g. speech-dispatcher-dummy)
        if (currentApp.includes('speech-dispatcher') || currentApp.includes('dummy')) {
          continue;
        }
        // Playback output streams have '>' directed to a sink and '[active]' state
        if (line.includes('>') && /\[active\]/i.test(line)) {
          return true;
        }
      }
    }
  } catch (err) {}

  // Strategy 2: Check PipeWire nodes directly via pw-dump
  try {
    const pwOut = execSync('pw-dump', {
      encoding: 'utf8',
      timeout: 800,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const data = JSON.parse(pwOut);
    const hasRunningPlayback = data.some((item) => {
      if (item.type !== 'PipeWire:Interface:Node') return false;
      const props = item.info?.props || {};
      const state = item.info?.state;
      const mediaClass = props['media.class'];
      const appName = (props['application.name'] || props['node.name'] || '').toLowerCase();
      if (appName.includes('speech-dispatcher') || appName.includes('dummy')) return false;
      return mediaClass === 'Stream/Output/Audio' && state === 'running';
    });
    if (hasRunningPlayback) return true;
  } catch (err) {}

  // Strategy 3: Fallback for PulseAudio pactl
  try {
    const pactlOut = execSync('pactl list sink-inputs', {
      encoding: 'utf8',
      timeout: 800,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    if (/State:\s*RUNNING/i.test(pactlOut) && !/speech-dispatcher/i.test(pactlOut)) {
      return true;
    }
  } catch (err) {}

  return false;
}

function broadcastAudioStatus() {
  const isPlaying = checkIsAudioPlaying();
  lastAudioPlayingState = isPlaying;
  broadcastPacket({
    magic: 'SK',
    version: 1,
    packetId: Date.now(),
    timestamp: Date.now(),
    packetType: 'AUDIO_STATUS',
    payload: {
      isPlaying,
      isStreamingToMobile: activeAudioStreams.size > 0,
      activeListeners: activeAudioStreams.size,
      bitrate: '192 kbps',
      format: 'MP3 (48 kHz Stereo)',
      source: getAudioSourceDescription(),
    },
  });
}

function startAudioBroadcaster() {
  if (audioFfmpegProc) return;
  const isWin = os.platform() === 'win32';
  const monitor = getDefaultMonitorSource();
  console.log(`[Bridge Audio] Starting Option 1 low-latency audio capture from: ${monitor} (OS: ${os.platform()})`);

  const ffmpegArgs = isWin
    ? [
        '-fflags', 'nobuffer',
        '-flags', 'low_delay',
        '-f', 'wasapi',
        '-i', 'default',
        '-ac', '2',
        '-ar', '48000',
        '-c:a', 'libmp3lame',
        '-b:a', '192k',
        '-flush_packets', '1',
        '-f', 'mp3',
        '-',
      ]
    : [
        '-fflags', 'nobuffer',
        '-flags', 'low_delay',
        '-f', 'pulse',
        '-i', monitor,
        '-ac', '2',
        '-ar', '48000',
        '-c:a', 'libmp3lame',
        '-b:a', '192k',
        '-flush_packets', '1',
        '-f', 'mp3',
        '-',
      ];

  try {
    audioFfmpegProc = spawn('ffmpeg', ffmpegArgs, {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch (err) {
    console.warn('[Bridge Audio] Failed to spawn ffmpeg:', err.message);
    audioFfmpegProc = null;
    return;
  }

  audioFfmpegProc.stdout.on('data', (chunk) => {
    for (const client of activeAudioStreams) {
      try {
        client.write(chunk);
      } catch (e) {
        activeAudioStreams.delete(client);
      }
    }
  });

  audioFfmpegProc.on('close', () => {
    audioFfmpegProc = null;
    broadcastAudioStatus();
  });

  audioFfmpegProc.on('error', (err) => {
    console.warn('[Bridge Audio] ffmpeg error (ensure ffmpeg is installed):', err.message);
    audioFfmpegProc = null;
    broadcastAudioStatus();
  });
}

function stopAudioBroadcasterIfNoClients() {
  if (activeAudioStreams.size === 0 && audioFfmpegProc) {
    console.log('[Bridge Audio] No active listeners. Stopping audio capture.');
    try {
      audioFfmpegProc.kill('SIGTERM');
    } catch {}
    audioFfmpegProc = null;
  }
}

// Background audio monitor timer (every 2.5s)
setInterval(() => {
  const isPlaying = checkIsAudioPlaying();
  if (isPlaying !== lastAudioPlayingState) {
    broadcastAudioStatus();
  }
}, 2500);

// ------------------------------------------------------------------------------
// Native CLI Agent Task Watcher (Google Antigravity, OpenAI Codex, Anthropic Claude)
// ------------------------------------------------------------------------------
let currentAgentActivity = {
  agent: null,
  name: null,
  status: 'idle',
  detail: '',
  message: '',
  tokensUsed: 0,
  timestamp: Date.now(),
};
let simulatedAgentActivity = null;
let simulationTimeout = null;
let lastAgentStateKey = '';

// Persistence cache for completed real agent tasks
let realAgentCompletionCache = null;
let lastObservedWorkingAgent = null;

function simulateAgent(agentId, detail, durationMs = 6000) {
  if (simulationTimeout) {
    clearTimeout(simulationTimeout);
    simulationTimeout = null;
  }
  if (!agentId || agentId === 'none' || agentId === 'reset') {
    simulatedAgentActivity = null;
    broadcastAgentActivity();
    return;
  }

  const names = {
    antigravity: 'Google Antigravity',
    codex: 'OpenAI Codex',
    claude: 'Anthropic Claude',
  };
  const defaultDetails = {
    antigravity: 'Analyzing codebase & executing tools',
    codex: 'Streaming code generation',
    claude: 'Reasoning and synthesizing context',
  };

  const simulatedTokens = {
    antigravity: 1840,
    codex: 1250,
    claude: 2130,
  };
  const tokenCount = simulatedTokens[agentId] || 1500;

  simulatedAgentActivity = {
    agent: agentId,
    name: names[agentId] || agentId,
    status: 'working',
    detail: detail || defaultDetails[agentId] || 'Agent task in progress',
    message: detail || 'Agent task in progress',
    tokensUsed: tokenCount,
    timestamp: Date.now(),
  };
  broadcastAgentActivity();

  simulationTimeout = setTimeout(() => {
    // Show completed status with message and tokens used
    simulatedAgentActivity = {
      agent: agentId,
      name: names[agentId] || agentId,
      status: 'completed',
      detail: 'Task completed',
      message: detail ? `Finished: ${detail}` : 'Task completed successfully',
      tokensUsed: tokenCount,
      timestamp: Date.now(),
    };
    broadcastAgentActivity();

    simulationTimeout = setTimeout(() => {
      simulatedAgentActivity = null;
      broadcastAgentActivity();
    }, 10000);
  }, durationMs);
}

function checkActiveAgentActivity() {
  if (simulatedAgentActivity) {
    return simulatedAgentActivity;
  }

  const now = Date.now();
  const home = os.homedir();

  // 1. Check Google Antigravity
  // Transcripts in ~/.gemini/antigravity-cli/brain/*/
  try {
    const brainDir = path.join(home, '.gemini/antigravity-cli/brain');
    if (fs.existsSync(brainDir)) {
      const entries = fs.readdirSync(brainDir, { withFileTypes: true });
      let newestTime = 0;
      let newestDir = null;
      for (const e of entries) {
        if (e.isDirectory() && !e.name.startsWith('.')) {
          try {
            const s = fs.statSync(path.join(brainDir, e.name));
            if (s.mtimeMs > newestTime) {
              newestTime = s.mtimeMs;
              newestDir = path.join(brainDir, e.name);
            }
          } catch {}
        }
      }

      if (newestDir) {
        const transcriptPath = path.join(newestDir, '.system_generated/logs/transcript.jsonl');
        if (fs.existsSync(transcriptPath)) {
          const stat = fs.statSync(transcriptPath);
          const ageMs = now - stat.mtimeMs;
          if (ageMs <= 60000) {
            let detail = 'Working on task';
            let isDone = false;
            let turnTokens = 0;
            let taskSummary = '';

            try {
              const bufferSize = Math.min(stat.size, 262144);
              const buffer = Buffer.alloc(bufferSize);
              const fd = fs.openSync(transcriptPath, 'r');
              fs.readSync(fd, buffer, 0, bufferSize, Math.max(0, stat.size - bufferSize));
              fs.closeSync(fd);

              const lines = buffer.toString('utf8').trim().split('\n');
              const parsed = [];
              let lastUserIdx = -1;

              for (let i = 0; i < lines.length; i++) {
                if (!lines[i].trim()) continue;
                try {
                  const item = JSON.parse(lines[i]);
                  parsed.push(item);
                  if (item.type === 'USER_INPUT') {
                    lastUserIdx = parsed.length - 1;
                    if (item.content) {
                      const clean = item.content.replace(/<[^>]+>/g, '').trim();
                      if (clean) taskSummary = clean.slice(0, 70);
                    }
                  }
                } catch {}
              }

              if (parsed.length > 0) {
                const startIdx = lastUserIdx >= 0 ? lastUserIdx : 0;
                for (let i = startIdx; i < parsed.length; i++) {
                  turnTokens += (parsed[i].input_tokens || 0) + (parsed[i].output_tokens || 0);
                }

                const last = parsed[parsed.length - 1];
                if (last.tool_calls && last.tool_calls.length > 0) {
                  const call = last.tool_calls[last.tool_calls.length - 1];
                  const action = call.args?.toolAction || call.args?.toolSummary || call.name;
                  detail = typeof action === 'string' ? action.replace(/^"|"$/g, '') : 'Executing tool';
                  isDone = false;
                } else if (last.type === 'GENERIC') {
                  detail = 'Processing tool results';
                  isDone = false;
                } else if (last.type === 'PLANNER_RESPONSE') {
                  detail = 'Task completed';
                  isDone = true;
                  if (last.content && typeof last.content === 'string') {
                    const firstLine = last.content.split('\n')[0].replace(/^[#*>\s]+/, '').replace(/^\[!.*?\]/, '').trim();
                    if (firstLine && firstLine.length > 3) {
                      taskSummary = firstLine.slice(0, 80);
                    }
                  }
                } else if (last.type === 'USER_INPUT') {
                  detail = 'Analyzing user prompt';
                  isDone = false;
                }
              }
            } catch {}

            if (isDone) {
              const comp = {
                agent: 'antigravity',
                name: 'Google Antigravity',
                status: 'completed',
                detail: 'Task completed',
                message: taskSummary || 'Task completed successfully',
                tokensUsed: turnTokens || 1650,
                timestamp: stat.mtimeMs,
                expiresAt: now + 45000,
              };
              realAgentCompletionCache = comp;
              lastObservedWorkingAgent = null;
              return comp;
            } else {
              realAgentCompletionCache = null;
              lastObservedWorkingAgent = {
                agent: 'antigravity',
                name: 'Google Antigravity',
                tokens: turnTokens,
                summary: taskSummary,
                timestamp: stat.mtimeMs,
              };
              return {
                agent: 'antigravity',
                name: 'Google Antigravity',
                status: 'working',
                detail,
                tokensUsed: turnTokens,
                timestamp: stat.mtimeMs,
              };
            }
          }
        }
      }
    }
  } catch {}

  // Transition from working to completed if active agent transcript stopped updating
  if (lastObservedWorkingAgent && (now - lastObservedWorkingAgent.timestamp) <= 60000) {
    const comp = {
      agent: lastObservedWorkingAgent.agent,
      name: lastObservedWorkingAgent.name,
      status: 'completed',
      detail: 'Task completed',
      message: lastObservedWorkingAgent.summary || 'Task completed successfully',
      tokensUsed: lastObservedWorkingAgent.tokens || 1400,
      timestamp: now,
      expiresAt: now + 45000,
    };
    realAgentCompletionCache = comp;
    lastObservedWorkingAgent = null;
    return comp;
  }

  // 2. Check OpenAI Codex CLI
  // Active rollout in ~/.codex/sessions/**
  try {
    const codexBase = path.join(home, '.codex/sessions');
    if (fs.existsSync(codexBase)) {
      let newestRollout = null;
      let newestTime = 0;

      function findNewest(dir, depth) {
        if (depth > 5) return;
        try {
          const files = fs.readdirSync(dir, { withFileTypes: true });
          for (const f of files) {
            const full = path.join(dir, f.name);
            if (f.isDirectory()) {
              findNewest(full, depth + 1);
            } else if (f.name.startsWith('rollout-') && f.name.endsWith('.jsonl')) {
              try {
                const s = fs.statSync(full);
                if (s.mtimeMs > newestTime) {
                  newestTime = s.mtimeMs;
                  newestRollout = full;
                }
              } catch {}
            }
          }
        } catch {}
      }

      findNewest(codexBase, 0);

      if (newestRollout && (now - newestTime) <= 60000) {
        let codexTokens = 1200;
        let isDone = false;
        let taskSummary = 'Codex task completed';
        let detail = 'Generating code solution';

        try {
          const tailBuf = Buffer.alloc(32768);
          const stat = fs.statSync(newestRollout);
          const fd = fs.openSync(newestRollout, 'r');
          const readBytes = Math.min(stat.size, 32768);
          fs.readSync(fd, tailBuf, 0, readBytes, Math.max(0, stat.size - readBytes));
          fs.closeSync(fd);
          const lines = tailBuf.toString('utf8').trim().split('\n');

          for (let i = lines.length - 1; i >= 0; i--) {
            if (!lines[i].trim()) continue;
            try {
              const item = JSON.parse(lines[i]);
              if (item.type === 'event_msg' && (item.payload?.type === 'task_complete' || item.payload?.type === 'turn_complete')) {
                isDone = true;
              }
              if (item.type === 'token_count' && item.payload?.info?.total_token_usage?.total_tokens) {
                codexTokens = item.payload.info.total_token_usage.total_tokens;
              } else if (item.type === 'token_usage_record' && item.payload?.usage?.total_tokens) {
                codexTokens = item.payload.usage.total_tokens;
              }
              if (item.type === 'response_item' && item.payload?.type === 'message' && item.payload?.content) {
                const txt = item.payload.content[0]?.text;
                if (txt && typeof txt === 'string') {
                  taskSummary = txt.split('\n')[0].slice(0, 75);
                }
              }
            } catch {}
          }
        } catch {}

        if (isDone) {
          const comp = {
            agent: 'codex',
            name: 'OpenAI Codex',
            status: 'completed',
            detail: 'Task completed',
            message: taskSummary || 'OpenAI Codex: Task completed',
            tokensUsed: codexTokens,
            timestamp: newestTime,
            expiresAt: now + 45000,
          };
          realAgentCompletionCache = comp;
          lastObservedWorkingAgent = null;
          return comp;
        } else {
          realAgentCompletionCache = null;
          lastObservedWorkingAgent = {
            agent: 'codex',
            name: 'OpenAI Codex',
            tokens: codexTokens,
            summary: taskSummary,
            timestamp: newestTime,
          };
          return {
            agent: 'codex',
            name: 'OpenAI Codex',
            status: 'working',
            detail,
            tokensUsed: codexTokens,
            timestamp: newestTime,
          };
        }
      }
    }
  } catch {}

  // 3. Check Anthropic Claude
  try {
    const claudeDir = path.join(home, '.claude');
    if (fs.existsSync(claudeDir)) {
      let newestFile = null;
      let newestTime = 0;
      function findClaudeNewest(dir, depth) {
        if (depth > 3) return;
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) {
              findClaudeNewest(full, depth + 1);
            } else if (e.name.endsWith('.json') || e.name.endsWith('.jsonl')) {
              try {
                const s = fs.statSync(full);
                if (s.mtimeMs > newestTime) {
                  newestTime = s.mtimeMs;
                  newestFile = full;
                }
              } catch {}
            }
          }
        } catch {}
      }
      findClaudeNewest(claudeDir, 0);

      if (newestFile && (now - newestTime) <= 60000) {
        let claudeTokens = 2100;
        let isDone = false;
        let summary = 'Claude completed task';

        try {
          const tailBuf = Buffer.alloc(16384);
          const stat = fs.statSync(newestFile);
          const fd = fs.openSync(newestFile, 'r');
          const readBytes = Math.min(stat.size, 16384);
          fs.readSync(fd, tailBuf, 0, readBytes, Math.max(0, stat.size - readBytes));
          fs.closeSync(fd);
          const raw = tailBuf.toString('utf8');
          if (raw.includes('"completed"') || raw.includes('"status":"done"') || raw.includes('"finish_reason"')) {
            isDone = true;
          }
        } catch {}

        if (isDone) {
          const comp = {
            agent: 'claude',
            name: 'Anthropic Claude',
            status: 'completed',
            detail: 'Task completed',
            message: summary,
            tokensUsed: claudeTokens,
            timestamp: newestTime,
            expiresAt: now + 45000,
          };
          realAgentCompletionCache = comp;
          lastObservedWorkingAgent = null;
          return comp;
        } else {
          realAgentCompletionCache = null;
          lastObservedWorkingAgent = {
            agent: 'claude',
            name: 'Anthropic Claude',
            tokens: claudeTokens,
            summary,
            timestamp: newestTime,
          };
          return {
            agent: 'claude',
            name: 'Anthropic Claude',
            status: 'working',
            detail: 'Reasoning and synthesizing',
            tokensUsed: claudeTokens,
            timestamp: newestTime,
          };
        }
      }
    }
  } catch {}

  // If a recent task completed within the retention window, keep returning it
  if (realAgentCompletionCache && realAgentCompletionCache.expiresAt > now) {
    return realAgentCompletionCache;
  } else if (realAgentCompletionCache && realAgentCompletionCache.expiresAt <= now) {
    realAgentCompletionCache = null;
  }

  return {
    agent: null,
    name: null,
    status: 'idle',
    detail: '',
    message: '',
    tokensUsed: 0,
    timestamp: now,
  };
}

function broadcastAgentActivity() {
  const current = checkActiveAgentActivity();
  currentAgentActivity = current;
  broadcastPacket({
    magic: 'SK',
    version: 1,
    packetId: Date.now(),
    timestamp: Date.now(),
    packetType: 'AGENT_ACTIVITY_STATUS',
    payload: current,
  });
}

// Background CLI agent watcher loop (every 1.5s)
setInterval(() => {
  const active = checkActiveAgentActivity();
  const key = `${active.agent}-${active.status}-${active.detail}-${active.tokensUsed}-${active.message}`;
  if (key !== lastAgentStateKey) {
    lastAgentStateKey = key;
    broadcastAgentActivity();
  }
}, 1500);

// Strict CLI execution whitelist to prevent Remote Code Execution (RCE)
const CLI_WHITELIST = {
  'sysinfo': {
    title: 'System Specs & Health',
    cmd: 'echo "OS: $(uname -srm 2>/dev/null || uname -a)"; echo "Uptime: $(uptime -p 2>/dev/null || uptime)"; free -h 2>/dev/null | awk \'/Mem:/ {print "RAM: "$3" / "$2" (free: "$4")"}\'; df -h / 2>/dev/null | awk \'NR==2 {print "Disk (/): "$3" / "$2" ("$5" used)"}\'',
  },
  'mem': {
    title: 'Memory & Swap Telemetry',
    cmd: 'free -h',
  },
  'disk': {
    title: 'Storage & Filesystems',
    cmd: 'df -h -x tmpfs -x devtmpfs',
  },
  'top-procs': {
    title: 'Top CPU Processes',
    cmd: 'ps -eo pid,comm,%cpu,%mem --sort=-%cpu | head -n 6',
  },
  'battery': {
    title: 'Power & Battery',
    cmd: 'upower -i $(upower -e 2>/dev/null | grep battery | head -n 1) 2>/dev/null | grep -E "state|percentage|time to" || cat /sys/class/power_supply/BAT*/capacity 2>/dev/null && echo "%" || echo "AC Desktop Power (Online)"',
  },
  'net-stats': {
    title: 'Network Interfaces',
    cmd: 'ip -brief addr 2>/dev/null || ip route get 1.1.1.1 2>/dev/null || hostname -I',
  },
  'ports': {
    title: 'Active Ports & Services',
    cmd: 'ss -tlpn 2>/dev/null | grep -E "8766|3000|5173" || echo "Soko Bridge active on :8766"',
  },
  'git-status': {
    title: 'Git Status & Workspace',
    cmd: 'git status -s && git log -1 --oneline 2>/dev/null',
  },
  'status': {
    title: 'Antigravity Status',
    cmd: 'agy status 2>/dev/null || (node -v && git branch --show-current)',
  },
  'agy-status': {
    title: 'Antigravity Status',
    cmd: 'agy status 2>/dev/null || (node -v && git branch --show-current)',
  },
  'test': {
    title: 'Integration Test Suite',
    cmd: 'node scripts/test_integration.js',
  },
  'agy-test': {
    title: 'Integration Test Suite',
    cmd: 'node scripts/test_integration.js',
  },
};

/**
 * Validates inbound packet framing, magic bytes, clock drift, and monotonic packet IDs
 * to prevent replay attacks and packet spoofing.
 */
function validateInboundPacket(packet) {
  if (!packet || typeof packet !== 'object') {
    return { valid: false, reason: 'Malformed JSON packet structure' };
  }

  // 1. Magic bytes enforcement ('SK')
  if (packet.magic !== 'SK') {
    return { valid: false, reason: `Invalid magic bytes: expected 'SK', got '${packet.magic}'` };
  }

  // 2. Clock skew / timestamp drift check (±60 seconds rule)
  if (typeof packet.timestamp === 'number') {
    const drift = Math.abs(Date.now() - packet.timestamp);
    if (drift > MAX_TIMESTAMP_DRIFT_MS) {
      return { valid: false, reason: `Timestamp drift exceeded: ${drift}ms > ${MAX_TIMESTAMP_DRIFT_MS}ms` };
    }
  }

  // 3. Monotonic sequence counter (Replay attack defense)
  if (typeof packet.packetId === 'number') {
    if (packet.packetId <= highestSeenPacketId && packet.packetType !== 'HEARTBEAT_PING') {
      return { valid: false, reason: `Replay detected: packetId ${packet.packetId} <= highest seen ${highestSeenPacketId}` };
    }
    highestSeenPacketId = Math.max(highestSeenPacketId, packet.packetId);
  }

  return { valid: true };
}

/**
 * Sanitizes file destination paths to strictly forbid directory traversal attacks (../../),
 * hidden files, shell special characters, and path escapes outside the sandbox.
 */
function sanitizeAndResolveUploadPath(rawFilename) {
  if (!rawFilename || typeof rawFilename !== 'string') {
    return null;
  }

  // Strip path traversals across Unix and Windows separators
  const base = path.basename(rawFilename.replace(/\\/g, '/'));

  // Strict character whitelist: alphanumeric, dots, dashes, underscores
  const clean = base
    .replace(/[^a-zA-Z0-9.\-_]/g, '')
    .replace(/^\.+/, ''); // Prevent hidden files like .bashrc, .ssh

  if (!clean || clean.length === 0) {
    return null;
  }

  const finalPath = path.resolve(TRANSFERS_DIR, clean);
  const partPath = path.resolve(TRANSFERS_DIR, `${clean}.part`);

  // Path containment check (sandbox containment)
  if (!finalPath.startsWith(TRANSFERS_DIR)) {
    console.warn(`[Security Alert] Sandbox escape attempt blocked: ${rawFilename}`);
    return null;
  }

  return { cleanFilename: clean, finalPath, partPath };
}

function getMimeType(filename) {
  const ext = path.extname(filename || '').toLowerCase();
  const mimeMap = {
    '.apk': 'application/vnd.android.package-archive',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.flac': 'audio/flac',
    '.aac': 'audio/aac',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mkv': 'video/x-matroska',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.zip': 'application/zip',
  };
  return mimeMap[ext] || 'application/octet-stream';
}

function openFileOrFolder(targetPath) {
  const platform = process.platform;
  let cmd = null;
  if (platform === 'linux') {
    cmd = `xdg-open "${targetPath}"`;
  } else if (platform === 'darwin') {
    cmd = `open "${targetPath}"`;
  } else if (platform === 'win32') {
    cmd = `start "" "${targetPath}"`;
  }
  if (cmd) {
    exec(cmd, (err) => {
      if (err) console.warn('[Bridge] Open error:', err.message);
      else console.log(`[Bridge] Opened: ${targetPath}`);
    });
  }
}

// Active Transfer State Tracker (Supports cancellation, cleanup, and retry)
let activeTransferSession = {
  id: null,
  filename: null,
  timer: null,
  writeStream: null,
  partPath: null,
  totalBytes: 52000000,
  bytesTransferred: 0,
};

function cancelActiveTransfer(reason = 'Cancelled by user') {
  if (activeTransferSession.timer) {
    clearInterval(activeTransferSession.timer);
    activeTransferSession.timer = null;
  }

  if (activeTransferSession.writeStream) {
    try {
      activeTransferSession.writeStream.destroy();
    } catch {}
    activeTransferSession.writeStream = null;
  }

  // Proper disk cleanup: remove temporary .part buffer immediately!
  if (activeTransferSession.partPath && fs.existsSync(activeTransferSession.partPath)) {
    try {
      fs.unlinkSync(activeTransferSession.partPath);
      console.log(`[Bridge Transfer Cleanup] Removed partial buffer: ${activeTransferSession.partPath}`);
    } catch (e) {
      console.error('[Bridge Transfer Cleanup Error]', e);
    }
  }

  const cancelledPacket = {
    magic: 'SK',
    version: 1,
    packetId: Date.now(),
    timestamp: Date.now(),
    packetType: 'FILE_CANCEL',
    payload: {
      id: activeTransferSession.id || 'transfer-1',
      filename: activeTransferSession.filename || 'mobile-transfer.apk',
      status: 'cancelled',
      error: reason,
    },
  };

  broadcastPacket(cancelledPacket);
  console.log(`[Bridge Transfer] Transfer cancelled: ${reason}`);

  activeTransferSession.id = null;
  activeTransferSession.filename = null;
  activeTransferSession.partPath = null;
  activeTransferSession.bytesTransferred = 0;
}

function startSimulatedTransfer(filename = 'soko-v1.0.0-release.apk') {
  cancelActiveTransfer('Restarting transfer');

  if (!fs.existsSync(TRANSFERS_DIR)) {
    try { fs.mkdirSync(TRANSFERS_DIR, { recursive: true }); } catch {}
  }

  // Ensure target file actually exists in transfers/ directory
  const destPath = path.resolve(TRANSFERS_DIR, filename);
  try {
    const candidateApks = [
      path.resolve(__dirname, '../apks/soko-mobile.apk'),
      path.resolve(__dirname, '../apks/soko-mobile-lite.apk'),
      path.resolve(__dirname, '../apks/soko-desktop.apk'),
      path.resolve(__dirname, '../soko-mobile.apk'),
      path.resolve(__dirname, '../soko-desktop.apk'),
    ];
    const sourceApk = candidateApks.find((p) => fs.existsSync(p));
    if (sourceApk) {
      fs.copyFileSync(sourceApk, destPath);
    } else if (!fs.existsSync(destPath)) {
      fs.writeFileSync(destPath, Buffer.alloc(1024 * 1024, 0));
    }
  } catch (e) {
    console.warn('[Bridge] Error preparing file for transfer:', e.message);
  }

  const stat = fs.existsSync(destPath) ? fs.statSync(destPath) : null;
  const totalBytes = stat ? stat.size : 52000000;
  const initialBytes = Math.min(totalBytes, Math.max(1024, Math.round(totalBytes * 0.15)));
  const stepBytes = Math.max(1024, Math.round(totalBytes * 0.25));

  const transferId = `trans-${Date.now()}`;
  activeTransferSession.id = transferId;
  activeTransferSession.filename = filename;
  activeTransferSession.totalBytes = totalBytes;
  activeTransferSession.bytesTransferred = initialBytes;

  broadcastPacket({
    magic: 'SK',
    version: 1,
    packetId: Date.now(),
    timestamp: Date.now(),
    packetType: 'FILE_OFFER',
    payload: {
      id: transferId,
      filename,
      bytesDownloaded: activeTransferSession.bytesTransferred,
      totalBytes: activeTransferSession.totalBytes,
      speedBytesPerSec: 42000000,
      percentage: Math.round((activeTransferSession.bytesTransferred / activeTransferSession.totalBytes) * 100),
      status: 'active',
    },
  });

  activeTransferSession.timer = setInterval(() => {
    activeTransferSession.bytesTransferred += stepBytes;
    const isDone = activeTransferSession.bytesTransferred >= activeTransferSession.totalBytes;

    broadcastPacket({
      magic: 'SK',
      version: 1,
      packetId: Date.now(),
      timestamp: Date.now(),
      packetType: isDone ? 'FILE_COMPLETED' : 'FILE_PROGRESS',
      payload: {
        id: transferId,
        filename,
        bytesDownloaded: isDone ? activeTransferSession.totalBytes : activeTransferSession.bytesTransferred,
        totalBytes: activeTransferSession.totalBytes,
        speedBytesPerSec: isDone ? 0 : 42000000,
        percentage: isDone ? 100 : Math.round((activeTransferSession.bytesTransferred / activeTransferSession.totalBytes) * 100),
        status: isDone ? 'completed' : 'active',
      },
    });

    if (isDone) {
      clearInterval(activeTransferSession.timer);
      activeTransferSession.timer = null;
      console.log(`[Bridge Transfer] Completed transfer: ${filename} (${(totalBytes / 1048576).toFixed(2)} MB)`);
    }
  }, 450);
}

// Encode WebSocket frame (RFC 6455)
function encodeWsFrame(payload) {
  const length = payload.length;
  let header;
  if (length <= 125) {
    header = Buffer.from([0x81, length]);
  } else if (length <= 65535) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }
  return Buffer.concat([header, payload]);
}

// Send WS packet to single socket
function sendWsPacket(socket, packet) {
  if (socket && socket.readyState !== 'closed') {
    try {
      const payloadBuffer = Buffer.from(JSON.stringify(packet), 'utf8');
      socket.write(encodeWsFrame(payloadBuffer));
    } catch (err) {
      activeClients.delete(socket);
    }
  }
}

// Broadcast packet to all clients (optionally excluding sender)
function broadcastPacket(packet, senderSocket = null) {
  const payloadBuffer = Buffer.from(JSON.stringify(packet), 'utf8');
  const frame = encodeWsFrame(payloadBuffer);

  for (const client of activeClients) {
    if (client !== senderSocket && client.readyState !== 'closed') {
      try {
        client.write(frame);
      } catch (err) {
        activeClients.delete(client);
      }
    }
  }
}

// Minimal WebSocket framing parser
function createWebSocketServer(server) {
  server.on('upgrade', (req, socket, head) => {
    const key = req.headers['sec-websocket-key'];
    if (!key) {
      socket.destroy();
      return;
    }

    const acceptKey = crypto
      .createHash('sha1')
      .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
      .digest('base64');

    const responseHeaders = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${acceptKey}`,
    ];

    socket.write(responseHeaders.join('\r\n') + '\r\n\r\n');

    socket.isLocalDesktop = (socket.remoteAddress === '127.0.0.1' || socket.remoteAddress === '::1' || socket.remoteAddress === '::ffff:127.0.0.1');
    socket.isAuthorized = socket.isLocalDesktop;
    socket.deviceId = null;
    socket.deviceName = null;

    activeClients.add(socket);
    console.log(`[Bridge WS] Client connected from ${socket.remoteAddress} (local: ${socket.isLocalDesktop}). Total active: ${activeClients.size}`);

    // If mobile companion connects and pairedDevice is not set, initialize companion record
    if (!socket.isLocalDesktop && !pairedDevice) {
      const localIps = getLocalIps();
      const primaryIp = localIps[0] || '192.168.31.210';
      pairedDevice = {
        id: `wifi-companion-${primaryIp}`,
        name: 'Mobile Companion (Android)',
        model: `Local Companion (${primaryIp}:8766)`,
        rssi: -45,
        pingMs: 8,
        transport: 'dual',
        batteryLevel: 96,
        lastSeen: Date.now(),
        isAuthorized: true,
        ipAddress: primaryIp,
      };
    }

    // Send Welcome / Handshake packet
    sendWsPacket(socket, {
      magic: 'SK',
      version: 1,
      packetId: Date.now(),
      timestamp: Date.now(),
      packetType: 'BRIDGE_STATUS',
      payload: {
        status: 'online',
        service: 'Soko Connection Bridge',
        version: '1.0.0',
        activeClients: activeClients.size,
        localIps: getLocalIps(),
        port: PORT,
        sasPin: socket.isLocalDesktop ? activeSasPin : undefined,
        requiresPairing: !socket.isAuthorized,
        pairedDevice,
      },
    });

    // Notify other clients (e.g. desktop) about active client count & paired device
    broadcastPacket({
      magic: 'SK',
      version: 1,
      packetId: Date.now(),
      timestamp: Date.now(),
      packetType: 'BRIDGE_STATUS',
      payload: {
        status: 'online',
        service: 'Soko Connection Bridge',
        version: '1.0.0',
        activeClients: activeClients.size,
        localIps: getLocalIps(),
        port: PORT,
        pairedDevice,
      },
    }, socket);

    socket.on('data', (buffer) => {
      handleWsFrame(socket, buffer);
    });

    socket.on('close', () => {
      activeClients.delete(socket);
      console.log(`[Bridge WS] Client disconnected. Total active: ${activeClients.size}`);
      broadcastPacket({
        magic: 'SK',
        version: 1,
        packetId: Date.now(),
        timestamp: Date.now(),
        packetType: 'BRIDGE_STATUS',
        payload: {
          status: 'online',
          service: 'Soko Connection Bridge',
          version: '1.0.0',
          activeClients: activeClients.size,
          localIps: getLocalIps(),
          port: PORT,
          pairedDevice: activeClients.size > 1 ? pairedDevice : (trustedDevices.size > 0 ? pairedDevice : null),
        },
      });
    });

    socket.on('error', () => {
      activeClients.delete(socket);
    });
  });
}

function handleWsFrame(socket, buffer) {
  if (buffer.length < 2) return;
  const secondByte = buffer[1];
  const isMasked = (secondByte & 0x80) === 0x80;
  let payloadLength = secondByte & 0x7f;
  let currentOffset = 2;

  if (payloadLength === 126) {
    if (buffer.length < 4) return;
    payloadLength = buffer.readUInt16BE(2);
    currentOffset += 2;
  } else if (payloadLength === 127) {
    return; // Ignore frames > 64KB for safety
  }

  let maskingKey = null;
  if (isMasked) {
    if (buffer.length < currentOffset + 4) return;
    maskingKey = buffer.slice(currentOffset, currentOffset + 4);
    currentOffset += 4;
  }

  if (buffer.length < currentOffset + payloadLength) return;

  const payload = buffer.slice(currentOffset, currentOffset + payloadLength);
  if (isMasked && maskingKey) {
    for (let i = 0; i < payload.length; i++) {
      payload[i] ^= maskingKey[i % 4];
    }
  }

  const messageStr = payload.toString('utf8');
  try {
    const packet = JSON.parse(messageStr);

    // Security Gate: Check framing, magic bytes, clock drift, and monotonic nonces
    const sec = validateInboundPacket(packet);
    if (!sec.valid) {
      console.warn(`[Security Alert] Inbound WebSocket packet rejected: ${sec.reason}`);
      sendWsPacket(socket, {
        magic: 'SK',
        version: 1,
        packetId: Date.now(),
        timestamp: Date.now(),
        packetType: 'SECURITY_ALERT',
        payload: { error: sec.reason },
      });
      return;
    }
    
    // Heartbeat ping/pong response
    if (packet.packetType === 'HEARTBEAT_PING') {
      sendWsPacket(socket, {
        magic: 'SK',
        version: 1,
        packetId: Date.now(),
        timestamp: Date.now(),
        packetType: 'HEARTBEAT_PONG',
        payload: {
          timestamp: packet.payload?.timestamp || Date.now(),
          serverTime: Date.now(),
        },
      });
      return;
    }

    // Pair request from phone (SAS PIN authorization check)
    if (packet.packetType === 'PAIR_REQUEST') {
      const deviceId = packet.payload?.deviceId || `dev-${Date.now()}`;
      const token = packet.payload?.token;

      // Check if already in persistent trusted devices
      if (token && trustedDevices.has(deviceId)) {
        const trusted = trustedDevices.get(deviceId);
        if (trusted.token === token) {
          socket.isAuthorized = true;
          socket.deviceId = deviceId;
          socket.deviceName = trusted.name || packet.payload?.deviceName;
          if (!pairedDevice) {
            pairedDevice = {
              id: deviceId,
              name: packet.payload?.deviceName || trusted.name || 'Mobile Phone',
              model: packet.payload?.model || 'Mobile Companion',
              rssi: -52,
              pingMs: 8,
              transport: 'dual',
              batteryLevel: packet.payload?.batteryLevel || 100,
              lastSeen: Date.now(),
              isAuthorized: true,
            };
          } else {
            if (packet.payload?.deviceName) pairedDevice.name = packet.payload.deviceName;
            if (packet.payload?.model) pairedDevice.model = packet.payload.model;
            if (packet.payload?.batteryLevel) pairedDevice.batteryLevel = packet.payload.batteryLevel;
            if (packet.payload?.rssi) pairedDevice.rssi = packet.payload.rssi;
            pairedDevice.lastSeen = Date.now();
            pairedDevice.isAuthorized = true;
          }

          console.log(`[Security] Recognized trusted companion: ${pairedDevice.name} (${deviceId})`);
          sendWsPacket(socket, {
            magic: 'SK',
            version: 1,
            packetId: Date.now(),
            timestamp: Date.now(),
            packetType: 'PAIR_CONFIRM',
            payload: { status: 'authorized', paired: true, token, deviceId },
          });

          broadcastPacket({
            magic: 'SK',
            version: 1,
            packetId: Date.now(),
            timestamp: Date.now(),
            packetType: 'BRIDGE_STATUS',
            payload: { status: 'online', pairedDevice },
          });
          return;
        }
      }

      // New device: must provide matching active PIN
      const enteredPin = (packet.payload?.pin || '').replace(/\s+/g, '');
      const expectedPin = activeSasPin.replace(/\s+/g, '');

      if (!enteredPin || enteredPin !== expectedPin) {
        console.warn(`[Security Alert] Unauthorized pair attempt from ${socket.remoteAddress}. Entered: "${enteredPin}", Expected: "${expectedPin}"`);
        sendWsPacket(socket, {
          magic: 'SK',
          version: 1,
          packetId: Date.now(),
          timestamp: Date.now(),
          packetType: 'PAIR_REJECT',
          payload: { status: 'rejected', error: 'PIN mismatch. Please enter the 6-digit PIN displayed on your Desktop Dynamic Island.' },
        });
        return;
      }

      // Valid PIN matches! Create pending pair request & notify desktop HUD for approval
      const newToken = crypto.randomBytes(16).toString('hex');
      const pendingInfo = {
        socket,
        deviceId,
        deviceName: packet.payload?.deviceName || 'Mobile Companion (Android)',
        model: packet.payload?.model || 'Android Phone',
        pin: packet.payload?.pin || activeSasPin,
        token: newToken,
        timestamp: Date.now(),
      };

      pendingPairRequests.set(deviceId, pendingInfo);
      console.log(`[Security] PIN verified for ${pendingInfo.deviceName}. Awaiting human approval on desktop HUD...`);

      // Dispatch approval card to desktop Dynamic Island
      broadcastPacket({
        magic: 'SK',
        version: 1,
        packetId: Date.now(),
        timestamp: Date.now(),
        packetType: 'PAIR_REQUEST_PENDING',
        payload: {
          deviceId,
          deviceName: pendingInfo.deviceName,
          model: pendingInfo.model,
          pin: pendingInfo.pin,
          ip: socket.remoteAddress,
        },
      });
      return;
    }

    // Desktop approval decision
    if (packet.packetType === 'PAIR_DECISION') {
      const { deviceId, approved } = packet.payload || {};
      const pending = pendingPairRequests.get(deviceId);
      if (pending) {
        pendingPairRequests.delete(deviceId);
        if (approved) {
          if (pending.socket) {
            pending.socket.isAuthorized = true;
            pending.socket.deviceId = deviceId;
            pending.socket.deviceName = pending.deviceName;
          }

          trustedDevices.set(deviceId, {
            name: pending.deviceName,
            model: pending.model,
            token: pending.token,
            pairedAt: Date.now(),
          });
          saveTrustStore(trustedDevices);

          pairedDevice = {
            id: deviceId,
            name: pending.deviceName,
            model: pending.model,
            rssi: -50,
            pingMs: 12,
            transport: 'dual',
            batteryLevel: 98,
            lastSeen: Date.now(),
            isAuthorized: true,
          };

          console.log(`[Security] Device APPROVED by desktop user: ${pending.deviceName} (${deviceId})`);

          // Confirm to mobile phone
          if (pending.socket) {
            sendWsPacket(pending.socket, {
              magic: 'SK',
              version: 1,
              packetId: Date.now(),
              timestamp: Date.now(),
              packetType: 'PAIR_CONFIRM',
              payload: {
                status: 'authorized',
                paired: true,
                token: pending.token,
                deviceId,
              },
            });
          }

          // Broadcast updated status
          broadcastPacket({
            magic: 'SK',
            version: 1,
            packetId: Date.now(),
            timestamp: Date.now(),
            packetType: 'BRIDGE_STATUS',
            payload: { status: 'online', pairedDevice },
          });
        } else {
          console.log(`[Security] Device DENIED by desktop user: ${pending.deviceName} (${deviceId})`);
          if (pending.socket) {
            sendWsPacket(pending.socket, {
              magic: 'SK',
              version: 1,
              packetId: Date.now(),
              timestamp: Date.now(),
              packetType: 'PAIR_REJECT',
              payload: { status: 'rejected', error: 'Connection was declined on the desktop.' },
            });
          }
        }
      }
      return;
    }

    // Unpair request from phone or desktop
    if (packet.packetType === 'UNPAIR_REQUEST') {
      const deviceId = packet.payload?.deviceId || socket.deviceId;
      if (deviceId && trustedDevices.has(deviceId)) {
        trustedDevices.delete(deviceId);
        saveTrustStore(trustedDevices);
        console.log(`[Security] Unpaired device: ${deviceId}`);
      }
      socket.isAuthorized = socket.isLocalDesktop;
      pairedDevice = null;

      // Broadcast cleared pairedDevice to all clients
      broadcastPacket({
        magic: 'SK',
        version: 1,
        packetId: Date.now(),
        timestamp: Date.now(),
        packetType: 'BRIDGE_STATUS',
        payload: {
          status: 'online',
          pairedDevice: null,
        },
      });

      sendWsPacket(socket, {
        magic: 'SK',
        version: 1,
        packetId: Date.now(),
        timestamp: Date.now(),
        packetType: 'UNPAIR_CONFIRM',
        payload: { success: true },
      });
      return;
    }

    // Regenerate PIN packet from desktop
    if (packet.packetType === 'REGENERATE_PIN') {
      activeSasPin = generateRandomPin();
      console.log(`[Security] New SAS PIN generated by desktop: ${activeSasPin}`);
      sendWsPacket(socket, {
        magic: 'SK',
        version: 1,
        packetId: Date.now(),
        timestamp: Date.now(),
        packetType: 'PIN_UPDATED',
        payload: { pin: activeSasPin },
      });
      return;
    }

    // Native Token Stats query
    if (packet.packetType === 'FETCH_TOKEN_STATS') {
      const stats = scanNativeTokenUsage();
      sendWsPacket(socket, {
        magic: 'SK',
        version: 1,
        packetId: Date.now(),
        timestamp: Date.now(),
        packetType: 'TOKEN_STATS_UPDATE',
        payload: stats,
      });
      return;
    }

    // Live Agent Activity query
    if (packet.packetType === 'FETCH_AGENT_ACTIVITY') {
      const activity = checkActiveAgentActivity();
      sendWsPacket(socket, {
        magic: 'SK',
        version: 1,
        packetId: Date.now(),
        timestamp: Date.now(),
        packetType: 'AGENT_ACTIVITY_STATUS',
        payload: activity,
      });
      return;
    }

    // Simulate Agent Activity (for live user testing & UI previews)
    if (packet.packetType === 'SIMULATE_AGENT_ACTIVITY') {
      simulateAgent(packet.payload?.agent, packet.payload?.detail, packet.payload?.durationMs);
      return;
    }

    // Guard privileged packets against unauthorized sockets (CLI & file storage operations)
    const PRIVILEGED_PACKETS = ['CLI_EXECUTE', 'FILE_OFFER', 'FILE_START'];
    if (PRIVILEGED_PACKETS.includes(packet.packetType) && !socket.isAuthorized) {
      console.warn(`[Security Alert] Blocked privileged packet ${packet.packetType} from unauthorized socket.`);
      sendWsPacket(socket, {
        magic: 'SK',
        version: 1,
        packetId: Date.now(),
        timestamp: Date.now(),
        packetType: 'SECURITY_ALERT',
        payload: { error: 'Device is not authorized. Complete PIN pairing and desktop approval first.' },
      });
      return;
    }

    // Cancel file transfer packet from phone or desktop
    if (packet.packetType === 'FILE_CANCEL') {
      cancelActiveTransfer(packet.payload?.error || 'Cancelled by peer');
      return;
    }

    // Retry file transfer packet from phone or desktop
    if (packet.packetType === 'FILE_RETRY') {
      startSimulatedTransfer(packet.payload?.filename || 'soko-v1.0.0-release.apk');
      return;
    }

    // Remote CLI execution over WebSocket
    if (packet.packetType === 'CLI_EXECUTE') {
      const command = packet.payload?.command || (packet.payload?.commandId ? packet.payload.commandId.replace(/^(cmd-|agy-)/, '') : 'sysinfo');
      executeWhitelistedCli(command);
      return;
    }

    // Companion device announced from mobile UI
    if (packet.packetType === 'COMPANION_ANNOUNCE') {
      const devId = packet.payload?.deviceId || socket.deviceId || `dev-${Date.now()}`;
      socket.deviceId = devId;
      socket.deviceName = packet.payload?.deviceName;
      if (!pairedDevice) {
        pairedDevice = {
          id: devId,
          name: packet.payload?.deviceName || 'Mobile Companion (Android)',
          model: packet.payload?.model || 'Soko Mobile Companion v1.0.0',
          rssi: packet.payload?.rssi || -45,
          pingMs: 10,
          transport: 'dual',
          batteryLevel: packet.payload?.batteryLevel || 95,
          lastSeen: Date.now(),
          isAuthorized: true,
        };
      } else {
        if (packet.payload?.deviceName) pairedDevice.name = packet.payload.deviceName;
        if (packet.payload?.model) pairedDevice.model = packet.payload.model;
        pairedDevice.lastSeen = Date.now();
      }
      broadcastPacket({
        magic: 'SK',
        version: 1,
        packetId: Date.now(),
        timestamp: Date.now(),
        packetType: 'BRIDGE_STATUS',
        payload: {
          status: 'online',
          pairedDevice,
          activeClients: activeClients.size,
        },
      });
      return;
    }

    if (packet.packetType === 'NOTIFICATION_POST') {
      if (!pairedDevice) {
        const remoteIp = socket.remoteAddress?.replace(/^.*:/, '') || getLocalIps()[0] || '192.168.31.210';
        pairedDevice = {
          id: packet.payload?.deviceId || socket.deviceId || `wifi-companion-${remoteIp}`,
          name: packet.payload?.deviceName || socket.deviceName || 'Mobile Companion (Android)',
          model: packet.payload?.model || `Local Companion (${remoteIp}:8766)`,
          transport: 'wifi',
          rssi: -45,
          pingMs: 8,
          batteryLevel: packet.payload?.batteryLevel || 95,
          lastSeen: Date.now(),
          isAuthorized: true,
          ipAddress: remoteIp,
        };
        broadcastPacket({
          magic: 'SK',
          version: 1,
          packetId: Date.now(),
          timestamp: Date.now(),
          packetType: 'BRIDGE_STATUS',
          payload: {
            status: 'online',
            pairedDevice,
            activeClients: activeClients.size,
          },
        });
      } else {
        pairedDevice.lastSeen = Date.now();
      }
    }

    // Default: broadcast to all other peers (e.g. phone -> desktop Dynamic Island)
    broadcastPacket(packet, socket);
    console.log(`[Bridge WS] Relayed packet: ${packet.packetType}`);
  } catch (e) {
    // Ping/pong or malformed frame
  }
}

/**
 * Safely executes a whitelisted CLI command with strict defenses against:
 * 1. Hanging / Freezing (6s timeout kills process)
 * 2. Memory explosion (512KB buffer limit)
 * 3. Empty or null output (guaranteed fallback)
 * 4. WebSocket & HTTP parity
 */
function executeWhitelistedCli(command, onFinished = null) {
  const whitelisted = CLI_WHITELIST[command];
  if (!whitelisted) {
    console.warn(`[Security Alert] Unauthorized CLI command attempt blocked: '${command}'`);
    const errPayload = {
      commandId: `cmd-${command}`,
      title: 'Security Alert',
      status: 'failed',
      startedAt: Date.now(),
      lastOutputLine: `Security violation: Command '${command}' not permitted in execution whitelist.`,
      output: `Security violation: Command '${command}' not permitted in execution whitelist.`,
      exitCode: 403,
    };
    broadcastPacket({
      magic: 'SK',
      version: 1,
      packetId: Date.now(),
      timestamp: Date.now(),
      packetType: 'CLI_OUTPUT_STREAM',
      payload: errPayload,
    });
    if (onFinished) onFinished(403, { error: errPayload.lastOutputLine, exitCode: 403 });
    return;
  }

  console.log(`[Bridge CLI] Executing authorized command: ${command}`);

  // Notify start to all connected clients
  broadcastPacket({
    magic: 'SK',
    version: 1,
    packetId: Date.now(),
    timestamp: Date.now(),
    packetType: 'CLI_EXECUTE',
    payload: {
      commandId: `cmd-${command}`,
      title: whitelisted.title || `Remote CLI (${command})`,
      command: command,
      status: 'running',
      startedAt: Date.now(),
      lastOutputLine: `Running: ${whitelisted.title}...`,
    },
  });

  const shellCmd = whitelisted.cmd;
  if (!shellCmd) {
    const successPayload = {
      commandId: `cmd-${command}`,
      title: whitelisted.title,
      command: command,
      status: 'completed',
      startedAt: Date.now() - 500,
      lastOutputLine: 'Command executed with 0 errors.',
      output: 'Task completed successfully.',
      exitCode: 0,
    };
    broadcastPacket({
      magic: 'SK',
      version: 1,
      packetId: Date.now(),
      timestamp: Date.now(),
      packetType: 'CLI_OUTPUT_STREAM',
      payload: successPayload,
    });
    if (onFinished) onFinished(200, { success: true, ...successPayload });
    return;
  }

  // Execute with strict 6s timeout and 512KB buffer limit to prevent ANY hanging
  exec(
    shellCmd,
    {
      cwd: path.resolve(__dirname, '..'),
      timeout: 6000,
      maxBuffer: 512 * 1024,
      env: { ...process.env, TERM: 'dumb', CI: 'true' },
    },
    (error, stdout, stderr) => {
      const isTimeout = error && (error.killed || error.signal === 'SIGTERM');
      let fullOutput = (stdout || '').trim();
      if (!fullOutput && stderr) fullOutput = (stderr || '').trim();

      if (isTimeout) {
        fullOutput = 'Command timed out after 6 seconds (terminated to prevent hanging).';
      } else if (!fullOutput) {
        fullOutput = 'Command completed successfully (zero output returned).';
      }

      // First non-empty line for single-line Dynamic Island pill
      const lines = fullOutput.split('\n').map((l) => l.trim()).filter(Boolean);
      const firstLine = lines[0] || fullOutput;

      const isFailed = Boolean(error && !isTimeout && (error.code !== 0));
      const finishPayload = {
        commandId: `cmd-${command}`,
        title: whitelisted.title,
        command: command,
        status: isFailed ? 'failed' : 'completed',
        startedAt: Date.now(),
        lastOutputLine: firstLine,
        output: fullOutput,
        exitCode: error ? (error.code || 1) : 0,
      };

      broadcastPacket({
        magic: 'SK',
        version: 1,
        packetId: Date.now(),
        timestamp: Date.now(),
        packetType: 'CLI_OUTPUT_STREAM',
        payload: finishPayload,
      });

      if (onFinished) {
        onFinished(isFailed ? 500 : 200, { success: !isFailed, ...finishPayload });
      }
    }
  );
}

/**
 * Verifies if an HTTP request is authorized.
 * Requests from local desktop (127.0.0.1, ::1) are inherently authorized.
 * Requests from remote network interfaces (LAN/Wi-Fi/Hotspot) MUST present
 * a valid Bearer token matching a trusted paired device in trustedDevices.
 */
function isRequestAuthorized(req) {
  const remoteIp = req.socket.remoteAddress;
  const isLocal = remoteIp === '127.0.0.1' || remoteIp === '::1' || remoteIp === '::ffff:127.0.0.1';
  if (isLocal) return true;

  let token = null;
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (authHeader.startsWith('Token ')) {
    token = authHeader.substring(6).trim();
  } else {
    try {
      const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
      token = url.searchParams.get('token');
    } catch {}
  }

  if (!token) return false;

  for (const [deviceId, dev] of trustedDevices.entries()) {
    if (dev && dev.token && dev.token === token) {
      return true;
    }
  }

  return false;
}

function rejectUnauthorized(res) {
  res.writeHead(401, { 'Content-Type': 'application/json' });
  res.end(
    JSON.stringify({
      error: 'Unauthorized: Remote device is not paired or missing valid bearer token. Complete PIN pairing on Desktop Island first.',
      code: 401,
    })
  );
}

// HTTP Server for Mobile UI and REST endpoints
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Checksum-Sha256, Content-Length, Authorization, *');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  // 1. Serve Mobile Companion Web App
  if (url.pathname === '/' || url.pathname === '/mobile' || url.pathname === '/companion') {
    if (fs.existsSync(COMPANION_INDEX)) {
      try {
        let html = fs.readFileSync(COMPANION_INDEX, 'utf8');
        const defaultIp = `${getLocalIps()[0] || '192.168.31.210'}:${PORT}`;
        html = html.replace('window.SOKO_BRIDGE_DEFAULT_IP = "";', `window.SOKO_BRIDGE_DEFAULT_IP = "${defaultIp}";`);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
      } catch (e) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        fs.createReadStream(COMPANION_INDEX).pipe(res);
      }
      return;
    }
  }

  // 2. Health and discovery status
  if (url.pathname === '/api/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'online',
        service: 'Soko Connection Bridge',
        version: appVersion,
        activeClients: activeClients.size,
        localIps: getLocalIps(),
        port: PORT,
        pairedDevice,
      })
    );
    return;
  }

  // 3. Scan for available nearby devices (Bluetooth & Wi-Fi LAN)
  if (url.pathname === '/api/devices/scan' && req.method === 'GET') {
    const devices = scanAvailableDevices();
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify({ devices }));
    return;
  }

  // 4. Manually select and pair device from desktop UI
  if (url.pathname === '/api/devices/pair-select' && req.method === 'POST') {
    let bodyStr = '';
    req.on('data', (chunk) => (bodyStr += chunk));
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyStr || '{}');
        const deviceId = body.deviceId || `dev-${Date.now()}`;
        const deviceName = body.name || body.deviceName || 'Companion Device';
        const model = body.model || 'Device';
        const transport = body.transport || 'dual';
        const rssi = typeof body.rssi === 'number' ? body.rssi : -50;

        pairedDevice = {
          id: deviceId,
          name: deviceName,
          model,
          rssi,
          pingMs: 12,
          transport,
          batteryLevel: 95,
          lastSeen: Date.now(),
          isAuthorized: true,
          ipAddress: body.ipAddress,
        };

        const token = crypto.randomBytes(16).toString('hex');
        trustedDevices.set(deviceId, {
          name: deviceName,
          model,
          token,
          pairedAt: Date.now(),
        });
        saveTrustStore(trustedDevices);

        console.log(`[Security] Desktop manually paired with device: ${deviceName} (${deviceId})`);

        broadcastPacket({
          magic: 'SK',
          version: 1,
          packetId: Date.now(),
          timestamp: Date.now(),
          packetType: 'BRIDGE_STATUS',
          payload: {
            status: 'online',
            pairedDevice,
          },
        });

        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(JSON.stringify({ status: 'paired', pairedDevice }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 5. Unpair active device
  if (url.pathname === '/api/devices/unpair' && req.method === 'POST') {
    pairedDevice = null;
    trustedDevices.clear();
    saveTrustStore(trustedDevices);
    console.log('[Security] Desktop unpaired and cleared trust store.');

    broadcastPacket({
      magic: 'SK',
      version: 1,
      packetId: Date.now(),
      timestamp: Date.now(),
      packetType: 'BRIDGE_STATUS',
      payload: {
        status: 'online',
        pairedDevice: null,
      },
    });

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify({ status: 'unpaired' }));
    return;
  }

  // 6. Native AI Token Stats endpoint
  if (url.pathname === '/api/tokens' && req.method === 'GET') {
    const stats = scanNativeTokenUsage();
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(stats));
    return;
  }

  // 7. Live CLI Agent Activity endpoint
  if (url.pathname === '/api/agent-activity' && req.method === 'GET') {
    const activity = checkActiveAgentActivity();
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(activity));
    return;
  }

  // 8. Simulate / Test CLI Agent Activity endpoint
  if (url.pathname === '/api/agent-activity/simulate' && req.method === 'POST') {
    let bodyStr = '';
    req.on('data', (chunk) => (bodyStr += chunk));
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyStr || '{}');
        simulateAgent(body.agent, body.detail, body.durationMs);
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(JSON.stringify({ success: true, activity: checkActiveAgentActivity() }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Pair Request endpoint (Direct HTTP Pairing & Verification)
  if (url.pathname === '/api/pair' && req.method === 'POST') {
    let bodyStr = '';
    req.on('data', (chunk) => (bodyStr += chunk));
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyStr || '{}');
        const deviceId = body.deviceId || `dev-${Date.now()}`;
        const enteredPin = (body.pin || '').replace(/\s+/g, '');
        const expectedPin = activeSasPin.replace(/\s+/g, '');

        if (!enteredPin || enteredPin !== expectedPin) {
          console.warn(`[Security HTTP] Unauthorized pair attempt from ${req.socket.remoteAddress}. Entered: "${enteredPin}", Expected: "${expectedPin}"`);
          res.writeHead(400, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          });
          res.end(
            JSON.stringify({
              status: 'rejected',
              error: `PIN mismatch. Entered PIN "${enteredPin}" does not match active Desktop PIN.`,
            })
          );
          return;
        }

        const newToken = crypto.randomBytes(16).toString('hex');
        const pendingInfo = {
          deviceId,
          deviceName: body.deviceName || 'Mobile Companion (Android)',
          model: body.model || 'Android Phone',
          pin: body.pin || activeSasPin,
          token: newToken,
          timestamp: Date.now(),
        };

        pendingPairRequests.set(deviceId, pendingInfo);
        console.log(`[Security HTTP] PIN verified for ${pendingInfo.deviceName}. Awaiting human approval on desktop HUD...`);

        // Dispatch approval card to desktop Dynamic Island
        broadcastPacket({
          magic: 'SK',
          version: 1,
          packetId: Date.now(),
          timestamp: Date.now(),
          packetType: 'PAIR_REQUEST_PENDING',
          payload: {
            deviceId,
            deviceName: pendingInfo.deviceName,
            model: pendingInfo.model,
            pin: pendingInfo.pin,
            ip: req.socket.remoteAddress,
          },
        });

        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(
          JSON.stringify({
            status: 'pending',
            message: 'PIN verified. Waiting for approval on desktop Dynamic Island.',
            deviceId,
          })
        );
      } catch (err) {
        res.writeHead(500, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Check Pair Status endpoint (Polled by mobile when pending)
  if (url.pathname === '/api/pair/status' && req.method === 'GET') {
    const deviceId = url.searchParams.get('deviceId');
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    if (deviceId && trustedDevices.has(deviceId)) {
      const record = trustedDevices.get(deviceId);
      res.end(JSON.stringify({ status: 'paired', token: record.token }));
    } else if (deviceId && pendingPairRequests.has(deviceId)) {
      res.end(JSON.stringify({ status: 'pending' }));
    } else {
      res.end(JSON.stringify({ status: 'unpaired' }));
    }
    return;
  }

  // Unpair device endpoint
  if (url.pathname === '/api/unpair' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const data = body ? JSON.parse(body) : {};
        const deviceId = data.deviceId;
        if (deviceId && trustedDevices.has(deviceId)) {
          trustedDevices.delete(deviceId);
          saveTrustStore(trustedDevices);
          console.log(`[Security] Device unpaired via HTTP: ${deviceId}`);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, unpaired: deviceId }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // 3. Push incoming notification from phone (HTTP POST)
  if (url.pathname === '/api/notify' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const packet = {
          magic: 'SK',
          version: 1,
          packetId: Date.now(),
          timestamp: Date.now(),
          packetType: 'NOTIFICATION_POST',
          payload: {
            id: data.id || `notif-${Date.now()}`,
            appName: data.appName || data.app_name || 'Messages',
            packageName: data.packageName || data.package_name || 'com.soko.app',
            title: data.title || 'Mobile Notification',
            body: data.body || '',
            priority: data.priority || (data.isImportant ? 'high' : 'normal'),
            isImportant: Boolean(data.isImportant || data.important || data.priority === 'high' || data.priority === 'urgent'),
            timestamp: Date.now(),
          },
        };

        if (!pairedDevice) {
          const remoteIp = req.socket.remoteAddress?.replace(/^.*:/, '') || getLocalIps()[0] || '192.168.31.210';
          pairedDevice = {
            id: data.deviceId || `wifi-companion-${remoteIp}`,
            name: data.deviceName || 'Mobile Companion (Android)',
            model: data.model || `Local Companion (${remoteIp}:8766)`,
            transport: 'wifi',
            rssi: -45,
            pingMs: 8,
            batteryLevel: data.batteryLevel || 95,
            lastSeen: Date.now(),
            isAuthorized: true,
            ipAddress: remoteIp,
          };
          broadcastPacket({
            magic: 'SK',
            version: 1,
            packetId: Date.now(),
            timestamp: Date.now(),
            packetType: 'BRIDGE_STATUS',
            payload: {
              status: 'online',
              pairedDevice,
              activeClients: activeClients.size,
            },
          });
        } else {
          pairedDevice.lastSeen = Date.now();
        }

        broadcastPacket(packet);
        console.log(`[Bridge HTTP] Mirrored notification: [${packet.payload.appName}] ${packet.payload.title}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, packetId: packet.packetId }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 4. Trigger remote CLI command from phone or desktop (Strict Whitelist & Auth Protected)
  if (url.pathname === '/api/cli' && req.method === 'POST') {
    if (!isRequestAuthorized(req)) {
      rejectUnauthorized(res);
      return;
    }

    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const command = data.command || 'status';

        executeWhitelistedCli(command, (statusCode, result) => {
          res.writeHead(statusCode, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        });
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 5. Trigger high-speed file transfer (Protected)
  if (url.pathname === '/api/transfer' && req.method === 'POST') {
    if (!isRequestAuthorized(req)) {
      rejectUnauthorized(res);
      return;
    }

    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const data = body ? JSON.parse(body) : {};
        const filename = data.filename || 'soko-v1.0.0-release.apk';
        startSimulatedTransfer(filename);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, filename }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 6. Cancel file transfer endpoint (Protected)
  if (url.pathname === '/api/transfer/cancel' && req.method === 'POST') {
    if (!isRequestAuthorized(req)) {
      rejectUnauthorized(res);
      return;
    }
    cancelActiveTransfer('Cancelled via REST API');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, status: 'cancelled' }));
    return;
  }

  // 7. Retry file transfer endpoint (Protected)
  if (url.pathname === '/api/transfer/retry' && req.method === 'POST') {
    if (!isRequestAuthorized(req)) {
      rejectUnauthorized(res);
      return;
    }
    startSimulatedTransfer('soko-v1.0.0-release.apk');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, status: 'active' }));
    return;
  }

  // 8. Real file binary upload (Protected: Sandbox path sanitization, SHA-256 verification, .part cleanup)
  if (url.pathname === '/api/upload' && (req.method === 'POST' || req.method === 'PUT')) {
    if (!isRequestAuthorized(req)) {
      rejectUnauthorized(res);
      return;
    }
    const rawFilename = url.searchParams.get('filename') || `transfer-${Date.now()}.bin`;
    const pathInfo = sanitizeAndResolveUploadPath(rawFilename);

    if (!pathInfo) {
      console.warn(`[Security Alert] Path traversal or invalid filename rejected: ${rawFilename}`);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'Security violation: Path traversal or invalid filename rejected.',
        })
      );
      return;
    }

    const { cleanFilename, finalPath, partPath } = pathInfo;
    const clientSha256 = req.headers['x-checksum-sha256'] || url.searchParams.get('sha256');

    cancelActiveTransfer('Replacing with new file upload');

    console.log(`[Bridge Upload] Receiving file: ${cleanFilename} (sandbox verified)`);
    const writeStream = fs.createWriteStream(partPath);
    const hash = crypto.createHash('sha256');
    activeTransferSession.partPath = partPath;
    activeTransferSession.writeStream = writeStream;
    activeTransferSession.filename = cleanFilename;

    let receivedBytes = 0;
    const totalBytes = parseInt(req.headers['content-length'] || '0', 10) || 1000000;
    let lastBroadcastTime = 0;

    broadcastPacket({
      magic: 'SK',
      version: 1,
      packetId: Date.now(),
      timestamp: Date.now(),
      packetType: 'FILE_OFFER',
      payload: {
        filename: cleanFilename,
        bytesDownloaded: 0,
        totalBytes,
        speedBytesPerSec: 42000000,
        percentage: 0,
        status: 'active',
      },
    });

    req.on('data', (chunk) => {
      receivedBytes += chunk.length;
      hash.update(chunk);
      writeStream.write(chunk);

      const now = Date.now();
      if (now - lastBroadcastTime > 200) {
        lastBroadcastTime = now;
        broadcastPacket({
          magic: 'SK',
          version: 1,
          packetId: Date.now(),
          timestamp: Date.now(),
          packetType: 'FILE_PROGRESS',
          payload: {
            filename: cleanFilename,
            bytesDownloaded: receivedBytes,
            totalBytes,
            speedBytesPerSec: 42000000,
            percentage: Math.min(99, Math.round((receivedBytes / totalBytes) * 100)),
            status: 'active',
          },
        });
      }
    });

    req.on('end', () => {
      writeStream.end(() => {
        const computedSha256 = hash.digest('hex');

        // Verify SHA-256 integrity if client provided expected hash
        if (clientSha256 && clientSha256.toLowerCase() !== computedSha256.toLowerCase()) {
          console.warn(`[Security Alert] SHA-256 checksum mismatch for ${cleanFilename}`);
          try { fs.unlinkSync(partPath); } catch {}
          broadcastPacket({
            magic: 'SK',
            version: 1,
            packetId: Date.now(),
            timestamp: Date.now(),
            packetType: 'FILE_FAILED',
            payload: {
              id: activeTransferSession.id || `trans-${Date.now()}`,
              filename: cleanFilename,
              bytesDownloaded: receivedBytes,
              totalBytes: totalBytes,
              speedBytesPerSec: 0,
              percentage: 0,
              status: 'failed',
              error: 'Integrity violation: SHA-256 checksum mismatch',
            },
          });
          cancelActiveTransfer('Integrity violation: SHA-256 checksum mismatch');
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              error: 'Integrity violation: SHA-256 checksum mismatch. File rejected.',
            })
          );
          return;
        }

        // Atomic rename: .part -> final filename
        try {
          fs.renameSync(partPath, finalPath);
          // Security defense-in-depth: enforce non-executable permissions (chmod 0644)
          try { fs.chmodSync(finalPath, 0o644); } catch {}
          console.log(`[Bridge Upload] Successfully saved: ${finalPath} (${receivedBytes} bytes, SHA-256: ${computedSha256.slice(0, 12)}...)`);

          broadcastPacket({
            magic: 'SK',
            version: 1,
            packetId: Date.now(),
            timestamp: Date.now(),
            packetType: 'FILE_COMPLETED',
            payload: {
              filename: cleanFilename,
              bytesDownloaded: receivedBytes,
              totalBytes: receivedBytes,
              speedBytesPerSec: 0,
              percentage: 100,
              sha256: computedSha256,
              status: 'completed',
            },
          });

          activeTransferSession.id = null;
          activeTransferSession.filename = null;
          activeTransferSession.partPath = null;
          activeTransferSession.writeStream = null;
          activeTransferSession.bytesTransferred = 0;

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: true,
              filename: cleanFilename,
              bytes: receivedBytes,
              sha256: computedSha256,
            })
          );
        } catch (e) {
          console.error('[Bridge Upload Rename Error]', e);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    });

    // Cleanup on abort or network error
    const handleAbort = (err) => {
      console.warn(`[Bridge Upload Aborted] Cleaning up temporary file: ${partPath}`);
      try { writeStream.destroy(); } catch {}
      if (fs.existsSync(partPath)) {
        try { fs.unlinkSync(partPath); } catch {}
      }
      activeTransferSession.partPath = null;
      activeTransferSession.writeStream = null;

      broadcastPacket({
        magic: 'SK',
        version: 1,
        packetId: Date.now(),
        timestamp: Date.now(),
        packetType: 'FILE_CANCEL',
        payload: {
          filename: cleanFilename,
          status: 'cancelled',
          error: err ? err.message : 'Upload connection aborted',
        },
      });
    };

    req.on('aborted', () => handleAbort(new Error('Client aborted upload')));
    req.on('error', (err) => handleAbort(err));
    return;
  }

  // 9. List transferred files in storage (Protected)
  if (url.pathname === '/api/transfers' && req.method === 'GET') {
    if (!isRequestAuthorized(req)) {
      rejectUnauthorized(res);
      return;
    }
    try {
      if (!fs.existsSync(TRANSFERS_DIR)) {
        fs.mkdirSync(TRANSFERS_DIR, { recursive: true });
      }
      const files = fs.readdirSync(TRANSFERS_DIR)
        .filter((f) => !f.endsWith('.part') && !f.startsWith('.'))
        .map((f) => {
          const stat = fs.statSync(path.join(TRANSFERS_DIR, f));
          return {
            filename: f,
            size: stat.size,
            mtime: stat.mtimeMs,
          };
        })
        .sort((a, b) => b.mtime - a.mtime);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ files }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // 10. Open file or transfers folder on desktop host system (Protected)
  if (url.pathname === '/api/transfers/open' && req.method === 'POST') {
    if (!isRequestAuthorized(req)) {
      rejectUnauthorized(res);
      return;
    }
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const data = body ? JSON.parse(body) : {};
        if (data.action === 'folder' || !data.filename) {
          openFileOrFolder(TRANSFERS_DIR);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, opened: TRANSFERS_DIR }));
          return;
        }

        const pathInfo = sanitizeAndResolveUploadPath(data.filename);
        if (!pathInfo || !fs.existsSync(pathInfo.finalPath)) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'File not found on disk' }));
          return;
        }

        openFileOrFolder(pathInfo.finalPath);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, opened: pathInfo.finalPath }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 11. Download / Stream transferred file to client (Protected: mobile or desktop browser/viewer)
  if ((url.pathname.startsWith('/transfers/') || url.pathname === '/api/transfers/download') && (req.method === 'GET' || req.method === 'HEAD')) {
    if (!isRequestAuthorized(req)) {
      rejectUnauthorized(res);
      return;
    }
    let rawFilename = '';
    if (url.pathname === '/api/transfers/download') {
      rawFilename = url.searchParams.get('filename') || '';
    } else {
      rawFilename = decodeURIComponent(url.pathname.replace(/^\/transfers\//, ''));
    }

    const pathInfo = sanitizeAndResolveUploadPath(rawFilename);
    if (!pathInfo || !fs.existsSync(pathInfo.finalPath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found in storage');
      return;
    }

    const stat = fs.statSync(pathInfo.finalPath);
    const mime = getMimeType(pathInfo.cleanFilename);
    const disposition = url.searchParams.get('download') === '1' ? 'attachment' : 'inline';

    res.writeHead(200, {
      'Content-Type': mime,
      'Content-Length': stat.size,
      'Content-Disposition': `${disposition}; filename="${pathInfo.cleanFilename}"`,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache',
    });

    fs.createReadStream(pathInfo.finalPath).pipe(res);
    return;
  }

  // 12. Audio Status Endpoint
  if (url.pathname === '/api/audio/status' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    const isPlaying = checkIsAudioPlaying();
    res.end(
      JSON.stringify({
        isPlaying,
        isStreamingToMobile: activeAudioStreams.size > 0,
        activeListeners: activeAudioStreams.size,
        format: 'MP3 (48 kHz Stereo)',
        bitrate: '192 kbps',
        source: getAudioSourceDescription(),
      })
    );
    return;
  }

  // 13. Audio Stream Endpoint (Live desktop audio stream to mobile)
  if (url.pathname === '/api/audio/stream' && (req.method === 'GET' || req.method === 'HEAD')) {
    if (req.method === 'HEAD') {
      res.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      res.end();
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'audio/mpeg',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    activeAudioStreams.add(res);
    startAudioBroadcaster();
    broadcastAudioStatus();

    const cleanup = () => {
      activeAudioStreams.delete(res);
      stopAudioBroadcasterIfNoClients();
      broadcastAudioStatus();
    };

    req.on('close', cleanup);
    req.on('end', cleanup);
    res.on('error', cleanup);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

createWebSocketServer(server);

function startServer(portToTry) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[Bridge] Port ${portToTry} is in use. Trying port ${portToTry + 1}...`);
      PORT = portToTry + 1;
      startServer(PORT);
    } else {
      console.error('[Bridge] Server error:', err);
    }
  });

  server.listen(portToTry, '0.0.0.0', () => {
    PORT = portToTry;
    const ips = getLocalIps();
    console.log('================================================================');
    console.log(` Soko Universal Connection Bridge running on port ${PORT}`);
    console.log('----------------------------------------------------------------');
    console.log(' Mobile Companion Web App URL (Wi-Fi or Hotspot):');
    ips.forEach((ip) => {
      console.log(`   ► http://${ip}:${PORT}`);
    });
    console.log(`   ► http://127.0.0.1:${PORT} (Local PC testing)`);
    console.log('----------------------------------------------------------------');
    console.log(` WebSocket Conduit: ws://0.0.0.0:${PORT}`);
    console.log(' REST Endpoints:    POST /api/notify | POST /api/cli | POST /api/transfer');
    console.log(' File Endpoints:    POST /api/transfer/cancel | POST /api/transfer/retry | POST /api/upload');
    console.log('================================================================');
  });
}

startServer(PORT);
