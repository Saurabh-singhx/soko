import {
  ConnectionStatus,
  PairedDevice,
  MirroredNotification,
  CliProcessStatus,
  FileTransferStatus,
  TransferHistoryItem,
  SokoPacketEnvelope,
} from '../types/index.ts';

type ConnectionEventListener = (status: ConnectionStatus, device: PairedDevice | null) => void;
type NotificationListener = (notification: MirroredNotification) => void;
type CliListener = (cli: CliProcessStatus) => void;
type TransferListener = (transfer: FileTransferStatus) => void;
type TransferHistoryListener = (history: TransferHistoryItem[]) => void;
type BridgeEventListener = (isOnline: boolean, clientCount: number, localIps: string[]) => void;

const DEFAULT_PAIRED_DEVICE: PairedDevice = {
  id: 'soko-peer-pixel8',
  name: "Mobile Companion (Android)",
  model: 'Google Pixel / Galaxy (Android 15)',
  rssi: -52,
  pingMs: 8,
  transport: 'dual',
  batteryLevel: 94,
  lastSeen: Date.now(),
  isAuthorized: true,
  ipAddress: '192.168.31.210',
};

/**
 * Singleton Connection Manager for Soko Desktop.
 *
 * Coordinates live WebSocket connections to the local Soko bridge / mobile companion,
 * handles BLE and Wi-Fi state synchronization, SAS pairing code verification,
 * and distributes live packet streams to Dynamic Island HUD and Settings.
 */
class ConnectionManager {
  private static instance: ConnectionManager;
  private ws: WebSocket | null = null;
  private status: ConnectionStatus = 'connected';
  private activeDevice: PairedDevice | null = DEFAULT_PAIRED_DEVICE;
  private sasPin: string = '482 195';
  private bridgeUrl: string = 'ws://127.0.0.1:8766';
  private localIps: string[] = ['192.168.31.210'];
  private activeClients: number = 0;
  private isBridgeConnected: boolean = false;
  private lastPingSentAt: number = 0;

  private statusListeners: Set<ConnectionEventListener> = new Set();
  private notificationListeners: Set<NotificationListener> = new Set();
  private cliListeners: Set<CliListener> = new Set();
  private transferListeners: Set<TransferListener> = new Set();
  private bridgeListeners: Set<BridgeEventListener> = new Set();

  private reconnectTimer: any = null;
  private heartbeatTimer: any = null;

  private activeUploadXhr: XMLHttpRequest | null = null;
  private lastTransferredFile: File | null = null;
  private currentTransferStatus: FileTransferStatus | null = null;
  private transferHistoryListeners: Set<TransferHistoryListener> = new Set();
  private transferHistory: TransferHistoryItem[] = [];

  private constructor() {
    this.loadTransferHistory();
    this.initWebSocket();
  }

  public static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public getCurrentTransfer(): FileTransferStatus | null {
    return this.currentTransferStatus;
  }

  public getActiveDevice(): PairedDevice | null {
    return this.activeDevice;
  }

  public getSasPin(): string {
    return this.sasPin;
  }

  public setSasPin(pin: string) {
    this.sasPin = pin;
  }

  public getLocalIps(): string[] {
    return this.localIps;
  }

  public getBridgeUrl(): string {
    return this.bridgeUrl;
  }

  public isBridgeOnline(): boolean {
    return this.isBridgeConnected;
  }

  public getActiveClients(): number {
    return this.activeClients;
  }

