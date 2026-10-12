/**
 * Dynamic Island modes and state definitions.
 */

export type IslandMode = 'compact' | 'notification' | 'cli' | 'transfer';

export type MascotMood =
  | 'idle'
  | 'happy'
  | 'thinking'
  | 'working'
  | 'alert'
  | 'error'
  | 'searching';

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
  exitCode?: number;
}

export interface FileTransferStatus {
  filename: string;
  bytesDownloaded: number;
  totalBytes: number;
  speedBytesPerSec: number;
  percentage: number;
  status: 'active' | 'completed' | 'failed';
}

export interface BluetoothDevice {
  name: string;
  id: string;
  rssi: number;
  isConnected: boolean;
}
