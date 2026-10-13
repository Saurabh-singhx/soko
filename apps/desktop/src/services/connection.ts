import {
  ConnectionStatus,
  PairedDevice,
  MirroredNotification,
  CliProcessStatus,
  FileTransferStatus,
  SokoPacketEnvelope,
} from '../types/index.ts';

type ConnectionEventListener = (status: ConnectionStatus, device: PairedDevice | null) => void;
type NotificationListener = (notification: MirroredNotification) => void;
type CliListener = (cli: CliProcessStatus) => void;
type TransferListener = (transfer: FileTransferStatus) => void;
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

  private constructor() {
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
            exitCode: packet.payload.exitCode,
          };
          this.cliListeners.forEach((l) => l(cli));
        }
        break;

      case 'FILE_OFFER':
      case 'FILE_PROGRESS':
      case 'FILE_COMPLETED':
        if (packet.payload) {
          const transfer: FileTransferStatus = {
            filename: packet.payload.filename || 'mobile-transfer.apk',
            bytesDownloaded: packet.payload.bytesDownloaded || 0,
            totalBytes: packet.payload.totalBytes || 52000000,
            speedBytesPerSec: packet.payload.speedBytesPerSec || 42000000,
            percentage: packet.payload.percentage || 0,
            status: packet.payload.status || 'active',
          };
          this.transferListeners.forEach((l) => l(transfer));
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
  public sendPacket(packet: SokoPacketEnvelope) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(packet));
    }
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

  public sendTestTransfer() {
    this.transferListeners.forEach((l) =>
      l({
        filename: 'soko-v1.0.0-release.apk',
        bytesDownloaded: 14000000,
        totalBytes: 52000000,
        speedBytesPerSec: 42000000,
        percentage: 27,
        status: 'active',
      })
    );
  }
}

export const connectionService = ConnectionManager.getInstance();
