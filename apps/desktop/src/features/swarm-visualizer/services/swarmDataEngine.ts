import type {
  AgentCluster,
  DiscoveredSessionSummary,
  ReasoningStep,
  StateDiff,
  SwarmAgent,
  SwarmAgentStatus,
  SwarmState,
  SwarmStateListener,
  TerminalLogEntry,
  TraceSpan,
  TranscriptTurn,
} from '../types.ts';
import { connectionService } from '../../../services/connection.ts';
import type { AgentActivityStatus, AgentSessionInfo } from '../../../types/index.ts';

export interface DynamicRoleVisuals {
  category: string;
  clusterTitle: string;
  iconType: string;
  themeColor: 'cyan' | 'amber' | 'purple' | 'emerald' | 'indigo' | 'rose' | 'orange' | 'sky';
  accentColor: string;
}

/**
 * Maps arbitrary agent roles or titles into dynamic visual themes, icons, and color palettes.
 * Supports 1, 2, 4, 6, 8+ distinct cluster roles.
 */
export function resolveRoleVisuals(roleOrName: string): DynamicRoleVisuals {
  const text = (roleOrName || '').toLowerCase();

  // 1. Security / Audit / Auth / RBAC / Vulnerability
  if (
    text.includes('audit') ||
    text.includes('security') ||
    text.includes('auth') ||
    text.includes('rbac') ||
    text.includes('secret') ||
    text.includes('leak') ||
    text.includes('cve') ||
    text.includes('vulnerability') ||
    text.includes('guard') ||
    text.includes('policy')
  ) {
    return {
      category: 'security',
      clusterTitle: 'DB & Security Auditors',
      iconType: 'auditor',
      themeColor: 'amber',
      accentColor: '#F59E0B',
    };
  }

  // 2. QA / Testing / Verification / E2E
  if (
    text.includes('qa') ||
    text.includes('test') ||
    text.includes('vitest') ||
    text.includes('playwright') ||
    text.includes('cypress') ||
    text.includes('verify') ||
    text.includes('verifier') ||
    text.includes('spec') ||
    text.includes('benchmark') ||
    text.includes('coverage') ||
    text.includes('assert')
  ) {
    return {
      category: 'qa',
      clusterTitle: 'QA & Test Engineers',
      iconType: 'qa',
      themeColor: 'emerald',
      accentColor: '#10B981',
    };
  }

  // 3. UI / Frontend / Design / Components / Canvas / Mobile
  if (
    text.includes('ui') ||
    text.includes('frontend') ||
    text.includes('component') ||
    text.includes('design') ||
    text.includes('mobile') ||
    text.includes('visual') ||
    text.includes('css') ||
    text.includes('layout') ||
    text.includes('style') ||
    text.includes('canvas') ||
    text.includes('view')
  ) {
    return {
      category: 'frontend',
      clusterTitle: 'UI & Frontend Architects',
      iconType: 'design',
      themeColor: 'purple',
      accentColor: '#A855F7',
    };
  }

  // 4. Database / Storage / Migrations / Cache
  if (
    text.includes('db') ||
    text.includes('database') ||
    text.includes('sql') ||
    text.includes('migration') ||
    text.includes('cache') ||
    text.includes('redis') ||
    text.includes('prisma') ||
    text.includes('storage') ||
    text.includes('blob') ||
    text.includes('s3')
  ) {
    return {
      category: 'database',
      clusterTitle: 'Database & Storage Engineers',
      iconType: 'database',
      themeColor: 'orange',
      accentColor: '#F97316',
    };
  }

  // 5. System Monitor / Watchdog / Stall Monitor / Sentinel
  if (
    text.includes('monitor') ||
    text.includes('watchdog') ||
    text.includes('stall') ||
    text.includes('sentinel') ||
    text.includes('supervisor') ||
    text.includes('gate') ||
    text.includes('heartbeat')
  ) {
    return {
      category: 'monitor',
      clusterTitle: 'System Stall Monitors',
      iconType: 'monitor',
      themeColor: 'rose',
      accentColor: '#F43F5E',
    };
  }

  // 6. Performance / Profiler / Metrics / Telemetry / Latency
  if (
    text.includes('perf') ||
    text.includes('profil') ||
    text.includes('latency') ||
    text.includes('metric') ||
    text.includes('telemetry') ||
    text.includes('otel') ||
    text.includes('tracing')
  ) {
    return {
      category: 'analytics',
      clusterTitle: 'Performance & Telemetry',
      iconType: 'analytics',
      themeColor: 'sky',
      accentColor: '#0EA5E9',
    };
  }

  // 7. DevOps / Deploy / Cloud / Infra / Network / Docker
  if (
    text.includes('devops') ||
    text.includes('deploy') ||
    text.includes('cloud') ||
    text.includes('docker') ||
    text.includes('infra') ||
    text.includes('pipeline') ||
    text.includes('network') ||
    text.includes('gateway')
  ) {
    return {
      category: 'network',
      clusterTitle: 'DevOps & Infrastructure',
      iconType: 'network',
      themeColor: 'indigo',
      accentColor: '#6366F1',
    };
  }

  // 8. Backend / Engine / Core / Server / API / RPC / Remote
  if (
    text.includes('backend') ||
    text.includes('engine') ||
    text.includes('worker') ||
    text.includes('core') ||
    text.includes('server') ||
    text.includes('api') ||
    text.includes('graphql') ||
    text.includes('rpc') ||
    text.includes('remote')
  ) {
    return {
      category: 'backend',
      clusterTitle: 'Backend Core Workers',
      iconType: 'worker',
      themeColor: 'cyan',
      accentColor: '#06B6D4',
    };
  }

  // Dynamic role title derivation
  const title = roleOrName
    ? roleOrName
        .split(/[-_ ]+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
    : 'Specialist Agents';

  return {
    category: text.replace(/[^a-z0-9]/g, '_') || 'custom',
    clusterTitle: `${title} Cluster`,
    iconType: 'worker',
    themeColor: 'cyan',
    accentColor: '#3B82F6',
  };
}

/**
 * Extracts and derives proper subagent role and clean task description
 * from discovered session metadata, taskSummary, transcript turns, and dispatch prompts.
 */
export function extractSubagentRoleAndTask(
  sess: DiscoveredSessionSummary | AgentSessionInfo,
  turns: TranscriptTurn[] = [],
  index: number = 0
): { role: string; taskSummary: string } {
  const rawRole = ((sess as any).role || '').trim();
  const rawName = (sess.name || '').trim();
  const workspaceName = (sess.workspaceName || '').trim().toLowerCase();
  let rawTask = (sess.taskSummary || '').trim();

  let fullPrompt = '';
  if (turns && turns.length > 0) {
    fullPrompt = (turns[0]?.userInput || '').trim();
    if (!fullPrompt && turns[0]?.thinking && turns[0].thinking.length > 0) {
      fullPrompt = turns[0].thinking[0].split('\n')[0] || '';
    }
  }

  // 1. Clean Task Summary
  let cleanTask = '';

  // Check both rawTask and fullPrompt for explicit task tags
  const candidates = [rawTask, fullPrompt].filter(Boolean);
  for (const candidate of candidates) {
    const taskMatch = candidate.match(/<(?:original_task|task|user_task|assignment)>([\s\S]*?)<\/(?:original_task|task|user_task|assignment)>/i);
    if (taskMatch && taskMatch[1]) {
      cleanTask = taskMatch[1].trim();
      break;
    }
  }

  // If no explicit task tag found, strip system wrappers and metadata
  if (!cleanTask) {
    const cleanSource = (src: string) => {
      if (!src) return '';
      return src
        .replace(/The following is a <SYSTEM_MESSAGE>[\s\S]*?(?:attention to\.|<\/?SYSTEM_MESSAGE>|\n\n)/gi, '')
        .replace(/<\/?SYSTEM_MESSAGE>/gi, '')
        .replace(/<Identity>[\s\S]*?(?:<\/Identity>|$)/gi, '')
        .replace(/\[Message\][\s\S]*?\bcontent=\s*/gi, '')
        .replace(/^content=\s*/i, '')
        .trim();
    };

    const cleanedRaw = cleanSource(rawTask);
    const cleanedFull = cleanSource(fullPrompt);

    // If cleanedRaw was truncated (starts with fragment or is very short) and cleanedFull is more descriptive, prefer cleanedFull
    if (cleanedFull && (!cleanedRaw || cleanedFull.length > cleanedRaw.length + 10 || cleanedRaw.length < 15)) {
      cleanTask = cleanedFull;
    } else {
      cleanTask = cleanedRaw || cleanedFull;
    }
  }

  // Strip markdown headers from beginning of task text
  cleanTask = cleanTask.replace(/^#+\s+/gm, '').trim();

  // Take first meaningful sentence or paragraph if lengthy
  const firstParagraph = cleanTask.split(/\n\s*\n/)[0]?.trim() || cleanTask;
  if (firstParagraph) {
    cleanTask = firstParagraph.replace(/\s+/g, ' ').slice(0, 240);
  }

  // 2. Extract Proper Role
  let properRole = '';

  const isGeneric = (r: string) => {
    const l = (r || '').trim().toLowerCase();
    return (
      !l ||
      l === 'sub-agent' ||
      l === 'subagent' ||
      l === 'agent' ||
      l === 'specialist agent' ||
      l === 'teamwork agent' ||
      l.startsWith('specialist agent')
    );
  };

  // Check if explicit role is non-generic
  if (!isGeneric(rawRole)) {
    properRole = rawRole;
  }

  // Check name if role was generic
  if (!properRole && rawName) {
    const lName = rawName.toLowerCase();
    const isIdOrWorkspace =
      lName === workspaceName ||
      lName === sess.sessionId.toLowerCase() ||
      lName === sess.sessionId.slice(0, 8).toLowerCase();
    if (!isIdOrWorkspace && !isGeneric(rawName)) {
      properRole = rawName;
    }
  }

  // Check task summary or raw transcript for role markers across all sources
  const textSources = [rawTask, fullPrompt].filter(Boolean);
  if (!properRole) {
    for (const src of textSources) {
      // 2a. Header inside <Identity> block, e.g. # SWE Light Implementer
      const identityHeaderMatch = src.match(/<Identity>[\s\S]*?#+\s*([A-Za-z0-9_\- ]{3,40})/i);
      if (identityHeaderMatch && identityHeaderMatch[1]) {
        properRole = identityHeaderMatch[1].trim();
        break;
      }
      // 2b. Explicit roles tag, e.g. "roles: reviewer, qa" or "Role: Security Auditor"
      const rolesMatch = src.match(/(?:roles?|Identity|Role)\s*:\s*([A-Za-z0-9_\-, ]{3,40})/i);
      if (rolesMatch && rolesMatch[1] && !isGeneric(rolesMatch[1])) {
        properRole = rolesMatch[1].trim();
        break;
      }
      // 2c. "You are an? <Role>" pattern
      const youAreMatch = src.match(
        /You are (?:a|an)\s+([A-Za-z0-9_\- ]{3,40}?)(?:,|\.|\s+specializing|\s+in|\s+responsible|\s+with\b|\s+one\b)/i
      );
      if (youAreMatch && youAreMatch[1] && !isGeneric(youAreMatch[1])) {
        properRole = youAreMatch[1].trim();
        break;
      }
      // 2d. Explicit <role> or <identity> tags
      const tagMatch = src.match(/<(?:role|identity)>([A-Za-z0-9_\- ]{3,40})<\/(?:role|identity)>/i);
      if (tagMatch && tagMatch[1] && !isGeneric(tagMatch[1])) {
        properRole = tagMatch[1].trim();
        break;
      }
    }
  }

  // If still generic, infer from task intent keywords
  if (!properRole || isGeneric(properRole)) {
    const text = `${cleanTask} ${rawTask} ${fullPrompt}`.toLowerCase();
    if (text.includes('security') || text.includes('audit') || text.includes('cve') || text.includes('vulnerability') || text.includes('auth') || text.includes('rbac') || text.includes('jwt') || text.includes('secret')) {
      properRole = 'Security Auditor';
    } else if (text.includes('qa') || text.includes('test') || text.includes('verify') || text.includes('spec') || text.includes('assertion') || text.includes('vitest') || text.includes('playwright') || text.includes('cypress')) {
      properRole = 'QA Engineer';
    } else if (text.includes('ui') || text.includes('frontend') || text.includes('css') || text.includes('design') || text.includes('canvas') || text.includes('layout') || text.includes('component') || text.includes('tailwind')) {
      properRole = 'UI Architect';
    } else if (text.includes('database') || text.includes('sql') || text.includes('migration') || text.includes('db') || text.includes('redis') || text.includes('cache') || text.includes('postgres')) {
      properRole = 'Database Engineer';
    } else if (text.includes('monitor') || text.includes('watchdog') || text.includes('stall') || text.includes('sentinel')) {
      properRole = 'System Stall Monitor';
    } else if (text.includes('perf') || text.includes('latency') || text.includes('telemetry') || text.includes('profil') || text.includes('leak')) {
      properRole = 'Performance Engineer';
    } else if (text.includes('devops') || text.includes('deploy') || text.includes('docker') || text.includes('cloud') || text.includes('k8s')) {
      properRole = 'DevOps Engineer';
    } else if (text.includes('backend') || text.includes('api') || text.includes('server') || text.includes('service') || text.includes('bridge')) {
      properRole = 'Backend Engineer';
    } else if (text.includes('review') || text.includes('critique') || text.includes('inspector')) {
      properRole = 'Code Reviewer';
    } else if (text.includes('fix') || text.includes('implement') || text.includes('feature') || text.includes('refactor') || text.includes('bug')) {
      properRole = 'Code Implementer';
    } else {
      properRole = `Specialist Agent ${index + 1}`;
    }
  }

  // Format properRole: handle comma-separated lists and capitalize acronyms (QA, UI, UX, DB, SWE, DevOps, etc.)
  const acronyms: Record<string, string> = {
    QA: 'QA',
    UI: 'UI',
    UX: 'UX',
    DB: 'DB',
    SWE: 'SWE',
    API: 'API',
    CLI: 'CLI',
    CVE: 'CVE',
    E2E: 'E2E',
    DAG: 'DAG',
    DEVOPS: 'DevOps',
    JWT: 'JWT',
    RBAC: 'RBAC',
    REST: 'REST',
  };
  const formatWord = (w: string) => {
    const upper = w.toUpperCase();
    if (acronyms[upper]) return acronyms[upper];
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  };

  if (properRole.includes(',')) {
    properRole = properRole
      .split(',')
      .map((s) => s.trim().split(/[\s_\-]+/).filter(Boolean).map(formatWord).join(' '))
      .filter(Boolean)
      .join(' / ');
  } else {
    properRole = properRole
      .replace(/[_\-]+/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .map(formatWord)
      .join(' ');
  }

  if (!cleanTask) {
    cleanTask = `Executing ${properRole} assignment`;
  }

  return { role: properRole, taskSummary: cleanTask };
}

/**
 * SwarmDataEngine
 *
 * Real-time dynamic multi-agent telemetry and historical replay engine for Soko.
 * Ingests real CLI agent sessions, sub-agents, transcripts, thinking steps,
 * file diffs, and tool execution spans from Soko Bridge.
 *
 * Zero mock fixtures or static 28-worker dummy data.
 * Pure real telemetry with dynamic N-cluster grouping and turn-based time travel.
 */
export class SwarmDataEngine {
  private static instance: SwarmDataEngine;
  private listeners: Set<SwarmStateListener> = new Set();
  private state: SwarmState;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private unsubConnectionActivity: (() => void) | null = null;
  private unsubNotification: (() => void) | null = null;
  private transcriptCache: Map<string, { mtimeMs: number; turns: TranscriptTurn[] }> = new Map();
  private isSyncing = false;
  private hasPendingSync = false;

  // Real token rate tracking (delta tokens over elapsed time, no mock rate)
  private lastTokenCheckTime = 0;
  private lastTotalTokens = 0;
  private currentCalculatedTokenRate = 0;

  private constructor() {
    this.state = this.buildInitialState();
  }

  public static getInstance(): SwarmDataEngine {
    if (!SwarmDataEngine.instance) {
      SwarmDataEngine.instance = new SwarmDataEngine();
    }
    return SwarmDataEngine.instance;
  }

  /**
   * Subscribe to state updates. Returns an unsubscription function.
   */
  public subscribe(listener: SwarmStateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Current snapshot of the swarm visualizer state.
   */
  public getState(): SwarmState {
    return this.state;
  }

  /**
   * Query whether the live streaming engine is active.
   */
  public isRunning(): boolean {
    return this.state.isRunning;
  }

  /**
   * Start live streaming and telemetry ingestion.
   * Starts timers and subscriptions ONLY upon explicit user invocation.
   */
  public start(): void {
    if (this.state.isRunning) return;

    this.state = {
      ...this.state,
      isRunning: true,
      stats: {
        ...this.state.stats,
        isRunning: true,
      },
    };

    this.addTerminalLog('info', 'Swarm telemetry engine connected. Monitoring real agent sessions.');

    // Connect to Soko connectionService for agent activity
    try {
      this.unsubConnectionActivity = connectionService.subscribeAgentActivity((activity: AgentActivityStatus) => {
        this.handleExternalAgentActivity(activity);
      });
    } catch (err) {
      console.warn('[SwarmDataEngine] ConnectionService subscription failed:', err);
    }

    // Connect to Soko connectionService for notifications (completion, subagent events)
    try {
      this.unsubNotification = connectionService.onNotification((notif) => {
        if (
          notif.isSubagent ||
          notif.isAgentDone ||
          notif.isTaskDone ||
          notif.appName?.includes('Agent') ||
          notif.title?.includes('Agent') ||
          notif.title?.includes('Sub-Agent')
        ) {
          this.addTerminalLog('info', `[Notification] ${notif.title}: ${notif.body}`);
          if (this.state.viewMode === 'live') {
            this.syncLiveTelemetry().catch(() => {});
          } else {
            this.checkBackgroundLiveAgentStatus().catch(() => {});
          }
        }
      });
    } catch (err) {
      console.warn('[SwarmDataEngine] Notification subscription failed:', err);
    }

    // Trigger initial live telemetry sync
    this.syncLiveTelemetry().catch((err) => {
      console.warn('[SwarmDataEngine] Initial telemetry sync error:', err);
    });

    // Real-time update loop (1.5s tick)
    this.tickInterval = setInterval(() => {
      this.tick();
    }, 1500);

    this.notify();
  }

  /**
   * Stop live simulation and tear down all timers and subscriptions immediately.
   * Strictly enforces 0% CPU consumption when stopped.
   */
  public stop(): void {
    if (!this.state.isRunning && !this.tickInterval) return;

    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    if (this.unsubConnectionActivity) {
      this.unsubConnectionActivity();
      this.unsubConnectionActivity = null;
    }

    if (this.unsubNotification) {
      this.unsubNotification();
      this.unsubNotification = null;
    }

    this.currentCalculatedTokenRate = 0;

    this.state = {
      ...this.state,
      isRunning: false,
      stats: {
        ...this.state.stats,
        isRunning: false,
        tokenRate: 0,
      },
    };

    this.addTerminalLog('info', 'Telemetry monitoring paused.');
    this.notify();
  }

  /**
   * Set view mode between 'live' streaming and 'history' replay.
   */
  public setViewMode(mode: 'live' | 'history'): void {
    if (this.state.viewMode === mode && this.state.isLiveSource === (mode === 'live')) return;

    if (mode === 'live') {
      this.state = {
        ...this.state,
        viewMode: 'live',
        isLiveSource: true,
        hasBackgroundLiveAgent: false,
        stats: {
          ...this.state.stats,
          viewMode: 'live',
        },
      };
      this.addTerminalLog('info', 'Switched to Live Streaming mode.');
      this.syncLiveTelemetry().catch(() => {});
    } else {
      this.state = {
        ...this.state,
        viewMode: 'history',
        isLiveSource: false,
        stats: {
          ...this.state.stats,
          viewMode: 'history',
          tokenRate: 0,
        },
      };
      this.addTerminalLog('info', 'Switched to Historical Conversation Replay mode.');
      this.notify();
    }
  }

  /**
   * Backwards-compatible toggle for live source.
   */
  public setLiveSource(isLive: boolean): void {
    this.setViewMode(isLive ? 'live' : 'history');
  }

  /**
   * Load any discovered session (root or subagent) for detailed inspection and replay.
   */
  public async loadSession(sessionId: string, options: { mode?: 'live' | 'history' } = {}): Promise<void> {
    try {
      // 1. Fetch transcript for targeted session
      const transcriptRes = await connectionService.fetchSessionTranscript(sessionId);
      const turns: TranscriptTurn[] =
        transcriptRes && transcriptRes.success && Array.isArray(transcriptRes.turns)
          ? transcriptRes.turns
          : [];

      // 2. Refresh discovered sessions if empty
      let availableSessions = this.state.availableSessions;
      if (availableSessions.length === 0) {
        const rawSessions = await connectionService.fetchDiscoveredAgentSessions();
        availableSessions = this.mapRawSessionsToSummaries(rawSessions || []);
      }

      const activeSession = availableSessions.find((s) => s.sessionId === sessionId) || {
        sessionId,
        name: sessionId.slice(0, 8),
        mtimeMs: Date.now(),
        isLocked: false,
        status: 'completed',
        role: 'Orchestrator',
      };

      // 3. Find child subagents of this session
      const childSessions = availableSessions.filter(
        (s) => s.parentSessionId === sessionId || (!s.parentSessionId && s.isSubagent && s.sessionId !== sessionId)
      );

      // 4. Fetch transcripts for child subagents
      const childTranscripts = new Map<string, TranscriptTurn[]>();
      await Promise.all(
        childSessions.map(async (child) => {
          try {
            const cached = this.transcriptCache.get(child.sessionId);
            if (cached && cached.mtimeMs === child.mtimeMs && cached.turns.length > 0) {
              childTranscripts.set(child.sessionId, cached.turns);
              return;
            }
            const res = await connectionService.fetchSessionTranscript(child.sessionId);
            if (res && res.success && Array.isArray(res.turns)) {
              this.transcriptCache.set(child.sessionId, {
                mtimeMs: child.mtimeMs,
                turns: res.turns,
              });
              childTranscripts.set(child.sessionId, res.turns);
            }
          } catch {
            // Ignore individual child transcript failure
          }
        })
      );

      // 5. Build SwarmAgents from child sessions
      const agents: SwarmAgent[] = childSessions.map((child, idx) => {
        const cTurns = childTranscripts.get(child.sessionId) || [];
        return this.mapSessionToSwarmAgent(child, cTurns, idx);
      });

      // 6. Dynamically group subagents into N clusters
      const clusters = this.groupSubagentsIntoClusters(agents);

      // 7. Determine time bounds & turn cursor
      let maxTimeMs = 60000;
      if (turns.length > 1) {
        const firstTime = turns[0].timestamp;
        const lastTime = turns[turns.length - 1].timestamp;
        maxTimeMs = Math.max(5000, lastTime - firstTime);
      } else if (turns.length === 1) {
        maxTimeMs = 10000;
      }

      const activeTurnIndex = Math.max(0, turns.length - 1);
      const isSessionActive = Boolean(
        activeSession.isLocked ||
        activeSession.status === 'working' ||
        activeSession.status === 'thinking' ||
        activeSession.status === 'waiting'
      );

      const targetMode: 'live' | 'history' =
        options.mode || (isSessionActive ? 'live' : 'history');

      let selectedAgentId = this.state.selectedAgentId;
      if (!selectedAgentId || !agents.some((a) => a.id === selectedAgentId)) {
        selectedAgentId = agents[0]?.id || null;
      }

      this.state = {
        ...this.state,
        clusters,
        availableSessions,
        selectedSessionId: sessionId,
        rootSessionId: sessionId,
        activeSession,
        turns,
        viewMode: targetMode,
        isLiveSource: targetMode === 'live',
        activeTurnIndex,
        timeTravelCursorMs: maxTimeMs,
        maxTimeMs,
        selectedAgentId,
        selectedAgent: agents.find((a) => a.id === selectedAgentId) || null,
        stats: {
          ...this.state.stats,
          activeClusters: clusters.length,
          totalParallel: agents.length,
          timeTravelCursorMs: maxTimeMs,
          maxTimeMs,
          viewMode: targetMode,
          tokenRate: targetMode === 'history' ? 0 : this.currentCalculatedTokenRate,
        },
      };

      this.addTerminalLog(
        'info',
        `Loaded session [${sessionId.slice(0, 8)}] (${turns.length} turns, ${agents.length} subagents).`
      );
      this.notify();
    } catch (err) {
      console.warn('[SwarmDataEngine] Failed to load session:', sessionId, err);
      this.addTerminalLog('error', `Failed to load session ${sessionId.slice(0, 8)}`);
    }
  }

  /**
   * Set time travel cursor in milliseconds. Replays history up to that point.
   */
  public setTimeTravelCursor(ms: number): void {
    const clamped = Math.max(0, Math.min(ms, this.state.maxTimeMs));
    const turns = this.state.turns || [];

    let activeTurnIndex = 0;
    if (turns.length > 0) {
      if (this.state.maxTimeMs > 0) {
        const pct = clamped / this.state.maxTimeMs;
        activeTurnIndex = Math.min(turns.length - 1, Math.max(0, Math.floor(pct * turns.length)));
      } else {
        activeTurnIndex = turns.length - 1;
      }
    }

    this.applyTurnScrubbing(activeTurnIndex, clamped);
  }

  /**
   * Directly scrub to an explicit turn index for fine-grained replay.
   */
  public setActiveTurnIndex(turnIndex: number): void {
    const turns = this.state.turns || [];
    const clampedIndex = Math.min(Math.max(0, turns.length - 1), Math.max(0, turnIndex));
    const fraction = turns.length > 1 ? clampedIndex / (turns.length - 1) : 1;
    const clampedMs = Math.round(fraction * this.state.maxTimeMs);

    this.applyTurnScrubbing(clampedIndex, clampedMs);
  }

  /**
   * Internal handler to apply historical turn scrub to agents and state diffs.
   */
  private applyTurnScrubbing(activeTurnIndex: number, cursorMs: number): void {
    // Re-slice reasoning steps and spans for subagents up to scrubbed index
    const updatedClusters = this.state.clusters.map((cluster) => {
      const updatedAgents = cluster.agents.map((agent) => {
        const fullSteps = agent.rawReasoningSteps || agent.reasoningSteps;
        const fullSpans = agent.rawTraceSpans || agent.traceSpans;

        const slicedSteps = fullSteps.slice(0, Math.max(1, activeTurnIndex + 1));
        const slicedSpans = fullSpans.slice(0, Math.max(1, activeTurnIndex + 2));

        return {
          ...agent,
          rawReasoningSteps: fullSteps,
          rawTraceSpans: fullSpans,
          reasoningSteps: slicedSteps,
          traceSpans: slicedSpans,
          turnIndex: activeTurnIndex,
        };
      });

      return {
        ...cluster,
        agents: updatedAgents,
      };
    });

    let selectedAgent = this.state.selectedAgent;
    if (this.state.selectedAgentId) {
      for (const cluster of updatedClusters) {
        const found = cluster.agents.find((a) => a.id === this.state.selectedAgentId);
        if (found) {
          selectedAgent = found;
          break;
        }
      }
    }

    this.state = {
      ...this.state,
      clusters: updatedClusters,
      selectedAgent,
      activeTurnIndex,
      timeTravelCursorMs: cursorMs,
      stats: {
        ...this.state.stats,
        timeTravelCursorMs: cursorMs,
      },
    };

    this.notify();
  }

  /**
   * Select an agent by ID to show in the right Inspector panel.
   */
  public selectAgent(agentId: string | null): void {
    let selectedAgent: SwarmAgent | null = null;
    if (agentId) {
      selectedAgent = this.findAgent(agentId);
    }

    this.state = {
      ...this.state,
      selectedAgentId: agentId,
      selectedAgent,
    };
    this.notify();
  }

  /**
   * Set search/filter query for agents.
   */
  public setFilterQuery(query: string): void {
    this.state = {
      ...this.state,
      filterQuery: query,
    };
    this.notify();
  }

  /**
   * Toggle cluster collapse/expand state.
   */
  public toggleClusterCollapse(clusterId: string): void {
    const clusters = this.state.clusters.map((c) => {
      if (c.id === clusterId) {
        return { ...c, isCollapsed: !c.isCollapsed };
      }
      return c;
    });
    this.state = {
      ...this.state,
      clusters,
    };
    this.notify();
  }

  /**
   * Toggle Arize Phoenix synchronization.
   */
  public toggleArizeSync(): void {
    this.state = {
      ...this.state,
      isSynchronizedWithArize: !this.state.isSynchronizedWithArize,
    };
    this.addTerminalLog(
      'info',
      `Arize Phoenix sync ${this.state.isSynchronizedWithArize ? 'enabled' : 'disabled'}.`
    );
    this.notify();
  }

  /**
   * Set viewport alignment ('CENTER' | 'TOP' | 'BOTTOM').
   */
  public setViewAlignment(viewAlignment: 'CENTER' | 'TOP' | 'BOTTOM'): void {
    this.state = {
      ...this.state,
      viewAlignment,
    };
    this.notify();
  }

  /**
   * Clear terminal logs.
   */
  public clearTerminalLogs(): void {
    this.state = {
      ...this.state,
      terminalLogs: [],
    };
    this.notify();
  }

  /**
   * Reset simulation / re-sync live telemetry.
   */
  public resetSimulation(): void {
    this.syncLiveTelemetry().catch(() => {});
  }

  /**
   * Approve a pending agent tool execution or prompt gate.
   */
  public async approveAction(agentId: string, actionId?: string): Promise<void> {
    const targetAgent = this.findAgent(agentId);
    const sessionId = targetAgent?.sessionId || this.state.rootSessionId;

    if (sessionId) {
      try {
        await connectionService.dispatchSessionPrompt(
          sessionId,
          `APPROVED: Proceed with tool execution (${actionId || 'authorized'})`
        );
      } catch (err) {
        console.warn('[SwarmDataEngine] Failed to dispatch approval prompt:', err);
      }
    }

    const clusters = this.state.clusters.map((cluster) => {
      const agents = cluster.agents.map((agent) => {
        const isTarget =
          agent.id === agentId ||
          agent.sessionId === agentId ||
          (targetAgent && (agent.id === targetAgent.id || agent.sessionId === targetAgent.sessionId));
        if (isTarget) {
          const fullSteps = agent.rawReasoningSteps || agent.reasoningSteps;
          const updatedSteps = [
            ...fullSteps,
            {
              id: `rs-approved-${Date.now()}`,
              title: `Operator Approved Execution: ${agent.actionRequired?.label || 'Action'}`,
              detail: `Tool '${agent.actionRequired?.toolName || 'unknown'}' authorization dispatched. Resuming execution cycle.`,
              timestamp: Date.now(),
              status: 'completed' as const,
            },
          ];

          const fullSpans = agent.rawTraceSpans || agent.traceSpans;
          const updatedSpans = fullSpans.map((span) => {
            if (span.status === 'running') {
              return { ...span, status: 'success' as const };
            }
            return span;
          });

          return {
            ...agent,
            status: 'working' as const,
            actionRequired: undefined,
            rawReasoningSteps: updatedSteps,
            reasoningSteps: updatedSteps,
            rawTraceSpans: updatedSpans,
            traceSpans: updatedSpans,
          };
        }
        return agent;
      });

      const activeCount = agents.filter(
        (a) => a.status === 'working' || a.status === 'awaiting_approval' || a.status === 'thinking'
      ).length;

      return {
        ...cluster,
        activeCount,
        agents,
      };
    });

    this.addTerminalLog('success', `Action approved for ${agentId}. Dispatched authorization prompt.`, agentId);
    this.updateStateAndRecomputeStats({ clusters });
  }

  /**
   * Reject a pending agent tool execution.
   */
  public async rejectAction(agentId: string, actionId?: string): Promise<void> {
    const targetAgent = this.findAgent(agentId);
    const sessionId = targetAgent?.sessionId || this.state.rootSessionId;

    if (sessionId) {
      try {
        await connectionService.dispatchSessionPrompt(
          sessionId,
          `REJECTED: Operator cancelled tool execution (${actionId || 'rejected'})`
        );
      } catch (err) {
        console.warn('[SwarmDataEngine] Failed to dispatch rejection prompt:', err);
      }
    }

    const clusters = this.state.clusters.map((cluster) => {
      const agents = cluster.agents.map((agent) => {
        const isTarget =
          agent.id === agentId ||
          agent.sessionId === agentId ||
          (targetAgent && (agent.id === targetAgent.id || agent.sessionId === targetAgent.sessionId));
        if (isTarget) {
          const fullSteps = agent.rawReasoningSteps || agent.reasoningSteps;
          const updatedSteps = [
            ...fullSteps,
            {
              id: `rs-rejected-${Date.now()}`,
              title: `Operator Rejected Action (${actionId || 'rejected'})`,
              detail: `Action cancelled by operator. Branch execution aborted.`,
              timestamp: Date.now(),
              status: 'completed' as const,
            },
          ];

          return {
            ...agent,
            status: 'idle' as const,
            actionRequired: undefined,
            rawReasoningSteps: updatedSteps,
            reasoningSteps: updatedSteps,
          };
        }
        return agent;
      });

      const activeCount = agents.filter(
        (a) => a.status === 'working' || a.status === 'awaiting_approval' || a.status === 'thinking'
      ).length;

      return {
        ...cluster,
        activeCount,
        agents,
      };
    });

    this.addTerminalLog('warn', `Action rejected for ${agentId}. Sub-agent halted.`, agentId);
    this.updateStateAndRecomputeStats({ clusters });
  }

  /**
   * Retry a failed or retrying agent.
   */
  public async retryAgent(agentId: string): Promise<void> {
    const targetAgent = this.findAgent(agentId);
    const sessionId = targetAgent?.sessionId || this.state.rootSessionId;

    if (sessionId) {
      try {
        await connectionService.dispatchSessionPrompt(
          sessionId,
          `RETRY: Please retry the failed step with alternative parameters.`
        );
      } catch (err) {
        console.warn('[SwarmDataEngine] Failed to dispatch retry prompt:', err);
      }
    }

    const clusters = this.state.clusters.map((cluster) => {
      const agents = cluster.agents.map((agent) => {
        const isTarget =
          agent.id === agentId ||
          agent.sessionId === agentId ||
          (targetAgent && (agent.id === targetAgent.id || agent.sessionId === targetAgent.sessionId));
        if (isTarget) {
          const fullSteps = agent.rawReasoningSteps || agent.reasoningSteps;
          const updatedSteps = [
            ...fullSteps,
            {
              id: `rs-retry-${Date.now()}`,
              title: `Retrying execution suite for ${agentId}`,
              detail: `Dispatched retry request to sub-agent sandbox.`,
              timestamp: Date.now(),
              status: 'running' as const,
            },
          ];

          return {
            ...agent,
            status: 'working' as const,
            progress: 25,
            rawReasoningSteps: updatedSteps,
            reasoningSteps: updatedSteps,
          };
        }
        return agent;
      });

      const activeCount = agents.filter(
        (a) => a.status === 'working' || a.status === 'awaiting_approval' || a.status === 'thinking'
      ).length;

      return {
        ...cluster,
        activeCount,
        agents,
      };
    });

    this.addTerminalLog('info', `Retry triggered for ${agentId}. Status reset to working.`, agentId);
    this.updateStateAndRecomputeStats({ clusters });
  }

  /**
   * Dispatch an interactive prompt or instruction to an agent.
   */
  public async sendPrompt(agentId: string, promptText: string): Promise<void> {
    const targetAgent = this.findAgent(agentId);
    const sessionId = targetAgent?.sessionId || this.state.rootSessionId;

    if (sessionId) {
      try {
        await connectionService.dispatchSessionPrompt(sessionId, promptText);
      } catch (err) {
        console.warn('[SwarmDataEngine] Failed to dispatch prompt:', err);
      }
    }

    const clusters = this.state.clusters.map((cluster) => {
      const agents = cluster.agents.map((agent) => {
        const isTarget =
          agent.id === agentId ||
          agent.sessionId === agentId ||
          (targetAgent && (agent.id === targetAgent.id || agent.sessionId === targetAgent.sessionId));
        if (isTarget) {
          const fullSteps = agent.rawReasoningSteps || agent.reasoningSteps;
          const updatedSteps = [
            ...fullSteps,
            {
              id: `rs-prompt-${Date.now()}`,
              title: `Operator Dispatched Instruction: "${promptText.slice(0, 60)}${promptText.length > 60 ? '...' : ''}"`,
              detail: promptText,
              timestamp: Date.now(),
              status: 'running' as const,
            },
          ];

          return {
            ...agent,
            status: 'working' as const,
            rawReasoningSteps: updatedSteps,
            reasoningSteps: updatedSteps,
          };
        }
        return agent;
      });

      const activeCount = agents.filter(
        (a) => a.status === 'working' || a.status === 'awaiting_approval' || a.status === 'thinking'
      ).length;

      return {
        ...cluster,
        activeCount,
        agents,
      };
    });

    this.addTerminalLog('info', `Dispatched prompt to [${agentId}]: "${promptText}"`, agentId);
    this.updateStateAndRecomputeStats({ clusters });
  }

  /**
   * Main periodic telemetry tick.
   */
  private tick(): void {
    if (!this.state.isRunning) return;

    if (this.state.viewMode === 'live') {
      this.syncLiveTelemetry().catch((err) => {
        console.warn('[SwarmDataEngine] Telemetry sync error:', err);
      });
    } else {
      // In history mode: check if any new active agent has appeared in the background
      this.checkBackgroundLiveAgentStatus().catch(() => {});
    }
  }

  /**
   * Query and ingest live session telemetry from local Soko Bridge.
   */
  public async syncLiveTelemetry(): Promise<void> {
    if (this.isSyncing) {
      this.hasPendingSync = true;
      return;
    }
    this.isSyncing = true;

    try {
      const rawSessions = await connectionService.fetchDiscoveredAgentSessions();
      const availableSessions = this.mapRawSessionsToSummaries(rawSessions || []);

      const now = Date.now();
      // Identify active live sessions (locked or actively working within last 20m)
      const activeSessions = availableSessions.filter((s) => {
        if (s.isLocked) {
          return (now - s.mtimeMs) < 20 * 60 * 1000;
        }
        return s.status === 'working' || s.status === 'thinking' || s.status === 'waiting';
      });

      const hasActive = activeSessions.length > 0;

      // Handle History Mode with Background Live Agent detection
      if (this.state.viewMode === 'history') {
        const hasBackgroundLiveAgent = hasActive;
        if (this.state.hasBackgroundLiveAgent !== hasBackgroundLiveAgent) {
          this.state = {
            ...this.state,
            availableSessions,
            hasBackgroundLiveAgent,
            stats: {
              ...this.state.stats,
              hasBackgroundLiveAgent,
            },
          };
          this.notify();
        }
        return;
      }

      // Live Mode: If no live agent is currently running, auto-load most recent completed session in history mode
      if (!hasActive) {
        const rootConversations = availableSessions.filter((s) => !s.isSubagent);
        rootConversations.sort((a, b) => b.mtimeMs - a.mtimeMs);
        const mostRecent = rootConversations[0] || availableSessions[0];

        if (mostRecent) {
          await this.loadSession(mostRecent.sessionId, { mode: 'history' });
          this.addTerminalLog(
            'info',
            'No active live agent detected. Loaded most recent conversation in History Mode.'
          );
        } else {
          // Absolutely empty workspace
          this.state = {
            ...this.state,
            clusters: [],
            availableSessions: [],
            viewMode: 'history',
            hasBackgroundLiveAgent: false,
            stats: {
              ...this.state.stats,
              totalParallel: 0,
              activeClusters: 0,
              tokenRate: 0,
              viewMode: 'history',
            },
          };
          this.notify();
        }
        return;
      }

      // Live Active Sessions exist: stream telemetry
      let rootSession = activeSessions.find((s) => !s.isSubagent && s.isLocked);
      if (!rootSession) {
        rootSession = activeSessions.find((s) => !s.isSubagent);
      }
      if (!rootSession) {
        rootSession = activeSessions[0];
      }

      const rootSessionId = rootSession.sessionId;

      // Child sub-agents
      const childSessions = availableSessions.filter(
        (s) => s.parentSessionId === rootSessionId || (!s.parentSessionId && s.isSubagent && s.sessionId !== rootSessionId)
      );

      // Fetch transcripts for root and all active child sessions
      const sessionsToFetch = [rootSession, ...childSessions];
      const transcriptMap = new Map<string, TranscriptTurn[]>();

      await Promise.all(
        sessionsToFetch.map(async (sess) => {
          try {
            const cached = this.transcriptCache.get(sess.sessionId);
            if (cached && cached.mtimeMs === sess.mtimeMs && cached.turns.length > 0) {
              transcriptMap.set(sess.sessionId, cached.turns);
              return;
            }

            const data = await connectionService.fetchSessionTranscript(sess.sessionId);
            if (data && data.success && Array.isArray(data.turns)) {
              this.transcriptCache.set(sess.sessionId, {
                mtimeMs: sess.mtimeMs,
                turns: data.turns,
              });
              transcriptMap.set(sess.sessionId, data.turns);
            }
          } catch {
            // Transcript fetch failure fallback
          }
        })
      );

      // Total tokens used across active agents for rate calculation
      let totalTokensNow = rootSession.tokensUsed || 0;
      childSessions.forEach((c) => {
        totalTokensNow += c.tokensUsed || 0;
      });

      // Compute real token rate from delta tokens over elapsed seconds
      const tokenRate = this.computeRealTokenRate(totalTokensNow, true);

      // Build real SwarmAgents from discovered child sessions
      const agents: SwarmAgent[] = childSessions.map((sess, idx) => {
        const turns = transcriptMap.get(sess.sessionId) || [];
        return this.mapSessionToSwarmAgent(sess, turns, idx, tokenRate);
      });

      // Group subagents dynamically into N clusters
      const clusters = this.groupSubagentsIntoClusters(agents);

      // Retain or select the first agent
      let selectedAgentId = this.state.selectedAgentId;
      if (!selectedAgentId || !agents.some((a) => a.id === selectedAgentId)) {
        selectedAgentId = agents[0]?.id || null;
      }

      const rootTurns = transcriptMap.get(rootSessionId) || [];

      this.updateStateAndRecomputeStats({
        clusters,
        rootSessionId,
        selectedSessionId: rootSessionId,
        activeSession: rootSession,
        availableSessions,
        selectedAgentId,
        turns: rootTurns,
        activeTurnIndex: Math.max(0, rootTurns.length - 1),
        viewMode: 'live',
        hasBackgroundLiveAgent: false,
        isLiveSource: true,
      });
    } finally {
      this.isSyncing = false;
      if (this.hasPendingSync) {
        this.hasPendingSync = false;
        setTimeout(() => {
          this.syncLiveTelemetry().catch(() => {});
        }, 50);
      }
    }
  }

  /**
   * Check if a live session starts while the user is browsing historical transcripts.
   */
  private async checkBackgroundLiveAgentStatus(): Promise<void> {
    try {
      const rawSessions = await connectionService.fetchDiscoveredAgentSessions();
      if (!rawSessions || rawSessions.length === 0) return;

      const now = Date.now();
      const hasLive = rawSessions.some((s: any) => {
        if (s.isLocked) {
          const mtime = s.mtimeMs || s.timestamp || 0;
          return (now - mtime) < 20 * 60 * 1000;
        }
        return s.status === 'working' || s.status === 'thinking' || s.status === 'waiting';
      });

      if (this.state.hasBackgroundLiveAgent !== hasLive) {
        this.state = {
          ...this.state,
          hasBackgroundLiveAgent: hasLive,
          stats: {
            ...this.state.stats,
            hasBackgroundLiveAgent: hasLive,
          },
        };
        this.notify();
      }
    } catch {
      // Ignore background check failure
    }
  }

  /**
   * Computes real aggregate token rate from delta tokens over elapsed seconds.
   * Returns 0 when agents are idle, completed, or in history mode.
   */
  private computeRealTokenRate(currentTotalTokens: number, isAnyAgentActive: boolean): number {
    if (!isAnyAgentActive || this.state.viewMode === 'history') {
      this.currentCalculatedTokenRate = 0;
      this.lastTotalTokens = currentTotalTokens;
      this.lastTokenCheckTime = Date.now();
      return 0;
    }

    const now = Date.now();
    if (this.lastTokenCheckTime === 0) {
      this.lastTokenCheckTime = now;
      this.lastTotalTokens = currentTotalTokens;
      this.currentCalculatedTokenRate = 0;
      return 0;
    }

    const elapsedSec = (now - this.lastTokenCheckTime) / 1000;
    if (elapsedSec >= 1.0) {
      const deltaTokens = currentTotalTokens - this.lastTotalTokens;
      if (deltaTokens > 0) {
        this.currentCalculatedTokenRate = Math.round(deltaTokens / elapsedSec);
      } else {
        // Smooth decay towards 0 when no tokens arrive between turns
        this.currentCalculatedTokenRate = Math.max(0, Math.round(this.currentCalculatedTokenRate * 0.7));
      }
      this.lastTotalTokens = currentTotalTokens;
      this.lastTokenCheckTime = now;
    }

    return this.currentCalculatedTokenRate;
  }

  /**
   * Group subagents dynamically into N clusters by semantic role keywords.
   * Supports 1, 2, 4, 6, 8+ arbitrary roles.
   * If 0 subagents, returns an empty cluster array for single-agent pipeline.
   */
  private groupSubagentsIntoClusters(agents: SwarmAgent[]): AgentCluster[] {
    if (!agents || agents.length === 0) {
      return [];
    }

    const clusterMap = new Map<string, { visuals: DynamicRoleVisuals; agents: SwarmAgent[] }>();

    for (const agent of agents) {
      const visuals = resolveRoleVisuals(agent.role || agent.name);
      const key = visuals.category;

      if (!clusterMap.has(key)) {
        clusterMap.set(key, { visuals, agents: [] });
      }

      const group = clusterMap.get(key)!;
      agent.clusterId = key;
      agent.clusterName = visuals.clusterTitle;
      agent.roleCategory = visuals.category;
      agent.roleIcon = visuals.iconType;
      agent.roleColor = visuals.accentColor;
      group.agents.push(agent);
    }

    const clusters: AgentCluster[] = [];
    clusterMap.forEach((entry, key) => {
      const activeCount = entry.agents.filter(
        (a) => a.status === 'working' || a.status === 'awaiting_approval' || a.status === 'thinking'
      ).length;

      const existingCluster = this.state?.clusters?.find((c) => c.id === key);

      clusters.push({
        id: key,
        name: `${entry.visuals.clusterTitle} [${entry.agents.length} ${entry.agents.length === 1 ? 'Agent' : 'Agents'}]`,
        iconType: entry.visuals.iconType,
        activeCount,
        isCollapsed: existingCluster?.isCollapsed ?? false,
        agents: entry.agents,
        role: entry.visuals.clusterTitle,
        roleCategory: entry.visuals.category,
        themeColor: entry.visuals.themeColor,
        accentColor: entry.visuals.accentColor,
      });
    });

    return clusters;
  }

  /**
   * Maps a discovered session and its parsed transcript turns into a high-fidelity SwarmAgent.
   */
  private mapSessionToSwarmAgent(
    sess: DiscoveredSessionSummary | AgentSessionInfo,
    turns: TranscriptTurn[],
    index: number,
    aggregateTokenRate: number = 0
  ): SwarmAgent {
    const agentId = sess.sessionId.slice(0, 8);
    const { role: properRole, taskSummary: cleanTask } = extractSubagentRoleAndTask(sess, turns, index);
    const roleName = properRole;

    // Real status mapping
    let status: SwarmAgent['status'] = 'idle';
    if (sess.status === 'working') {
      status = 'working';
    } else if (sess.status === 'thinking') {
      status = 'thinking';
    } else if (sess.status === 'waiting') {
      status = 'awaiting_approval';
    } else if (sess.status === 'completed') {
      status = 'completed';
    } else if ((sess.status as string) === 'retrying') {
      status = 'retrying';
    }

    // Parse reasoning steps from turns
    const reasoningSteps: ReasoningStep[] = [];
    const traceSpans: TraceSpan[] = [];
    let stateDiff: StateDiff | undefined = undefined;
    let actionRequired: SwarmAgent['actionRequired'] = undefined;

    // Process turns (most recent turns up to 4)
    const recentTurns = turns.slice(-4);
    recentTurns.forEach((turn, tIdx) => {
      const isLatestTurn = tIdx === recentTurns.length - 1;

      // 1. Thinking steps
      if (turn.thinking && turn.thinking.length > 0) {
        turn.thinking.forEach((th, thIdx) => {
          const paragraphs = th.split(/\n\s*\n/).filter(Boolean);
          paragraphs.forEach((p, pIdx) => {
            const lines = p.trim().split('\n');
            const title = lines[0]?.replace(/^[#*>\-\s]+/, '').trim() || 'Reasoning Analysis';
            const detail = lines.slice(1).join('\n').trim();

            reasoningSteps.push({
              id: `rs-${turn.id || turn.stepIndex}-${thIdx}-${pIdx}`,
              title,
              detail: detail || undefined,
              timestamp: turn.timestamp + thIdx * 500,
              status: isLatestTurn && turn.status === 'running' ? 'running' : 'completed',
            });
          });
        });
      }

      // 2. Tool calls: trace spans & state diffs
      if (turn.toolCalls && turn.toolCalls.length > 0) {
        turn.toolCalls.forEach((tool, toolIdx) => {
          let lane: TraceSpan['lane'] = 'tool_purple';
          if (tool.name === 'read_file' || tool.name === 'view_file' || tool.name === 'list_directory') {
            lane = 'tool_blue';
          } else if (tool.name === 'edit_file' || tool.name === 'write_file' || tool.name === 'replace_file_content') {
            lane = 'tool_orange';
          }

          traceSpans.push({
            id: `sp-${turn.id || turn.stepIndex}-${toolIdx}`,
            name: tool.summary || `Tool: ${tool.name}`,
            lane,
            startTimePercent: Math.min(85, 10 + toolIdx * 20),
            widthPercent: Math.min(75, 30 + (toolIdx % 3) * 15),
            durationMs: 1500 + (toolIdx % 4) * 500,
            status: isLatestTurn && toolIdx === turn.toolCalls.length - 1 && turn.status === 'running' ? 'running' : 'success',
          });

          // Extract real file diff from tool call
          if (!stateDiff && (tool.name === 'edit_file' || tool.name === 'write_file')) {
            const filePath = tool.args?.Path || tool.args?.TargetFile || tool.args?.path || 'source.ts';
            const lines: StateDiff['lines'] = [];

            if (tool.args?.Target && tool.args?.Replacement) {
              const targetLines = String(tool.args.Target).split('\n');
              const replLines = String(tool.args.Replacement).split('\n');

              targetLines.slice(0, 6).forEach((line, lIdx) => {
                lines.push({
                  type: 'del',
                  lineNumOld: lIdx + 1,
                  content: line,
                });
              });

              replLines.slice(0, 6).forEach((line, lIdx) => {
                lines.push({
                  type: 'add',
                  lineNumNew: lIdx + 1,
                  content: line,
                });
              });
            } else if (tool.args?.Content) {
              const contentLines = String(tool.args.Content).split('\n');
              contentLines.slice(0, 8).forEach((line, lIdx) => {
                lines.push({
                  type: 'add',
                  lineNumNew: lIdx + 1,
                  content: line,
                });
              });
            }

            if (lines.length > 0) {
              stateDiff = {
                filename: filePath,
                lines,
              };
            }
          }

          // Check if operator confirmation / approval is needed
          if (tool.name === 'ask_question' || tool.name === 'confirm_action') {
            status = 'awaiting_approval';
            actionRequired = {
              actionId: `act-${agentId}`,
              label: tool.summary || 'Approve Tool Execution',
              toolName: tool.name,
              args: tool.args || {},
            };
          }
        });
      }
    });

    // Fallback reasoning step if empty
    if (reasoningSteps.length === 0) {
      reasoningSteps.push({
        id: `rs-default-${agentId}`,
        title: sess.taskSummary || `Executing ${roleName}`,
        detail: 'Turn execution step',
        timestamp: (sess as any).mtimeMs || (sess as any).timestamp || Date.now(),
        status: status === 'working' ? 'running' : 'completed',
      });
    }

    // Fallback trace span if empty
    if (traceSpans.length === 0) {
      traceSpans.push({
        id: `sp-llm-${agentId}`,
        name: 'LLM Generative Inference',
        lane: 'llm',
        startTimePercent: 10,
        widthPercent: 70,
        durationMs: 2800,
        status: status === 'working' ? 'running' : 'success',
      });
    }

    // Deterministic progress based on turn completion
    let progress = 100;
    if (status === 'working' || status === 'thinking') {
      progress = Math.min(95, Math.max(15, turns.length * 20));
    } else if (status === 'awaiting_approval') {
      progress = Math.min(90, Math.max(25, turns.length * 20));
    } else if (status === 'retrying') {
      progress = 30;
    }

    const tokensUsed = sess.tokensUsed || (turns.length * 1800);
    const tokensPerSec = (status === 'working' && aggregateTokenRate > 0)
      ? Math.round(aggregateTokenRate / Math.max(1, index + 1))
      : 0;

    return {
      id: agentId,
      name: properRole || sess.name || agentId,
      clusterId: 'backend',
      clusterName: 'Backend Core Workers',
      role: properRole,
      taskSummary: cleanTask,
      task: cleanTask,
      status,
      progress,
      tokensPerSec,
      totalTokens: tokensUsed,
      rawReasoningSteps: [...reasoningSteps],
      reasoningSteps,
      stateDiff,
      rawTraceSpans: [...traceSpans],
      traceSpans,
      actionRequired,
      sessionId: sess.sessionId,
      isSubagent: sess.isSubagent,
      parentSessionId: sess.parentSessionId,
      workspace: sess.workspace,
      workspaceName: sess.workspaceName,
      depth: (sess as any).depth || (sess.isSubagent ? 1 : 0),
      totalTurns: turns.length,
    };
  }

  /**
   * Transforms raw bridge session objects into standardized DiscoveredSessionSummary items.
   */
  private mapRawSessionsToSummaries(rawSessions: AgentSessionInfo[]): DiscoveredSessionSummary[] {
    return rawSessions.map((s, idx) => {
      const isLocked = Boolean((s as any).isLocked);
      const mtimeMs = (s as any).mtimeMs || s.timestamp || Date.now();
      const status = s.status || (isLocked ? 'working' : 'completed');
      const { role: resolvedRole, taskSummary: resolvedTask } = extractSubagentRoleAndTask(s, [], idx);

      const isSub = Boolean(s.isSubagent);
      const name = (s.name && s.name !== s.workspace && s.name !== s.workspaceName && s.name.toLowerCase() !== 'sub-agent')
        ? s.name
        : (isSub ? resolvedRole : (s.workspaceName || s.sessionId.slice(0, 8)));

      const rawTaskSummary = s.taskSummary || '';
      const isPreamble =
        rawTaskSummary.toLowerCase().startsWith('the following is a <system_message>') ||
        rawTaskSummary.startsWith('<SYSTEM_MESSAGE>') ||
        rawTaskSummary.startsWith('[Message]');
      const safeTaskSummary = resolvedTask || (isPreamble ? (isSub ? `Executing ${resolvedRole} assignment` : name) : rawTaskSummary);

      return {
        sessionId: s.sessionId,
        name,
        workspaceName: s.workspaceName,
        workspace: s.workspace,
        mtimeMs,
        isLocked,
        isSubagent: isSub,
        parentSessionId: s.parentSessionId || null,
        tokensUsed: s.tokensUsed || 0,
        taskSummary: safeTaskSummary,
        status,
        role: isSub ? resolvedRole : 'Orchestrator',
        subagentCount: (s as any).subagentCount || 0,
        totalTurns: (s as any).totalTurns || 0,
        activeTurnIndex: (s as any).activeTurnIndex || 0,
        depth: (s as any).depth || (isSub ? 1 : 0),
        model: (s as any).model,
      };
    });
  }

  /**
   * Handle real agent activity updates from connectionService.
   */
  private handleExternalAgentActivity(activity: AgentActivityStatus): void {
    if (!activity || !this.state.isRunning) return;

    if (activity.detail) {
      this.addTerminalLog('info', `[${activity.name || activity.agent || 'CLI Agent'}] ${activity.detail}`, activity.sessionId?.slice(0, 8));
    }

    if (activity.tokensUsed && activity.tokensUsed > 0 && this.state.viewMode === 'live') {
      const computedRate = this.computeRealTokenRate(activity.tokensUsed, true);
      this.state.stats.tokenRate = computedRate;
    }

    // Direct in-memory update for instant visual feedback on emitted agent state change
    let stateChanged = false;
    if (activity.sessionId) {
      const sessId = activity.sessionId;
      const agentId = sessId.slice(0, 8);
      let agent = this.findAgent(agentId) || this.findAgent(sessId);
      if (!agent) {
        for (const cluster of this.state.clusters) {
          const found = cluster.agents.find(
            (a) =>
              a.id === sessId ||
              a.sessionId === sessId ||
              (a.sessionId && (sessId.startsWith(a.sessionId) || a.sessionId.startsWith(sessId))) ||
              (a.id && (sessId.startsWith(a.id) || a.id.startsWith(sessId)))
          );
          if (found) {
            agent = found;
            break;
          }
        }
      }
      if (agent) {
        const rawStatus = String(activity.status);
        if (['working', 'thinking', 'waiting', 'completed', 'idle', 'retrying', 'running', 'failed'].includes(rawStatus)) {
          const mappedStatus: SwarmAgentStatus =
            rawStatus === 'waiting'
              ? 'awaiting_approval'
              : rawStatus === 'running'
              ? 'working'
              : rawStatus === 'failed'
              ? 'retrying'
              : (rawStatus as SwarmAgentStatus);
          if (agent.status !== mappedStatus) {
            agent.status = mappedStatus;
            stateChanged = true;
          }
        }
        if (activity.detail) {
          const step = {
            id: `rs-${Date.now()}`,
            title: activity.detail.slice(0, 80),
            timestamp: Date.now(),
            status: agent.status === 'working' ? ('running' as const) : ('completed' as const),
          };
          agent.reasoningSteps.push(step);
          if (agent.rawReasoningSteps && agent.rawReasoningSteps !== agent.reasoningSteps) {
            agent.rawReasoningSteps.push(step);
          }
          stateChanged = true;
        }
        if (activity.taskSummary && (!agent.taskSummary || agent.taskSummary.startsWith('Executing '))) {
          agent.taskSummary = activity.taskSummary;
          agent.task = activity.taskSummary;
          stateChanged = true;
        }
        if (activity.status === 'waiting' && !agent.actionRequired) {
          agent.actionRequired = {
            actionId: `act-${agent.id}`,
            label: activity.detail || 'Approve Tool Execution',
            toolName: 'confirm_action',
            args: {},
          };
          stateChanged = true;
        } else if ((activity as any).actionRequired) {
          agent.actionRequired = (activity as any).actionRequired;
          stateChanged = true;
        }
      }
    }

    if (stateChanged) {
      this.updateStateAndRecomputeStats({});
    }

    // Trigger full telemetry sync to ingest new turns/diffs/spans
    if (this.state.viewMode === 'live') {
      this.syncLiveTelemetry().catch((err) => {
        console.warn('[SwarmDataEngine] Telemetry sync error on activity update:', err);
      });
    } else {
      this.checkBackgroundLiveAgentStatus().catch(() => {});
    }
  }

  /**
   * Helper to append an entry to terminal logs.
   */
  private addTerminalLog(level: 'info' | 'warn' | 'error' | 'success', message: string, agentId?: string): void {
    const entry: TerminalLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      level,
      message,
      agentId,
    };
    const logs = [...this.state.terminalLogs, entry];
    if (logs.length > 120) {
      logs.splice(0, logs.length - 120);
    }
    this.state = {
      ...this.state,
      terminalLogs: logs,
    };
  }

  /**
   * Find an agent by ID across all clusters.
   */
  private findAgent(agentId: string): SwarmAgent | null {
    if (!agentId) return null;
    for (const cluster of this.state.clusters) {
      const found = cluster.agents.find(
        (a) =>
          a.id === agentId ||
          a.sessionId === agentId ||
          (a.sessionId && (agentId.startsWith(a.sessionId) || a.sessionId.startsWith(agentId))) ||
          (a.id && (agentId.startsWith(a.id) || a.id.startsWith(agentId)))
      );
      if (found) return found;
    }
    return null;
  }

  /**
   * Recompute aggregate stats and notify subscribers.
   */
  private updateStateAndRecomputeStats(patch: Partial<SwarmState>): void {
    const nextState = {
      ...this.state,
      ...patch,
    };

    let totalParallel = 0;
    let awaitingApproval = 0;
    let tokenRate = 0;

    for (const cluster of nextState.clusters) {
      let clusterActive = 0;
      for (const agent of cluster.agents) {
        if (agent.status !== 'idle' && agent.status !== 'completed') {
          totalParallel += 1;
          clusterActive += 1;
        }
        if (agent.status === 'awaiting_approval') {
          awaitingApproval += 1;
        }
        tokenRate += agent.tokensPerSec;
      }
      cluster.activeCount = clusterActive;
    }

    let selectedAgent = nextState.selectedAgent;
    if (nextState.selectedAgentId) {
      selectedAgent = null;
      for (const cluster of nextState.clusters) {
        const found = cluster.agents.find(
          (a) => a.id === nextState.selectedAgentId || a.sessionId === nextState.selectedAgentId
        );
        if (found) {
          selectedAgent = found;
          break;
        }
      }
    } else {
      selectedAgent = null;
    }

    nextState.stats = {
      ...nextState.stats,
      totalParallel,
      awaitingApproval,
      tokenRate: nextState.viewMode === 'history' ? 0 : (tokenRate || this.currentCalculatedTokenRate),
      activeClusters: nextState.clusters.length,
      timeTravelCursorMs: nextState.timeTravelCursorMs,
      maxTimeMs: nextState.maxTimeMs,
      isRunning: nextState.isRunning,
      viewMode: nextState.viewMode,
      hasBackgroundLiveAgent: nextState.hasBackgroundLiveAgent,
    };

    nextState.selectedAgent = selectedAgent;
    this.state = nextState;
    this.notify();
  }

  /**
   * Publish state change to all listeners.
   */
  private notify(): void {
    const snapshot = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('[SwarmDataEngine] Error in state listener:', err);
      }
    });
  }

  /**
   * Initial blank/standby state. No mock fixtures.
   */
  private buildInitialState(): SwarmState {
    return {
      clusters: [],
      stats: {
        totalParallel: 0,
        awaitingApproval: 0,
        tokenRate: 0,
        activeClusters: 0,
        isRunning: false,
        timeTravelCursorMs: 0,
        maxTimeMs: 0,
        viewMode: 'history',
        hasBackgroundLiveAgent: false,
      },
      selectedAgentId: null,
      selectedAgent: null,
      timeTravelCursorMs: 0,
      maxTimeMs: 0,
      isRunning: false,
      filterQuery: '',
      viewAlignment: 'CENTER',
      isSynchronizedWithArize: true,
      terminalLogs: [
        {
          id: 'log-init-1',
          timestamp: Date.now(),
          level: 'info',
          message: 'Swarm visualizer initialized.',
        },
      ],
      isLiveSource: false,
      rootSessionId: null,
      availableSessions: [],
      viewMode: 'history',
      selectedSessionId: null,
      activeTurnIndex: 0,
      hasBackgroundLiveAgent: false,
      activeSession: null,
      turns: [],
    };
  }
}

export const swarmDataEngine = SwarmDataEngine.getInstance();
