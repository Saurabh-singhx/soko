/**
 * Dynamic Island modes and state definitions.
 */

export type IslandMode = 'compact' | 'notification' | 'cli' | 'transfer' | 'pairing';

export type MascotMood =
  | 'idle'
  | 'happy'
  | 'thinking'
  | 'working'
  | 'alert'
  | 'error'
  | 'searching';

export interface PairRequestPending {
  deviceId: string;
  deviceName: string;
  model: string;
  pin: string;
  ip?: string;
  timestamp: number;
}

export interface MirroredNotification {
  id: string;
  packageName: string;
  appName: string;
  title: string;
  body: string;
  timestamp: number;
  iconBase64?: string;
  hasReplyAction?: boolean;
  priority?: 'high' | 'normal' | 'low' | string;
  isImportant?: boolean;
}

export interface CliProcessStatus {
  commandId: string;
  title: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: number;
  lastOutputLine: string;
  output?: string;
  exitCode?: number;
}

export interface FileTransferStatus {
  id?: string;
  filename: string;
  bytesDownloaded: number;
  totalBytes: number;
  speedBytesPerSec: number;
  percentage: number;
  status: 'active' | 'completed' | 'failed' | 'cancelled';
  error?: string;
}

export interface TransferHistoryItem {
  id: string;
  filename: string;
  totalBytes: number;
  completedAt: number;
  direction: 'sent' | 'received';
  status: 'completed' | 'cancelled' | 'failed';
  sha256?: string;
}

export interface BluetoothDevice {
  name: string;
  id: string;
  rssi: number;
  isConnected: boolean;
}

export type ConnectionStatus = 'disconnected' | 'scanning' | 'connecting' | 'connected';
export type TransportProtocol = 'ble' | 'wifi' | 'dual';

export interface DiscoveredDevice {
  id: string;
  name: string;
  model: string;
  rssi: number;
  transport: TransportProtocol;
  isPaired?: boolean;
  ipAddress?: string;
  mac?: string;
}

export interface PairedDevice {
  id: string;
  name: string;
  model: string;
  rssi: number;
  pingMs: number;
  transport: TransportProtocol;
  batteryLevel?: number;
  lastSeen: number;
  isAuthorized: boolean;
  ipAddress?: string;
}

export interface SokoPacketEnvelope {
  magic: 'SK';
  version: 1;
  packetId: number;
  timestamp: number;
  packetType:
    | 'HEARTBEAT_PING'
    | 'HEARTBEAT_PONG'
    | 'BRIDGE_STATUS'
    | 'PAIR_REQUEST'
    | 'PAIR_REQUEST_PENDING'
    | 'PAIR_DECISION'
    | 'PAIR_CONFIRM'
    | 'PAIR_REJECT'
    | 'UNPAIR_REQUEST'
    | 'UNPAIR_CONFIRM'
    | 'REGENERATE_PIN'
    | 'PIN_UPDATED'
    | 'NOTIFICATION_POST'
    | 'NOTIFICATION_DISMISS'
    | 'CLI_EXECUTE'
    | 'CLI_OUTPUT_STREAM'
    | 'CLI_TERMINATED'
    | 'FILE_OFFER'
    | 'FILE_PROGRESS'
    | 'FILE_COMPLETED'
    | 'FILE_CANCEL'
    | 'FILE_FAILED'
    | 'FILE_RETRY'
    | 'AUDIO_STATUS'
    | 'FETCH_TOKEN_STATS'
    | 'TOKEN_STATS_UPDATE'
    | 'FETCH_AGENT_ACTIVITY'
    | 'AGENT_ACTIVITY_STATUS'
    | 'SIMULATE_AGENT_ACTIVITY';
  payload: Record<string, any>;
}

export type CliAgentId = 'antigravity' | 'codex' | 'claude' | null;

export interface AgentActivityStatus {
  agent: CliAgentId;
  name: string | null;
  status: 'working' | 'thinking' | 'completed' | 'idle';
  detail?: string;
  message?: string;
  tokensUsed?: number;
  inputTokens?: number;
  outputTokens?: number;
  timestamp: number;
}

export interface AssistantTokenStats {
  id: 'antigravity' | 'codex' | 'claude' | 'other';
  name: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  todayTokens: number;
  sessionsCount: number;
  color: string;
}

export interface RecentTokenSession {
  id: string;
  assistant: string;
  model?: string;
  tokens: number;
  timestamp: number;
  summary?: string;
}

export interface AiTokenSummary {
  totalTokens: number;
  todayTokens: number;
  cachedTokens?: number;
  totalSessions?: number;
  byPlatform?: {
    antigravity?: AssistantTokenStats;
    codex?: AssistantTokenStats;
    claude?: AssistantTokenStats;
  };
  assistants: AssistantTokenStats[];
  recentSessions: RecentTokenSession[];
  lastUpdated: number;
}

export interface AudioStreamStatus {
  isPlaying: boolean;
  isStreamingToMobile: boolean;
  activeListeners: number;
  format?: string;
  bitrate?: string;
  source?: string;
}

declare global {
  interface Window {
    electronAPI?: {
      platform: string;
      openSettings: () => void;
      closeSettings: () => void;
      openTransfersFolder: () => void;
      openFile: (filename: string) => void;
      openExternal: (url: string) => void;
      getVersion: () => Promise<string>;
      getAutoStart: () => Promise<boolean>;
      setAutoStart: (enable: boolean) => Promise<boolean>;
      moveWindow: (deltaX: number, deltaY: number) => void;
      resetPosition: () => void;
      setWindowSize: (width: number, height: number) => void;
      onWindowBlur: (callback: () => void) => () => void;
      quitApp: () => void;
    };
  }
}
