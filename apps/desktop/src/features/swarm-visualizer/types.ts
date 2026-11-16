/**
 * Types & Interfaces for Soko Multi-Agent Swarm Visualizer
 *
 * Implements real-time visualization of multi-agent topologies, cluster groups,
 * reasoning trees, state diffs, trace waterfalls, and interactive approval flows.
 */

export type SwarmAgentStatus =
  | 'working'
  | 'thinking'
  | 'awaiting_approval'
  | 'retrying'
  | 'completed'
  | 'idle';

export type SwarmClusterId = 'backend' | 'auditor' | 'qa' | string;

export type SwarmClusterIcon =
  | 'worker'
  | 'auditor'
  | 'qa'
  | 'security'
  | 'database'
  | 'code'
  | 'test'
  | 'deploy'
  | 'design'
  | 'analytics'
  | 'network'
  | 'monitor'
  | string;

export type SwarmTraceLane = 'llm' | 'tool_blue' | 'tool_orange' | 'tool_purple';

export type SwarmTraceStatus = 'running' | 'success' | 'failed';

export interface ReasoningChild {
  id: string;
  text: string;
}

export interface ReasoningStep {
  id: string;
  title: string;
  detail?: string;
  timestamp: number;
  status: 'completed' | 'running' | 'pending';
  children?: ReasoningChild[];
}

export interface DiffLine {
  type: 'add' | 'del' | 'normal';
  lineNumOld?: number;
  lineNumNew?: number;
  content: string;
}

export interface StateDiff {
  filename: string;
  lines: DiffLine[];
}

export interface TraceSpan {
  id: string;
  name: string;
  lane: SwarmTraceLane;
  startTimePercent: number; // 0 - 100
  widthPercent: number;     // 0 - 100
  durationMs: number;
  status: SwarmTraceStatus;
}

export interface ActionRequired {
  actionId: string;
  label: string;
  toolName: string;
  args: Record<string, any>;
}

export interface TranscriptToolCall {
  name: string;
  summary: string;
  args: Record<string, any>;
}

export interface TranscriptTurn {
  id: string;
  stepIndex: number;
  timestamp: number;
  userInput: string;
  thinking: string[];
  toolCalls: TranscriptToolCall[];
  responses: string[];
  status: 'completed' | 'running' | 'failed' | 'pending';
}

export interface AgentTranscriptResponse {
  success: boolean;
  sessionId?: string;
  totalTurns?: number;
  isWorking?: boolean;
  isWaiting?: boolean;
  cursor?: number;
  turns?: TranscriptTurn[];
  error?: string;
}

export interface SwarmAgent {
  id: string;
  name: string;
  clusterId: SwarmClusterId;
  clusterName: string;
  role: string;
  status: SwarmAgentStatus;
  progress: number; // 0 - 100
  tokensPerSec: number;
  totalTokens: number;
  rawReasoningSteps?: ReasoningStep[];
  reasoningSteps: ReasoningStep[];
  stateDiff?: StateDiff;
  rawTraceSpans?: TraceSpan[];
  traceSpans: TraceSpan[];
  actionRequired?: ActionRequired;
  sessionId?: string;
  model?: string;
  turnIndex?: number;
  inputTokens?: number;
  outputTokens?: number;
  lastModified?: number;
  isSubagent?: boolean;
  parentSessionId?: string | null;
  workspace?: string;
  workspaceName?: string;
  // Dynamic role & hierarchy fields
  depth?: number;
  roleCategory?: string;
  roleIcon?: string;
  roleColor?: string;
  subagentCount?: number;
  totalTurns?: number;
  taskSummary?: string;
  task?: string;
}

export interface AgentCluster {
  id: string;
  name: string;
  iconType: 'worker' | 'auditor' | 'qa' | string;
  activeCount: number;
  isCollapsed?: boolean;
  agents: SwarmAgent[];
  role?: string;
  roleCategory?: string;
  themeColor?: string;
  accentColor?: string;
}

export interface SwarmStats {
  totalParallel: number;
  awaitingApproval: number;
  tokenRate: number; // aggregate tok/s
  activeClusters: number;
  isRunning: boolean;
  timeTravelCursorMs: number;
  maxTimeMs: number;
  viewMode?: 'live' | 'history';
  hasBackgroundLiveAgent?: boolean;
}

export interface TerminalLogEntry {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  agentId?: string;
}

export interface DiscoveredSessionSummary {
  sessionId: string;
  name: string;
  workspaceName?: string;
  workspace?: string;
  mtimeMs: number;
  isLocked?: boolean;
  isSubagent?: boolean;
  parentSessionId?: string | null;
  tokensUsed?: number;
  taskSummary?: string;
  status?: string;
  role?: string;
  subagentCount?: number;
  totalTurns?: number;
  activeTurnIndex?: number;
  depth?: number;
  model?: string;
  createdAt?: number;
  completedAt?: number;
  durationMs?: number;
  hasSubagents?: boolean;
}

export interface SwarmState {
  clusters: AgentCluster[];
  stats: SwarmStats;
  selectedAgentId: string | null;
  selectedAgent: SwarmAgent | null;
  timeTravelCursorMs: number;
  maxTimeMs: number;
  isRunning: boolean;
  filterQuery: string;
  viewAlignment: 'CENTER' | 'TOP' | 'BOTTOM';
  isSynchronizedWithArize: boolean;
  terminalLogs: TerminalLogEntry[];
  isLiveSource: boolean;
  rootSessionId?: string | null;
  availableSessions: DiscoveredSessionSummary[];
  viewMode: 'live' | 'history';
  selectedSessionId: string | null;
  activeTurnIndex: number;
  hasBackgroundLiveAgent: boolean;
  activeSession?: DiscoveredSessionSummary | null;
  turns?: TranscriptTurn[];
}

export type SwarmStateListener = (state: SwarmState) => void;