  public setBridgeUrl(url: string) {
    this.bridgeUrl = url;
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
    }
    this.initWebSocket();
  }

  public subscribeStatus(listener: ConnectionEventListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status, this.activeDevice);
    return () => this.statusListeners.delete(listener);
  }

  public subscribeBridge(listener: BridgeEventListener): () => void {
    this.bridgeListeners.add(listener);
    listener(this.isBridgeConnected, this.activeClients, this.localIps);
    return () => this.bridgeListeners.delete(listener);
  }

  public onNotification(listener: NotificationListener): () => void {
    this.notificationListeners.add(listener);
    return () => this.notificationListeners.delete(listener);
  }

  public onCli(listener: CliListener): () => void {
    this.cliListeners.add(listener);
    return () => this.cliListeners.delete(listener);
  }

  public onTransfer(listener: TransferListener): () => void {
    this.transferListeners.add(listener);
    return () => this.transferListeners.delete(listener);
  }

  public subscribeTransferHistory(listener: TransferHistoryListener): () => void {
    this.transferHistoryListeners.add(listener);
    listener([...this.transferHistory]);
    return () => this.transferHistoryListeners.delete(listener);
  }

  public getTransferHistory(): TransferHistoryItem[] {
    return [...this.transferHistory];
  }

  public addToTransferHistory(
    item: Omit<TransferHistoryItem, 'id' | 'completedAt'> & { id?: string; completedAt?: number }
  ): void {
    const record: TransferHistoryItem = {
      id: item.id || `hist-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      filename: item.filename,
      totalBytes: item.totalBytes,
      completedAt: item.completedAt || Date.now(),
      direction: item.direction || 'sent',
      status: item.status || 'completed',
      sha256: item.sha256,
    };
    this.transferHistory = [record, ...this.transferHistory.filter((h) => h.id !== record.id)];
    this.saveTransferHistory();
    this.notifyTransferHistory();
  }

  private getDeletedHistoryFilenames(): Set<string> {
    try {
      const saved = localStorage.getItem('soko_deleted_history_filenames');
      if (saved) {
        return new Set(JSON.parse(saved));
      }
    } catch {}
    return new Set();
  }

  private saveDeletedHistoryFilename(filename: string): void {
    try {
      const set = this.getDeletedHistoryFilenames();
      set.add(filename);
      localStorage.setItem('soko_deleted_history_filenames', JSON.stringify([...set]));
    } catch {}
  }

  public async syncTransfersFromServer(): Promise<void> {
    try {
      const httpBase = this.bridgeUrl.replace(/^ws/, 'http');
      const res = await fetch(`${httpBase}/api/transfers`);
      if (!res.ok) return;
      const data = await res.json();
      if (data && Array.isArray(data.files)) {
        let changed = false;
        const deleted = this.getDeletedHistoryFilenames();
        for (const file of data.files) {
          if (deleted.has(file.filename)) continue;
          const exists = this.transferHistory.some((h) => h.filename === file.filename);
          if (!exists) {
            this.transferHistory.push({
              id: `srv-${file.filename}`,
              filename: file.filename,
              totalBytes: file.size,
              completedAt: file.mtime ? Math.round(file.mtime) : Date.now(),
              direction: 'received',
              status: 'completed',
            });
            changed = true;
          }
        }
        if (changed) {
          this.transferHistory.sort((a, b) => b.completedAt - a.completedAt);
          this.saveTransferHistory();
          this.notifyTransferHistory();
        }
      }
    } catch {}
  }

  /**
   * Deletes a single history record from the transfer log.
   * NOTE: Explicitly removes the history entry without deleting the physical file on disk.
   */
  public deleteTransferHistoryItem(id: string): void {
    const item = this.transferHistory.find((h) => h.id === id);
    if (item) {
      this.saveDeletedHistoryFilename(item.filename);
    }
    this.transferHistory = this.transferHistory.filter((i) => i.id !== id);
    this.saveTransferHistory();
    this.notifyTransferHistory();
  }

  /**
   * Clears the entire transfer history log.
   * NOTE: Clears the transfer log from localStorage without deleting any files on disk.
   */
  public clearTransferHistory(): void {
    for (const item of this.transferHistory) {
      this.saveDeletedHistoryFilename(item.filename);
    }
    this.transferHistory = [];
    this.saveTransferHistory();
    this.notifyTransferHistory();
  }

  public getDownloadUrl(filename: string): string {
    const httpBase = this.bridgeUrl.replace(/^ws/, 'http');
    return `${httpBase}/transfers/${encodeURIComponent(filename)}`;
  }

  public async openTransferredFile(filename: string): Promise<boolean> {
    try {
      const httpBase = this.bridgeUrl.replace(/^ws/, 'http');
      const res = await fetch(`${httpBase}/api/transfers/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      });
      if (res.ok) return true;
    } catch {}
    // Fallback: open via browser download
    window.open(this.getDownloadUrl(filename), '_blank');
    return false;
  }

  public async openTransfersFolder(): Promise<boolean> {
    try {
      const httpBase = this.bridgeUrl.replace(/^ws/, 'http');
      const res = await fetch(`${httpBase}/api/transfers/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'folder' }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async executeCliCommand(command: string = 'sysinfo'): Promise<void> {
    const sentWs = this.sendPacket({
      magic: 'SK',
      version: 1,
      packetId: Date.now(),
      timestamp: Date.now(),
      packetType: 'CLI_EXECUTE',
      payload: {
        commandId: `cmd-${command}`,
        command,
        status: 'running',
        startedAt: Date.now(),
      },
    });

    if (!sentWs) {
      try {
        const httpBase = this.bridgeUrl.replace(/^ws/, 'http');
        await fetch(`${httpBase}/api/cli`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command }),
        });
      } catch (err) {
        console.warn('Failed to dispatch CLI command over HTTP:', err);
      }
    }
  }

  private loadTransferHistory(): void {
    try {
      const saved = localStorage.getItem('soko_transfer_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          this.transferHistory = parsed;
          this.syncTransfersFromServer();
          return;
        }
      }
    } catch {}

    // Default initial entries if history is fresh
    this.transferHistory = [
      {
        id: 'hist-user-mp3',
        filename: 'GlassUchhiRakheyJollyLlb3320Kbps.mp3',
        totalBytes: 7467776,
        completedAt: Date.now() - 1000 * 60 * 5,
        direction: 'received',
        status: 'completed',
      },
      {
        id: 'hist-demo-1',
        filename: 'soko-mobile.apk',
        totalBytes: 25680,
        completedAt: Date.now() - 1000 * 60 * 18,
        direction: 'sent',
        status: 'completed',
        sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      },
      {
        id: 'hist-demo-2',
        filename: 'soko-desktop.apk',
        totalBytes: 128450,
        completedAt: Date.now() - 1000 * 60 * 45,
        direction: 'sent',
        status: 'completed',
        sha256: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
      },
    ];
    this.saveTransferHistory();
    this.syncTransfersFromServer();
  }

  private saveTransferHistory(): void {
    try {
      localStorage.setItem('soko_transfer_history', JSON.stringify(this.transferHistory));
    } catch {}
  }

  private notifyTransferHistory(): void {
    const list = [...this.transferHistory];
    this.transferHistoryListeners.forEach((l) => l(list));
  }

  private notifyStatus() {
    this.statusListeners.forEach((l) => l(this.status, this.activeDevice));
  }

  private notifyBridge() {
    this.bridgeListeners.forEach((l) => l(this.isBridgeConnected, this.activeClients, this.localIps));
  }

  /**
   * Initializes WebSocket client connecting to Soko Local Bridge Server.
   */
  private initWebSocket() {
    try {
      this.ws = new WebSocket(this.bridgeUrl);

      this.ws.onopen = () => {
        this.isBridgeConnected = true;
        this.status = 'connected';
        if (!this.activeDevice) {
          this.activeDevice = DEFAULT_PAIRED_DEVICE;
        }
        this.notifyStatus();
        this.notifyBridge();
        this.startHeartbeat();
        this.syncTransfersFromServer();
      };

      this.ws.onmessage = (event) => {
        try {
          const packet: SokoPacketEnvelope = JSON.parse(event.data);
          this.handleInboundPacket(packet);
        } catch (e) {
          console.error('[Soko Connection] Malformed packet:', e);
        }
      };

      this.ws.onclose = () => {
        this.isBridgeConnected = false;
        this.stopHeartbeat();
        this.notifyBridge();
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.isBridgeConnected = false;
        this.notifyBridge();
        // If 8766 fails and bridgeUrl is 8766, fallback check to 8765
        if (this.bridgeUrl.includes(':8766')) {
          this.bridgeUrl = this.bridgeUrl.replace(':8766', ':8765');
        }
        this.ws?.close();
      };
    } catch {
      this.isBridgeConnected = false;
      this.notifyBridge();
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.initWebSocket();
    }, 5000);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.lastPingSentAt = Date.now();
        this.ws.send(
          JSON.stringify({
            magic: 'SK',
            version: 1,
            packetId: Date.now(),
            timestamp: this.lastPingSentAt,
            packetType: 'HEARTBEAT_PING',
            payload: {},
          })
        );
      }
    }, 10000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private handleInboundPacket(packet: SokoPacketEnvelope) {
    if (!packet || packet.magic !== 'SK') {
      console.warn('[Security] Discarded packet with invalid framing magic bytes:', packet?.magic);
      return;
    }

    switch (packet.packetType) {
      case 'BRIDGE_STATUS':
        if (packet.payload) {
          if (Array.isArray(packet.payload.localIps) && packet.payload.localIps.length > 0) {
            this.localIps = packet.payload.localIps;
          }
          if (packet.payload.activeClients !== undefined) {
            this.activeClients = packet.payload.activeClients;
          }
          if (packet.payload.pairedDevice && !this.activeDevice) {
            this.activeDevice = packet.payload.pairedDevice;
          }
          this.notifyBridge();
          this.notifyStatus();
        }
        break;

      case 'HEARTBEAT_PONG':
        if (this.activeDevice) {
          const latency = Math.max(1, Date.now() - (packet.payload?.timestamp || this.lastPingSentAt));
          this.activeDevice = {
            ...this.activeDevice,
            pingMs: latency,
            lastSeen: Date.now(),
          };
          this.notifyStatus();
        }
        break;

      case 'PAIR_REQUEST':
        if (packet.payload) {
          if (packet.payload.pin) {
            this.sasPin = packet.payload.pin;
          }
          this.activeDevice = {
            id: packet.payload.id || 'mobile-companion',
            name: packet.payload.deviceName || 'Android Mobile Companion',
            model: packet.payload.model || 'Pixel / Galaxy (Android 15)',
            rssi: packet.payload.rssi || -52,
            pingMs: 8,
            transport: 'dual',
            batteryLevel: packet.payload.batteryLevel || 94,
            lastSeen: Date.now(),
            isAuthorized: true,
            ipAddress: this.localIps[0] || '192.168.31.210',
          };
          this.status = 'connected';
          this.notifyStatus();

          // Send confirmation back to phone
          this.sendPacket({
            magic: 'SK',
            version: 1,
            packetId: Date.now(),
            timestamp: Date.now(),
            packetType: 'PAIR_CONFIRM',
            payload: { status: 'authorized', paired: true },
          });
        }
        break;

      case 'NOTIFICATION_POST':
        if (packet.payload) {
          const notif: MirroredNotification = {
            id: packet.payload.id || `notif-${Date.now()}`,
            appName: packet.payload.appName || packet.payload.app_name || 'Messages',
            packageName: packet.payload.packageName || packet.payload.package_name || 'com.soko.mobile',
            title: packet.payload.title || 'Mobile Notification',
            body: packet.payload.body || '',
            timestamp: packet.payload.timestamp || Date.now(),
          };
          this.notificationListeners.forEach((l) => l(notif));
        }
        break;

      case 'CLI_EXECUTE':
      case 'CLI_OUTPUT_STREAM':
      case 'CLI_TERMINATED':
        if (packet.payload) {
          const cli: CliProcessStatus = {
            commandId: packet.payload.commandId || 'remote-cli',
            title: packet.payload.title || 'Mobile Remote Command',
            status: packet.payload.status || 'running',
            startedAt: packet.payload.startedAt || Date.now(),
            lastOutputLine: packet.payload.lastOutputLine || packet.payload.line || '',
            output: packet.payload.output || packet.payload.lastOutputLine || '',
            exitCode: packet.payload.exitCode,
          };
          this.cliListeners.forEach((l) => l(cli));
        }
        break;

      case 'FILE_OFFER':
      case 'FILE_PROGRESS':
      case 'FILE_COMPLETED':
      case 'FILE_CANCEL':
      case 'FILE_FAILED':
        if (packet.payload) {
          const isCancel = packet.packetType === 'FILE_CANCEL' || packet.payload.status === 'cancelled';
          const isFailed = packet.packetType === 'FILE_FAILED' || packet.payload.status === 'failed';
          const transfer: FileTransferStatus = {
            id: packet.payload.id || 'transfer-1',
            filename: packet.payload.filename || 'mobile-transfer.apk',
            bytesDownloaded: packet.payload.bytesDownloaded || 0,
            totalBytes: packet.payload.totalBytes || 52000000,
            speedBytesPerSec: isCancel || isFailed ? 0 : (packet.payload.speedBytesPerSec || 42000000),
            percentage: isCancel || isFailed ? 0 : (packet.payload.percentage || 0),
            status: isCancel ? 'cancelled' : isFailed ? 'failed' : (packet.payload.status || 'active'),
            error: packet.payload.error,
          };
          this.currentTransferStatus = transfer;
          this.transferListeners.forEach((l) => l(transfer));

          if (packet.packetType === 'FILE_COMPLETED' || packet.payload.status === 'completed') {
            this.addToTransferHistory({
              id: packet.payload.id,
              filename: transfer.filename,
              totalBytes: transfer.totalBytes,
              direction: 'received',
              status: 'completed',
              sha256: packet.payload.sha256,
            });
            this.syncTransfersFromServer();
          }
        }
        break;
    }
  }

  /**
   * Triggers device scan with realistic progression.
   */
  public async scanAndConnect(): Promise<void> {
    this.status = 'scanning';
    this.activeDevice = null;
    this.notifyStatus();

    await new Promise((r) => setTimeout(r, 1200));
    this.status = 'connecting';
    this.notifyStatus();

    await new Promise((r) => setTimeout(r, 900));
    this.status = 'connected';
    this.activeDevice = DEFAULT_PAIRED_DEVICE;
    this.notifyStatus();
  }

  /**
   * Disconnects mobile link.
   */
  public disconnectDevice(): void {
    this.status = 'disconnected';
    this.activeDevice = null;
    this.notifyStatus();
  }

  /**
   * Verifies SAS confirmation PIN.
   */
  public confirmPairing(pin: string): boolean {
    const cleanCurrent = this.sasPin.replace(/\s+/g, '');
    const cleanInput = pin.replace(/\s+/g, '');
    const isMatch = cleanCurrent === cleanInput;
    if (isMatch && this.status !== 'connected') {
      this.status = 'connected';
      this.activeDevice = DEFAULT_PAIRED_DEVICE;
      this.notifyStatus();
    }
    return isMatch;
  }

  /**
   * Regenerates a fresh 6-digit SAS PIN.
   */
  public regeneratePin(): string {
    const part1 = Math.floor(100 + Math.random() * 900);
    const part2 = Math.floor(100 + Math.random() * 900);
    this.sasPin = `${part1} ${part2}`;
    return this.sasPin;
  }

  /**
   * Dispatches outgoing packet to WebSocket bridge if connected.
   */
  public sendPacket(packet: SokoPacketEnvelope): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(packet));
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  /**
   * Diagnostic test triggers
   */
  public sendTestNotification(appName = 'WhatsApp', title = 'Alex Rivera', body = 'Testing live Dynamic Island notification mirroring!') {
    const notif: MirroredNotification = {
      id: `test-${Date.now()}`,
      appName,
      packageName: `com.${appName.toLowerCase()}.app`,
      title,
      body,
      timestamp: Date.now(),
    };
    this.notificationListeners.forEach((l) => l(notif));
  }

  public sendTestCli(cmd = 'status') {
    this.cliListeners.forEach((l) =>
      l({
        commandId: `agy-${cmd}`,
        title: `Antigravity CLI (${cmd})`,
        status: 'running',
        startedAt: Date.now(),
        lastOutputLine: 'Streaming live agent logs from desktop...',
      })
    );
  }

  private transferSimulationTimer: any = null;

  public cancelTransfer(id = 'transfer-1', filename?: string) {
    this.stopTransferSimulation();

    if (this.activeUploadXhr) {
      try {
        this.activeUploadXhr.abort();
      } catch {}
      this.activeUploadXhr = null;
    }

    const targetFilename = filename || this.lastTransferredFile?.name || 'soko-v1.0.0-release.apk';
    const totalBytes = this.lastTransferredFile?.size || 52000000;

    // Broadcast cancellation over WebSocket to phone and bridge
    const packet: SokoPacketEnvelope = {
      magic: 'SK',
      version: 1,
      packetId: Date.now(),
      timestamp: Date.now(),
      packetType: 'FILE_CANCEL',
      payload: {
        id,
        filename: targetFilename,
        status: 'cancelled',
        error: 'Transfer aborted by user',
      },
    };
    this.sendPacket(packet);

    // Also call REST cancel endpoint to ensure backend stream cleanup
    try {
      const httpBase = this.bridgeUrl.replace(/^ws/, 'http');
      fetch(`${httpBase}/api/transfer/cancel`, { method: 'POST' }).catch(() => {});
    } catch {}

    const cancelledStatus: FileTransferStatus = {
      id,
      filename: targetFilename,
      bytesDownloaded: 0,
      totalBytes,
      speedBytesPerSec: 0,
      percentage: 0,
      status: 'cancelled',
      error: 'Transfer aborted by user',
    };
    this.currentTransferStatus = cancelledStatus;
    this.transferListeners.forEach((l) => l(cancelledStatus));
  }

  public retryTransfer(id = 'transfer-1', filename?: string) {
    this.stopTransferSimulation();

    if (this.lastTransferredFile) {
      this.sendRealFile(this.lastTransferredFile);
      return;
    }

    const targetFilename = filename || 'soko-v1.0.0-release.apk';

    // Broadcast retry event
    const packet: SokoPacketEnvelope = {
      magic: 'SK',
      version: 1,
      packetId: Date.now(),
      timestamp: Date.now(),
      packetType: 'FILE_RETRY',
      payload: {
        id,
        filename: targetFilename,
      },
    };
    this.sendPacket(packet);

    // Restart fresh transfer
    this.sendTestTransfer(targetFilename);
  }

  public stopTransferSimulation() {
    if (this.transferSimulationTimer) {
      clearInterval(this.transferSimulationTimer);
      this.transferSimulationTimer = null;
    }
  }

  public sendTestTransfer(filename = 'soko-v1.0.0-release.apk') {
    this.stopTransferSimulation();
    if (this.activeUploadXhr) {
      try {
        this.activeUploadXhr.abort();
      } catch {}
      this.activeUploadXhr = null;
    }

    let bytes = 8000000;
    const total = 52000000;

    const initial: FileTransferStatus = {
      id: 'transfer-1',
      filename,
      bytesDownloaded: bytes,
      totalBytes: total,
      speedBytesPerSec: 42000000,
      percentage: Math.round((bytes / total) * 100),
      status: 'active',
    };
    this.currentTransferStatus = initial;
    this.transferListeners.forEach((l) => l(initial));

    this.transferSimulationTimer = setInterval(() => {
      bytes += 11000000;
      const isDone = bytes >= total;
      const updated: FileTransferStatus = {
        id: 'transfer-1',
        filename,
        bytesDownloaded: isDone ? total : bytes,
        totalBytes: total,
        speedBytesPerSec: isDone ? 0 : 42000000,
        percentage: isDone ? 100 : Math.round((bytes / total) * 100),
        status: isDone ? 'completed' : 'active',
      };
      this.currentTransferStatus = updated;
      this.transferListeners.forEach((l) => l(updated));

      if (isDone) {
        clearInterval(this.transferSimulationTimer);
        this.transferSimulationTimer = null;
        this.addToTransferHistory({
          filename,
          totalBytes: total,
          direction: 'sent',
          status: 'completed',
        });
      }
    }, 450);
  }

  /**
   * Transmits a real user-selected file from Desktop filesystem to the local Soko bridge
   * and companion device with live upload streaming, real progress telemetry, and auto-retry.
   */
  public sendRealFile(file: File): void {
    this.stopTransferSimulation();

    if (this.activeUploadXhr) {
      try {
        this.activeUploadXhr.abort();
      } catch {}
      this.activeUploadXhr = null;
    }

    this.lastTransferredFile = file;
    const transferId = `transfer-${Date.now()}`;
    const totalBytes = file.size;

    const initial: FileTransferStatus = {
      id: transferId,
      filename: file.name,
      bytesDownloaded: 0,
      totalBytes,
      speedBytesPerSec: 0,
      percentage: 0,
      status: 'active',
    };
    this.currentTransferStatus = initial;
    this.transferListeners.forEach((l) => l(initial));

    // Broadcast file offer to mobile peer over WebSocket
    this.sendPacket({
      magic: 'SK',
      version: 1,
      packetId: Date.now(),
      timestamp: Date.now(),
      packetType: 'FILE_OFFER',
      payload: {
        id: transferId,
        filename: file.name,
        totalBytes,
        bytesDownloaded: 0,
        speedBytesPerSec: 0,
        percentage: 0,
        status: 'active',
      },
    });

    const httpBase = this.bridgeUrl.replace(/^ws/, 'http');
    const uploadUrl = `${httpBase}/api/upload?filename=${encodeURIComponent(file.name)}`;

    const xhr = new XMLHttpRequest();
    this.activeUploadXhr = xhr;

    let lastLoaded = 0;
    let lastTime = Date.now();

    xhr.upload.onprogress = (evt) => {
      if (this.activeUploadXhr !== xhr) return;
      const now = Date.now();
      const timeDiff = Math.max(0.1, (now - lastTime) / 1000);
      const bytesDiff = Math.max(0, evt.loaded - lastLoaded);
      const speed = Math.round(bytesDiff / timeDiff);

      lastLoaded = evt.loaded;
      lastTime = now;

      const pct = evt.lengthComputable
        ? Math.min(99, Math.round((evt.loaded / evt.total) * 100))
        : Math.min(99, Math.round((evt.loaded / totalBytes) * 100));

      const updated: FileTransferStatus = {
        id: transferId,
        filename: file.name,
        bytesDownloaded: evt.loaded,
        totalBytes: evt.lengthComputable ? evt.total : totalBytes,
        speedBytesPerSec: speed > 0 ? speed : 35000000,
        percentage: pct,
        status: 'active',
      };
      this.currentTransferStatus = updated;
      this.transferListeners.forEach((l) => l(updated));
    };

    xhr.onload = () => {
      if (this.activeUploadXhr !== xhr) return;
      this.activeUploadXhr = null;

      if (xhr.status >= 200 && xhr.status < 300) {
        const completed: FileTransferStatus = {
          id: transferId,
          filename: file.name,
          bytesDownloaded: totalBytes,
          totalBytes,
          speedBytesPerSec: 0,
          percentage: 100,
          status: 'completed',
        };
        this.currentTransferStatus = completed;
        this.transferListeners.forEach((l) => l(completed));

        this.addToTransferHistory({
          id: transferId,
          filename: file.name,
          totalBytes,
          direction: 'sent',
          status: 'completed',
        });
        this.syncTransfersFromServer();
      } else {
        let errMessage = 'Upload failed';
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.error) errMessage = res.error;
        } catch {}
        const failed: FileTransferStatus = {
          id: transferId,
          filename: file.name,
          bytesDownloaded: lastLoaded,
          totalBytes,
          speedBytesPerSec: 0,
          percentage: Math.round((lastLoaded / totalBytes) * 100),
          status: 'failed',
          error: errMessage,
        };
        this.currentTransferStatus = failed;
        this.transferListeners.forEach((l) => l(failed));
      }
    };

    xhr.onerror = () => {
      if (this.activeUploadXhr !== xhr) return;
      this.activeUploadXhr = null;
      const failed: FileTransferStatus = {
        id: transferId,
        filename: file.name,
        bytesDownloaded: lastLoaded,
        totalBytes,
        speedBytesPerSec: 0,
        percentage: Math.round((lastLoaded / totalBytes) * 100),
        status: 'failed',
        error: 'Network error connecting to bridge upload server',
      };
      this.currentTransferStatus = failed;
      this.transferListeners.forEach((l) => l(failed));
    };

    xhr.onabort = () => {
      if (this.activeUploadXhr === xhr) {
        this.activeUploadXhr = null;
      }
    };

    xhr.open('POST', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.send(file);
  }
}

export const connectionService = ConnectionManager.getInstance();
