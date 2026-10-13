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
    | 'AUDIO_STATUS';
  payload: Record<string, any>;
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
      moveWindow: (deltaX: number, deltaY: number) => void;
      resetPosition: () => void;
      setWindowSize: (width: number, height: number) => void;
      onWindowBlur: (callback: () => void) => () => void;
      quitApp: () => void;
    };
  }
}
