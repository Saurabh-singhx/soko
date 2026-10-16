import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  FolderDown,
  ShieldCheck,
  Smartphone,
  Plus,
  Trash2,
  Lock,
  Unlock,
  CheckCircle2,
  X,
  Sliders,
  RefreshCw,
  Power,
  Globe,
  Copy,
  Check,
  ExternalLink,
  UploadCloud,
  FileUp,
  AlertCircle,
  RotateCcw,
  Ban,
  History,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  Sparkles,
  Bluetooth,
  Wifi,
  Headphones,
  ArrowLeft,
  Zap,
  Cpu,
  Database,
  Layers,
} from 'lucide-react';
import { connectionService } from '../../services/connection.ts';
import { autoUpdateService, UpdateInfo, CURRENT_VERSION } from '../../services/updater.ts';
import { ConnectionStatus, PairedDevice, DiscoveredDevice, FileTransferStatus, TransferHistoryItem, AiTokenSummary, AgentActivityStatus } from '../../types/index.ts';
import { CharacterSelector } from '../../characters/CharacterSelector.tsx';

interface SettingsViewProps {
  onClose?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'pairing' | 'tokens' | 'cli' | 'files' | 'security' | 'mascot' | 'updates'>(() => {
    try {
      const stored = localStorage.getItem('soko_settings_initial_tab');
      if (stored && ['general', 'pairing', 'tokens', 'cli', 'files', 'security', 'mascot', 'updates'].includes(stored)) {
        localStorage.removeItem('soko_settings_initial_tab');
        return stored as any;
      }
    } catch {}
    return 'pairing';
  });
  const [autoStartEnabled, setAutoStartEnabled] = useState<boolean>(true);
  const [isSavingAutoStart, setIsSavingAutoStart] = useState<boolean>(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(autoUpdateService.getCachedUpdateInfo());
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [feedUrlInput, setFeedUrlInput] = useState(autoUpdateService.getFeedUrl());
  const [feedSaved, setFeedSaved] = useState(false);
  const [mascotIdleTimeout, setMascotIdleTimeout] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('soko_idle_timeout');
      if (stored !== null) {
        const val = parseInt(stored, 10);
        if (!isNaN(val)) return val;
      }
    } catch {}
    return 60000;
  });

  useEffect(() => {
    const cleanup = (window as any).electronAPI?.onSwitchSettingsTab?.((tab: any) => {
      if (['general', 'pairing', 'tokens', 'cli', 'files', 'security', 'mascot', 'updates'].includes(tab)) {
        setActiveTab(tab);
      }
    });
    return () => cleanup?.();
  }, []);
  const [cursorTrackingEnabled, setCursorTrackingEnabled] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('soko_cursor_tracking');
      return stored !== null ? stored !== 'false' : true;
    } catch {
      return true;
    }
  });
  const [agentActivity, setAgentActivity] = useState<AgentActivityStatus | null>(() =>
    connectionService.getAgentActivity()
  );

  const handleToggleCursorTracking = () => {
    const nextVal = !cursorTrackingEnabled;
    setCursorTrackingEnabled(nextVal);
    try {
      localStorage.setItem('soko_cursor_tracking', String(nextVal));
      window.dispatchEvent(new Event('soko:cursor-tracking-changed'));
    } catch {}
  };
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    connectionService.getStatus()
  );
  const [pairedDevice, setPairedDevice] = useState<PairedDevice | null>(
    connectionService.getActiveDevice()
  );
  const [pairingPin, setPairingPin] = useState(connectionService.getSasPin());
  const [copiedMobileUrl, setCopiedMobileUrl] = useState(false);
  const [isBridgeOnline, setIsBridgeOnline] = useState(connectionService.isBridgeOnline());
  const [activeClients, setActiveClients] = useState(connectionService.getActiveClients());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTransfer, setActiveTransfer] = useState<FileTransferStatus | null>(
    connectionService.getCurrentTransfer()
  );
  const [isDragging, setIsDragging] = useState(false);
  const [transferHistory, setTransferHistory] = useState<TransferHistoryItem[]>(
    connectionService.getTransferHistory()
  );
  const [historyNotice, setHistoryNotice] = useState<string | null>(null);

  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDevice[]>([]);
  const [isScanningDevices, setIsScanningDevices] = useState(false);
  const [selectedDeviceToPair, setSelectedDeviceToPair] = useState<DiscoveredDevice | null>(null);
  const [isPairingInFlight, setIsPairingInFlight] = useState(false);

  const fetchDiscoveredDevices = async () => {
    setIsScanningDevices(true);
    try {
      const list = await connectionService.scanForDevices();
      setDiscoveredDevices(list);
    } catch (e) {
      console.warn('Failed to scan devices:', e);
    } finally {
      setIsScanningDevices(false);
    }
  };

  useEffect(() => {
    if (connectionStatus !== 'connected' && activeTab === 'pairing') {
      fetchDiscoveredDevices();
    }
  }, [connectionStatus, activeTab]);

  const [pairError, setPairError] = useState<string | null>(null);
  const [isPendingVerified, setIsPendingVerified] = useState<boolean>(false);

  useEffect(() => {
    if (selectedDeviceToPair) {
      setPairError(null);
      connectionService.fetchPendingPair().then((p) => {
        if (p && (p.deviceId === selectedDeviceToPair.id || (selectedDeviceToPair.ipAddress && p.ip?.includes(selectedDeviceToPair.ipAddress)))) {
          setIsPendingVerified(true);
        } else {
          setIsPendingVerified(false);
        }
      });
    } else {
      setPairError(null);
      setIsPendingVerified(false);
    }
  }, [selectedDeviceToPair]);

  useEffect(() => {
    const unsubPending = connectionService.onPendingPair((pairReq) => {
      if (selectedDeviceToPair) {
        if (pairReq.deviceId === selectedDeviceToPair.id || (selectedDeviceToPair.ipAddress && pairReq.ip?.includes(selectedDeviceToPair.ipAddress))) {
          setIsPendingVerified(true);
          setPairError(null);
        }
      }
    });
    return () => unsubPending();
  }, [selectedDeviceToPair]);

  const handleConfirmPair = async () => {
    if (!selectedDeviceToPair) return;
    setIsPairingInFlight(true);
    setPairError(null);
    try {
      const result = await connectionService.pairWithDevice(selectedDeviceToPair, pairingPin);
      if (result.success) {
        setSelectedDeviceToPair(null);
        setPairError(null);
        setIsPendingVerified(false);
      } else {
        setPairError(result.message || 'Mobile companion has not entered or verified the 6-digit PIN yet.');
      }
    } catch (e: any) {
      setPairError(e?.message || 'Pairing verification failed. Please check Wi-Fi connection.');
    } finally {
      setIsPairingInFlight(false);
    }
  };

  const [tokenSummary, setTokenSummary] = useState<AiTokenSummary | null>(connectionService.getTokenSummary());
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);

  const refreshTokens = async () => {
    setIsLoadingTokens(true);
    try {
      await connectionService.fetchTokenSummary();
    } finally {
      setIsLoadingTokens(false);
    }
  };

  useEffect(() => {
    const unsubStatus = connectionService.subscribeStatus((status, dev) => {
      setConnectionStatus(status);
      setPairedDevice(dev);
      setPairingPin(connectionService.getSasPin());
    });

    const unsubBridge = connectionService.subscribeBridge((online, count) => {
      setIsBridgeOnline(online);
      setActiveClients(count);
    });

    const unsubTransfer = connectionService.onTransfer((transfer) => {
      setActiveTransfer(transfer);
    });

    const unsubHistory = connectionService.subscribeTransferHistory((history) => {
      setTransferHistory(history);
    });

    const unsubTokens = connectionService.subscribeTokenStats((stats) => {
      setTokenSummary(stats);
    });

    const unsubAgent = connectionService.subscribeAgentActivity((status) => {
      setAgentActivity(status);
    });

    return () => {
      unsubStatus();
      unsubBridge();
      unsubTransfer();
      unsubHistory();
      unsubTokens();
      unsubAgent();
    };
  }, []);

  useEffect(() => {
    if (window.electronAPI?.getAutoStart) {
      window.electronAPI.getAutoStart().then((enabled) => {
        setAutoStartEnabled(enabled);
      }).catch(() => {});
    }
  }, []);

  const handleToggleAutoStart = async () => {
    if (!window.electronAPI?.setAutoStart) return;
    setIsSavingAutoStart(true);
    try {
      const nextVal = !autoStartEnabled;
      const result = await window.electronAPI.setAutoStart(nextVal);
      setAutoStartEnabled(result);
    } catch {
      // Keep previous state on failure
    } finally {
      setIsSavingAutoStart(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      connectionService.sendRealFile(file);
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      connectionService.sendRealFile(file);
    }
  };

  // Whitelist state
  const [commands, setCommands] = useState([
    {
      id: 'agy-status',
      title: 'Antigravity Status Check',
      program: 'agy',
      args: 'status',
      requiresBiometrics: false,
    },
    {
      id: 'agy-run',
      title: 'Antigravity Autonomous Run',
      program: 'agy',
      args: 'run',
      requiresBiometrics: true,
    },
    {
      id: 'git-pull',
      title: 'Git Pull Latest',
      program: 'git',
      args: 'pull origin main',
      requiresBiometrics: false,
    },
  ]);

  const [downloadDir, setDownloadDir] = useState('~/Downloads/SokoFiles');

  return (
    <div className="flex h-screen w-screen bg-[#08090A] text-linear-text-primary font-sans select-none overflow-hidden antialiased">
      {/* Linear.app Sidebar Navigation */}
      <aside className="w-60 bg-[#0C0D0E] border-r border-white/5 flex flex-col justify-between p-3.5">
        <div>
          {/* Header & Logo */}
          <div className="flex items-center justify-between mb-5 px-2 pt-1">
            <div className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded-md bg-[#5E6AD2] flex items-center justify-center font-bold text-white text-[11px] shadow-sm">
                S
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-linear-text-primary tracking-tight">SOKO</span>
                <span className="text-[10px] font-mono text-linear-text-tertiary">v0.1.0</span>
              </div>
            </div>
          </div>

          {/* Nav Categories */}
          <div className="px-2 mb-1.5 text-[10px] font-medium tracking-wider text-linear-text-tertiary uppercase">
            Workspace
          </div>

          <nav className="flex flex-col gap-0.5">
            <button
              onClick={() => setActiveTab('general')}
              className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium tracking-tight transition-colors ${
                activeTab === 'general'
                  ? 'bg-white/[0.08] text-white shadow-hairline'
                  : 'text-linear-text-secondary hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Sliders size={14} className={activeTab === 'general' ? 'text-[#5E6AD2]' : 'text-linear-text-tertiary'} />
                <span>General & Startup</span>
              </div>
              <span className="linear-kbd">1</span>
            </button>

            <button
              onClick={() => setActiveTab('pairing')}
              className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium tracking-tight transition-colors ${
                activeTab === 'pairing'
                  ? 'bg-white/[0.08] text-white shadow-hairline'
                  : 'text-linear-text-secondary hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Smartphone size={14} className={activeTab === 'pairing' ? 'text-[#5E6AD2]' : 'text-linear-text-tertiary'} />
                <span>Device Pairing</span>
              </div>
              <span className="linear-kbd">2</span>
            </button>

            <button
              onClick={() => setActiveTab('tokens')}
              className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium tracking-tight transition-colors ${
                activeTab === 'tokens'
                  ? 'bg-white/[0.08] text-white shadow-hairline'
                  : 'text-linear-text-secondary hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Zap size={14} className={activeTab === 'tokens' ? 'text-amber-400' : 'text-linear-text-tertiary'} />
                <span>AI Token Tracker</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 font-semibold px-1 rounded bg-emerald-500/10 border border-emerald-500/20">Native</span>
            </button>

            <button
              onClick={() => setActiveTab('cli')}
              className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium tracking-tight transition-colors ${
                activeTab === 'cli'
                  ? 'bg-white/[0.08] text-white shadow-hairline'
                  : 'text-linear-text-secondary hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Terminal size={14} className={activeTab === 'cli' ? 'text-[#5E6AD2]' : 'text-linear-text-tertiary'} />
                <span>CLI Whitelist</span>
              </div>
              <span className="linear-kbd">3</span>
            </button>

            <button
              onClick={() => setActiveTab('files')}
              className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium tracking-tight transition-colors ${
                activeTab === 'files'
                  ? 'bg-white/[0.08] text-white shadow-hairline'
                  : 'text-linear-text-secondary hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center gap-2">
                <FolderDown size={14} className={activeTab === 'files' ? 'text-[#5E6AD2]' : 'text-linear-text-tertiary'} />
                <span>File Storage</span>
              </div>
              <span className="linear-kbd">4</span>
            </button>

            <button
              onClick={() => setActiveTab('security')}
              className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium tracking-tight transition-colors ${
                activeTab === 'security'
                  ? 'bg-white/[0.08] text-white shadow-hairline'
                  : 'text-linear-text-secondary hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center gap-2">
                <ShieldCheck size={14} className={activeTab === 'security' ? 'text-[#5E6AD2]' : 'text-linear-text-tertiary'} />
                <span>Security & Tunnel</span>
              </div>
              <span className="linear-kbd">5</span>
            </button>

            <button
              onClick={() => setActiveTab('mascot')}
              className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium tracking-tight transition-colors ${
                activeTab === 'mascot'
                  ? 'bg-white/[0.08] text-white shadow-hairline'
                  : 'text-linear-text-secondary hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Sparkles size={14} className={activeTab === 'mascot' ? 'text-[#5E6AD2]' : 'text-linear-text-tertiary'} />
                <span>Mascot & Island</span>
              </div>
              <span className="linear-kbd">6</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('updates');
                if (!updateInfo) {
                  setIsCheckingUpdate(true);
                  autoUpdateService.checkForUpdates().then((res) => {
                    setUpdateInfo(res);
                    setIsCheckingUpdate(false);
                  });
                }
              }}
              className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium tracking-tight transition-colors ${
                activeTab === 'updates'
                  ? 'bg-white/[0.08] text-white shadow-hairline'
                  : 'text-linear-text-secondary hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center gap-2">
                <RefreshCw size={14} className={activeTab === 'updates' ? 'text-[#5E6AD2]' : 'text-linear-text-tertiary'} />
                <span>Auto-Updates & Feed</span>
              </div>
              <span className="linear-kbd">7</span>
            </button>
          </nav>
        </div>

        {/* Footer Link / Hardware Status */}
        <div className="bg-[#121417] border border-white/5 rounded-lg p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-linear-green animate-pulse" />
            <div className="flex flex-col text-[10px]">
              <span className="font-medium text-linear-text-primary tracking-tight">BLE Connected</span>
              <span className="text-linear-text-tertiary font-mono">192.168.43.1 Ready</span>
            </div>
          </div>
          <Sliders size={12} className="text-linear-text-tertiary" />
        </div>
      </aside>

      {/* Main Content View */}
      <main className="flex-1 overflow-y-auto p-9 relative bg-[#08090A]">
        {/* Globally Available Hidden File Input (Mounts for all tabs including Pairing Quick Actions) */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
        />
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-1.5 rounded-md hover:bg-white/5 text-linear-text-secondary hover:text-white transition-colors"
            title="Close Settings"
          >
            <X size={16} />
          </button>
        )}

        {/* General & Startup Tab */}
        {activeTab === 'general' && (
          <div className="max-w-xl flex flex-col gap-6">
            <div>
              <h2 className="text-base font-semibold text-linear-text-primary tracking-tight">System & Startup</h2>
              <p className="text-xs text-linear-text-secondary mt-1">
                Configure how Soko starts, its desktop integration, and system lifecycle behavior.
              </p>
            </div>

            {/* Launch on Startup Card */}
            <div className="linear-card rounded-lg p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-md bg-[#5E6AD2]/10 text-[#5E6AD2] mt-0.5">
                    <Power size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-linear-text-primary tracking-tight">Launch on System Startup</h3>
                    <p className="text-xs text-linear-text-secondary mt-1 max-w-sm">
                      Automatically start Soko Dynamic Island in the background when your PC powers on and you log in.
                    </p>
                  </div>
                </div>

                {/* Modern Toggle Switch */}
                <button
                  type="button"
                  onClick={handleToggleAutoStart}
                  disabled={isSavingAutoStart}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    autoStartEnabled ? 'bg-[#5E6AD2]' : 'bg-white/10'
                  }`}
                  role="switch"
                  aria-checked={autoStartEnabled}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      autoStartEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                <span className="text-linear-text-tertiary">Startup Status:</span>
                <span className="flex items-center gap-1.5 font-medium">
                  <span className={`w-1.5 h-1.5 rounded-full ${autoStartEnabled ? 'bg-linear-green animate-pulse' : 'bg-linear-text-tertiary'}`} />
                  <span className={autoStartEnabled ? 'text-linear-green' : 'text-linear-text-tertiary'}>
                    {autoStartEnabled ? 'Enabled (Starts with PC)' : 'Disabled (Manual Start Only)'}
                  </span>
                </span>
              </div>
            </div>

            {/* Display & Position Controls */}
            <div className="linear-card rounded-lg p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-linear-text-primary tracking-tight">Dynamic Island HUD Positioning</h3>
                  <p className="text-xs text-linear-text-secondary mt-1 max-w-sm">
                    Re-center the floating Dynamic Island capsule to the top-center of your display.
                  </p>
                </div>
                <button
                  onClick={() => window.electronAPI?.resetPosition()}
                  className="px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-white text-xs font-medium border border-white/10 transition-colors"
                >
                  Reset Position
                </button>
              </div>
            </div>

            {/* Architecture Card */}
            <div className="linear-card rounded-lg p-4 flex flex-col gap-2.5 text-xs">
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-linear-text-secondary">Autostart Mechanism</span>
                <span className="font-mono text-linear-text-primary">XDG Desktop Autostart & Electron LoginItem</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-linear-text-secondary">Execution Target</span>
                <span className="font-mono text-linear-text-primary">/opt/Soko/soko --ozone-platform=x11</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-linear-text-secondary">Bridge Daemon</span>
                <span className="font-mono text-linear-green">Auto-managed on :8766</span>
              </div>
            </div>
          </div>
        )}

        {/* Device Pairing Tab */}
        {activeTab === 'pairing' && (
          <div className="max-w-xl flex flex-col gap-6">
            <div>
              <h2 className="text-base font-semibold text-linear-text-primary tracking-tight">Device Pairing & Link Status</h2>
              <p className="text-xs text-linear-text-secondary mt-1">
                Pair your mobile phone using Bluetooth Low Energy and local network discovery. Verify connection authenticity via the 6-digit confirmation code.
              </p>
            </div>

            {/* Confirmation Code Card */}
            <div className="linear-card rounded-lg p-6 flex flex-col items-center justify-center gap-3">
              <span className="text-[10px] font-medium text-linear-text-tertiary uppercase tracking-wider font-mono">
                Short Authentication String (SAS PIN)
              </span>
              <div className="flex items-center gap-3">
                <div className="text-2xl font-mono font-medium tracking-widest text-linear-text-primary bg-[#08090A] px-6 py-2.5 rounded-md border border-white/10 shadow-inner">
                  {pairingPin}
                </div>
                <button
                  onClick={() => setPairingPin(connectionService.regeneratePin())}
                  title="Regenerate Pairing PIN"
                  className="p-2.5 rounded-md bg-white/5 hover:bg-white/10 text-linear-text-secondary hover:text-white border border-white/10 transition-colors"
                >
                  <RefreshCw size={14} />
                </button>
              </div>
              <p className="text-[11px] text-linear-text-secondary text-center max-w-sm">
                Confirm that this 6-digit number matches the PIN displayed in the Soko mobile companion app.
              </p>
            </div>

            {/* Paired Device or Discovered Devices Card */}
            <div className="linear-card rounded-lg p-4 flex flex-col gap-3">
              {connectionStatus === 'connected' && pairedDevice ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-[#5E6AD2]/15 border border-[#5E6AD2]/30 flex items-center justify-center text-[#5E6AD2]">
                      <Smartphone size={16} />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-linear-text-primary tracking-tight">
                        {pairedDevice.name}
                      </h3>
                      <div className="flex items-center gap-2 text-[11px] text-linear-text-secondary mt-0.5 font-mono">
                        <span className="text-linear-green flex items-center gap-1 font-medium">
                          <CheckCircle2 size={11} /> Paired & Authenticated
                        </span>
                        <span className="text-linear-text-tertiary">•</span>
                        <span className="text-linear-text-tertiary">RSSI: {pairedDevice.rssi} dBm</span>
                        <span className="text-linear-text-tertiary">•</span>
                        <span className="text-linear-text-tertiary">Ping: {pairedDevice.pingMs}ms</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => connectionService.disconnectDevice()}
                    className="px-2.5 py-1 rounded-md bg-linear-red/10 hover:bg-linear-red/20 text-linear-red text-xs font-medium border border-linear-red/20 transition-colors"
                  >
                    Unpair
                  </button>
                </div>
              ) : selectedDeviceToPair ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
                    <button
                      onClick={() => {
                        setSelectedDeviceToPair(null);
                        setPairError(null);
                      }}
                      className="flex items-center gap-1.5 text-xs text-linear-text-secondary hover:text-white transition-colors"
                    >
                      <ArrowLeft size={13} />
                      <span>Back to available devices</span>
                    </button>
                    <span className="text-[10px] font-mono font-medium text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/30">
                      SAS Pair Verification
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[#5E6AD2]/20 border border-[#5E6AD2]/40 flex items-center justify-center text-[#5E6AD2]">
                        {selectedDeviceToPair.transport === 'ble' ? (
                          selectedDeviceToPair.name.toLowerCase().includes('bud') ||
                          selectedDeviceToPair.name.toLowerCase().includes('ear') ? (
                            <Headphones size={18} />
                          ) : (
                            <Bluetooth size={18} />
                          )
                        ) : (
                          <Smartphone size={18} />
                        )}
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-white tracking-tight">
                          {selectedDeviceToPair.name}
                        </h4>
                        <span className="text-[11px] text-linear-text-secondary font-mono">
                          {selectedDeviceToPair.model}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedDeviceToPair(null);
                          setPairError(null);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-linear-text-secondary hover:text-white text-xs font-medium border border-white/10 transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleConfirmPair}
                        disabled={isPairingInFlight}
                        className={`px-4 py-1.5 rounded-lg text-black text-xs font-semibold active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-60 ${
                          isPendingVerified
                            ? 'bg-emerald-400 hover:bg-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.5)]'
                            : 'bg-emerald-500 hover:bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.35)]'
                        }`}
                      >
                        {isPairingInFlight ? (
                          <RefreshCw size={13} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={14} />
                        )}
                        <span>{isPendingVerified ? 'Approve & Link' : 'Confirm Link'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Verification Status & Error Banner */}
                  {pairError ? (
                    <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                      <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-400" />
                      <div className="min-w-0">
                        <span className="font-semibold block text-rose-200">Verification Required</span>
                        <span className="text-white/80 leading-normal block">{pairError}</span>
                      </div>
                    </div>
                  ) : isPendingVerified ? (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs">
                      <CheckCircle2 size={14} className="shrink-0 text-emerald-400" />
                      <span>✓ 6-Digit PIN verified on phone! Click Approve & Link to complete pairing.</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-linear-text-secondary text-xs">
                      <RefreshCw size={12} className="animate-spin text-[#5E6AD2]" />
                      <span>Waiting for mobile companion to enter PIN {pairingPin}...</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-semibold text-white tracking-tight">Available Devices</h4>
                      <span className="text-[10px] font-mono text-linear-text-tertiary">
                        ({discoveredDevices.length} found)
                      </span>
                    </div>
                    <button
                      onClick={fetchDiscoveredDevices}
                      disabled={isScanningDevices}
                      className="flex items-center gap-1.5 text-xs text-[#5E6AD2] hover:text-[#7C88E8] font-mono transition-colors disabled:opacity-50"
                    >
                      <RefreshCw size={12} className={isScanningDevices ? 'animate-spin' : ''} />
                      <span>{isScanningDevices ? 'Scanning...' : 'Scan for Devices'}</span>
                    </button>
                  </div>

                  {isScanningDevices && discoveredDevices.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 gap-2 text-center">
                      <RefreshCw size={20} className="text-[#5E6AD2] animate-spin" />
                      <span className="text-xs font-medium text-white">Scanning for nearby devices...</span>
                      <span className="text-[11px] text-linear-text-tertiary">
                        Checking Bluetooth peripherals & local Wi-Fi companions
                      </span>
                    </div>
                  ) : discoveredDevices.length > 0 ? (
                    <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                      {discoveredDevices.map((dev) => (
                        <div
                          key={dev.id}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-black/30 hover:bg-white/[0.04] border border-white/[0.06] hover:border-white/10 transition-all"
                        >
                          <div className="flex items-center gap-3 min-w-0 mr-3">
                            <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[#5E6AD2] shrink-0">
                              {dev.transport === 'ble' ? (
                                dev.name.toLowerCase().includes('bud') || dev.name.toLowerCase().includes('ear') ? (
                                  <Headphones size={15} />
                                ) : (
                                  <Bluetooth size={15} />
                                )
                              ) : (
                                <Wifi size={15} className="text-emerald-400" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <h5 className="text-xs font-semibold text-white truncate">{dev.name}</h5>
                              <div className="flex items-center gap-2 text-[10.5px] text-linear-text-tertiary font-mono">
                                <span>{dev.transport === 'ble' ? 'Bluetooth Low Energy' : 'Wi-Fi / Hotspot LAN'}</span>
                                <span>•</span>
                                <span>{dev.rssi} dBm</span>
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => setSelectedDeviceToPair(dev)}
                            className="linear-button-primary px-3 py-1 text-xs shrink-0"
                          >
                            Pair Device
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 gap-2 text-center">
                      <div className="w-9 h-9 rounded-full bg-linear-red/15 border border-linear-red/30 flex items-center justify-center text-linear-red">
                        <Power size={16} />
                      </div>
                      <div>
                        <h5 className="text-xs font-semibold text-white">No Devices Detected</h5>
                        <p className="text-[11px] text-linear-text-secondary mt-0.5">
                          Turn on Bluetooth or ensure your phone is connected to the same Wi-Fi network.
                        </p>
                      </div>
                      <button
                        onClick={fetchDiscoveredDevices}
                        className="linear-button-primary px-3 py-1 text-xs mt-1"
                      >
                        Scan Again
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Universal Bridge & Mobile Companion Link */}
            <div className="linear-card rounded-lg p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isBridgeOnline ? 'bg-linear-green animate-pulse' : 'bg-linear-red'}`} />
                  <Globe size={14} className="text-[#5E6AD2]" />
                  <h3 className="text-xs font-semibold text-white tracking-tight">
                    Universal Connection Bridge (Node.js)
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-linear-text-secondary bg-white/[0.04] px-2 py-0.5 rounded border border-white/5">
                  Port 8766 • {activeClients} Client{activeClients !== 1 ? 's' : ''} Active
                </span>
              </div>

              <p className="text-[11px] text-linear-text-secondary">
                To test from your Android phone on local Wi-Fi, open this URL in your mobile browser or enter it into the Soko Mobile Companion APK:
              </p>

              <div className="flex items-center justify-between bg-black/50 px-3 py-2 rounded-md border border-white/10 font-mono text-xs">
                <span className="text-white select-all">http://{connectionService.getLocalIps()[0] || '192.168.31.210'}:8766</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(`http://${connectionService.getLocalIps()[0] || '192.168.31.210'}:8766`);
                      setCopiedMobileUrl(true);
                      setTimeout(() => setCopiedMobileUrl(false), 2000);
                    }}
                    className="p-1 rounded hover:bg-white/10 text-linear-text-tertiary hover:text-white transition-colors"
                    title="Copy URL"
                  >
                    {copiedMobileUrl ? <Check size={13} className="text-linear-green" /> : <Copy size={13} />}
                  </button>
                  <button
                    onClick={() => window.open(`http://${connectionService.getLocalIps()[0] || '192.168.31.210'}:8766`, '_blank')}
                    className="flex items-center gap-1 text-[11px] text-linear-brand hover:underline font-mono"
                  >
                    Open App <ExternalLink size={10} />
                  </button>
                </div>
              </div>

              {/* Quick Workstation Controls */}
              <div className="pt-2 border-t border-white/5 flex flex-col gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-linear-text-tertiary">
                  Quick Workstation Actions
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => connectionService.executeCliCommand('sysinfo')}
                    className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded bg-white/5 hover:bg-white/10 text-[11px] text-white border border-white/5 transition-colors"
                    title="Run system telemetry diagnostics"
                  >
                    <Terminal size={12} className="text-linear-brand" /> System Specs
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded bg-white/5 hover:bg-white/10 text-[11px] text-white border border-white/5 transition-colors"
                    title="Select and send any file to mobile device"
                  >
                    <FolderDown size={12} className="text-linear-green" /> Send File
                  </button>
                  <button
                    onClick={() => connectionService.sendTestTransfer('soko-v1.0.0-release.apk')}
                    title="Transmit companion APK package to mobile device"
                    className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded bg-white/5 hover:bg-white/10 text-[11px] text-white border border-white/5 transition-colors"
                  >
                    <Smartphone size={12} className="text-linear-brand" /> Send APK
                  </button>
                </div>

                {/* Active Transfer Progress Banner */}
                {activeTransfer && (
                  <div className="mt-1 bg-white/[0.04] border border-white/10 rounded-lg p-2.5 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 truncate max-w-[260px]">
                        <FolderDown size={13} className="text-linear-green shrink-0" />
                        <span className="font-mono text-white truncate">{activeTransfer.filename}</span>
                      </div>
                      <span className="font-mono text-[11px] text-linear-text-secondary">
                        {activeTransfer.status === 'active'
                          ? `${Math.round((activeTransfer.bytesDownloaded / Math.max(activeTransfer.totalBytes, 1)) * 100)}%`
                          : activeTransfer.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-150 ${
                          activeTransfer.status === 'completed'
                            ? 'bg-linear-green'
                            : activeTransfer.status === 'failed' || activeTransfer.status === 'cancelled'
                            ? 'bg-linear-red'
                            : 'bg-linear-brand'
                        }`}
                        style={{
                          width: `${Math.min(100, Math.round((activeTransfer.bytesDownloaded / Math.max(activeTransfer.totalBytes, 1)) * 100))}%`
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-linear-text-tertiary font-mono">
                      <span>{(activeTransfer.bytesDownloaded / 1_048_576).toFixed(1)} / {(activeTransfer.totalBytes / 1_048_576).toFixed(1)} MB</span>
                      {activeTransfer.status === 'active' && (
                        <button
                          onClick={() => connectionService.cancelTransfer(activeTransfer.id, activeTransfer.filename)}
                          className="text-linear-red hover:underline"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* AI Token Tracker Tab (100% Native) */}
        {activeTab === 'tokens' && (
          <div className="max-w-2xl flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-linear-text-primary tracking-tight">AI Token Tracker</h2>
                  <span className="text-[10px] font-mono font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full">
                    100% Native
                  </span>
                </div>
                <p className="text-xs text-linear-text-secondary mt-1">
                  Real-time offline telemetry monitoring Google Antigravity, OpenAI Codex CLI, and Claude sessions with zero external dependencies.
                </p>
              </div>

              <button
                onClick={refreshTokens}
                disabled={isLoadingTokens}
                className="linear-button-primary px-3 py-1.5 flex items-center gap-1.5 text-xs disabled:opacity-60"
              >
                <RefreshCw size={12} className={isLoadingTokens ? 'animate-spin' : ''} />
                <span>{isLoadingTokens ? 'Scanning...' : 'Refresh Telemetry'}</span>
              </button>
            </div>

            {/* 4-Stat Metric Grid */}
            <div className="grid grid-cols-4 gap-3">
              <div className="linear-card rounded-lg p-3.5 flex flex-col gap-1 border border-amber-500/20 bg-amber-500/[0.03]">
                <div className="flex items-center justify-between text-amber-400">
                  <span className="text-[10px] uppercase font-mono tracking-wider font-semibold">Today's Tokens</span>
                  <Zap size={14} />
                </div>
                <span className="text-xl font-bold font-mono tracking-tight text-white mt-1">
                  {tokenSummary ? (
                    tokenSummary.todayTokens >= 1000000000
                      ? `${(tokenSummary.todayTokens / 1000000000).toFixed(2)}B`
                      : tokenSummary.todayTokens >= 1000000
                      ? `${(tokenSummary.todayTokens / 1000000).toFixed(2)}M`
                      : tokenSummary.todayTokens.toLocaleString()
                  ) : '...'}
                </span>
                <span className="text-[10px] text-linear-text-tertiary">
                  {tokenSummary?.todayFreshTokens !== undefined
                    ? `${(tokenSummary.todayFreshTokens / 1000000).toFixed(1)}M fresh • ${(tokenSummary.todayCachedTokens! / 1000000).toFixed(1)}M cached`
                    : 'Active coding today'}
                </span>
              </div>

              <div className="linear-card rounded-lg p-3.5 flex flex-col gap-1 border border-indigo-500/20 bg-indigo-500/[0.03]">
                <div className="flex items-center justify-between text-[#7C88E8]">
                  <span className="text-[10px] uppercase font-mono tracking-wider font-semibold">All-Time Total</span>
                  <Cpu size={14} />
                </div>
                <span className="text-xl font-bold font-mono tracking-tight text-white mt-1">
                  {tokenSummary ? (
                    tokenSummary.totalTokens >= 1000000000
                      ? `${(tokenSummary.totalTokens / 1000000000).toFixed(2)}B`
                      : `${(tokenSummary.totalTokens / 1000000).toFixed(1)}M`
                  ) : '...'}
                </span>
                <span className="text-[10px] text-linear-text-tertiary">
                  {tokenSummary?.freshTokens !== undefined
                    ? `${(tokenSummary.freshTokens / 1000000).toFixed(1)}M net interactive`
                    : 'Total lifetime context'}
                </span>
              </div>

              <div className="linear-card rounded-lg p-3.5 flex flex-col gap-1 border border-emerald-500/20 bg-emerald-500/[0.03]">
                <div className="flex items-center justify-between text-emerald-400">
                  <span className="text-[10px] uppercase font-mono tracking-wider font-semibold">Context Cached</span>
                  <Database size={14} />
                </div>
                <span className="text-xl font-bold font-mono tracking-tight text-white mt-1">
                  {tokenSummary ? (
                    (() => {
                      const totalCached = tokenSummary.cachedTokens !== undefined
                        ? tokenSummary.cachedTokens
                        : tokenSummary.assistants.reduce((acc, a) => acc + (a.cachedTokens || 0), 0);
                      return totalCached >= 1000000000
                        ? `${(totalCached / 1000000000).toFixed(2)}B`
                        : `${(totalCached / 1000000).toFixed(1)}M`;
                    })()
                  ) : '...'}
                </span>
                <span className="text-[10px] text-emerald-400/90 font-mono flex items-center gap-1">
                  {tokenSummary?.cacheHitRate !== undefined ? `${tokenSummary.cacheHitRate}% cache hit efficiency` : 'Context cache reads'}
                </span>
              </div>

              <div className="linear-card rounded-lg p-3.5 flex flex-col gap-1 border border-purple-500/20 bg-purple-500/[0.03]">
                <div className="flex items-center justify-between text-purple-400">
                  <span className="text-[10px] uppercase font-mono tracking-wider font-semibold">Total Sessions</span>
                  <Layers size={14} />
                </div>
                <span className="text-xl font-bold font-mono tracking-tight text-white mt-1">
                  {tokenSummary ? (tokenSummary.totalSessions || tokenSummary.assistants.reduce((acc, a) => acc + (a.sessionsCount || 0), 0)) : '...'}
                </span>
                <span className="text-[10px] text-linear-text-tertiary">Across all assistants</span>
              </div>
            </div>

            {/* CLI Agent Task Watcher & Eye Animations */}
            <div className="linear-card rounded-xl p-4 flex flex-col gap-3 border border-white/[0.08] bg-white/[0.02]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#5E6AD2]/20 border border-[#5E6AD2]/35 flex items-center justify-center text-[#7C88E8]">
                    <Zap size={14} />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-white tracking-tight flex items-center gap-2">
                      CLI Agent Task Watcher & Eye Colors
                      {agentActivity?.agent ? (
                        <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Active: {agentActivity.name}
                        </span>
                      ) : (
                        <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-white/[0.06] text-linear-text-tertiary">
                          Standby (Idle)
                        </span>
                      )}
                    </h3>
                    <p className="text-[11px] text-linear-text-secondary mt-0.5">
                      Monitors active CLI agent turns and dynamically morphs Soko bot eyes with distinctive colors and animations.
                    </p>
                  </div>
                </div>
              </div>

              {agentActivity?.agent && agentActivity.status !== 'idle' && (
                <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.08] flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full animate-ping"
                      style={{
                        backgroundColor:
                          agentActivity.agent === 'antigravity'
                            ? '#38BDF8'
                            : agentActivity.agent === 'codex'
                            ? '#10A37F'
                            : '#F59E0B',
                      }}
                    />
                    <span className="text-white font-semibold">{agentActivity.name}:</span>
                    <span className="text-linear-text-secondary">{agentActivity.detail || 'Working...'}</span>
                  </div>
                  <span className="text-[10px] text-linear-text-tertiary">Live Detection</span>
                </div>
              )}

              {/* Interactive Test & Preview Controls */}
              <div className="pt-2 border-t border-white/[0.06] flex flex-col gap-2">
                <span className="text-[10px] uppercase font-mono tracking-wider text-linear-text-tertiary font-semibold">
                  Test & Preview Eye Animations
                </span>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => connectionService.simulateAgentActivity('antigravity', 'Analyzing AST & running tools', 7000)}
                    className="px-2.5 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/25 text-[11px] font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-sm"
                  >
                    <span className="w-2 h-2 rounded-full bg-sky-400" />
                    <span>Antigravity Eyes</span>
                  </button>

                  <button
                    onClick={() => connectionService.simulateAgentActivity('codex', 'Streaming code generation', 7000)}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 text-[11px] font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-sm"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>Codex Eyes</span>
                  </button>

                  <button
                    onClick={() => connectionService.simulateAgentActivity('claude', 'Reasoning & contemplation', 7000)}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/25 text-[11px] font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-sm"
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span>Claude Eyes</span>
                  </button>

                  <button
                    onClick={() => connectionService.simulateAgentActivity(null, '', 0)}
                    className="px-2.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-linear-text-secondary hover:text-white border border-white/[0.08] text-[11px] font-medium flex items-center justify-center gap-1 active:scale-95 transition-all"
                  >
                    <RotateCcw size={11} />
                    <span>Reset Eyes</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Assistant Platform Cards */}
            <div className="flex flex-col gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider font-mono text-linear-text-tertiary">
                Assistant Telemetry Breakdown
              </span>

              <div className="grid grid-cols-2 gap-3">
                {tokenSummary?.assistants.map((assistant) => (
                  <div
                    key={assistant.id}
                    className="linear-card rounded-xl p-4 flex flex-col gap-3 border border-white/[0.08] hover:border-white/[0.15] transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: assistant.color, boxShadow: `0 0 10px ${assistant.color}66` }}
                        />
                        <h4 className="text-xs font-bold text-white tracking-tight">{assistant.name}</h4>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {assistant.cacheHitRate !== undefined && assistant.cacheHitRate > 0 && (
                          <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            {assistant.cacheHitRate}% cached
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-linear-text-secondary bg-white/[0.05] px-2 py-0.5 rounded border border-white/5">
                          {assistant.sessionsCount} session{assistant.sessionsCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-baseline justify-between pt-1 border-t border-white/[0.06]">
                      <span className="text-xs text-linear-text-tertiary font-mono">Total Tokens:</span>
                      <span className="text-sm font-bold font-mono text-white">
                        {assistant.totalTokens >= 1000000000
                          ? `${(assistant.totalTokens / 1000000000).toFixed(2)}B`
                          : assistant.totalTokens >= 1000000
                          ? `${(assistant.totalTokens / 1000000).toFixed(2)}M`
                          : assistant.totalTokens.toLocaleString()}
                      </span>
                    </div>

                    {/* Progress Bar of Today / Total */}
                    <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, Math.max(4, tokenSummary.totalTokens > 0 ? (assistant.totalTokens / tokenSummary.totalTokens) * 100 : 0))}%`,
                          backgroundColor: assistant.color,
                        }}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1 text-[10px] font-mono text-linear-text-secondary">
                      <div className="bg-black/40 p-2 rounded border border-white/[0.04]">
                        <span className="text-linear-text-tertiary block text-[9px]">INPUTS</span>
                        <span className="text-white font-medium">
                          {assistant.inputTokens >= 1000000000 ? `${(assistant.inputTokens / 1000000000).toFixed(2)}B` : assistant.inputTokens >= 1000000 ? `${(assistant.inputTokens / 1000000).toFixed(1)}M` : assistant.inputTokens.toLocaleString()}
                        </span>
                      </div>
                      <div className="bg-black/40 p-2 rounded border border-white/[0.04]">
                        <span className="text-linear-text-tertiary block text-[9px]">OUTPUTS</span>
                        <span className="text-white font-medium">
                          {assistant.outputTokens >= 1000000000 ? `${(assistant.outputTokens / 1000000000).toFixed(2)}B` : assistant.outputTokens >= 1000000 ? `${(assistant.outputTokens / 1000000).toFixed(1)}M` : assistant.outputTokens.toLocaleString()}
                        </span>
                      </div>
                      <div className="bg-black/40 p-2 rounded border border-white/[0.04]">
                        <span className="text-linear-text-tertiary block text-[9px]">CACHED</span>
                        <span className="text-white font-medium">
                          {assistant.cachedTokens >= 1000000000 ? `${(assistant.cachedTokens / 1000000000).toFixed(2)}B` : assistant.cachedTokens >= 1000000 ? `${(assistant.cachedTokens / 1000000).toFixed(1)}M` : assistant.cachedTokens.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Sessions Feed */}
            {tokenSummary && tokenSummary.recentSessions.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <span className="text-xs font-semibold uppercase tracking-wider font-mono text-linear-text-tertiary">
                  Recent AI Assistant Activity
                </span>

                <div className="linear-card rounded-lg overflow-hidden border border-white/[0.08]">
                  <div className="max-h-[240px] overflow-y-auto custom-scrollbar divide-y divide-white/[0.06]">
                    {tokenSummary.recentSessions.map((session) => (
                      <div
                        key={session.id}
                        className="p-3 flex items-center justify-between hover:bg-white/[0.03] transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0 mr-3">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                              session.assistant.toLowerCase().includes('antigravity')
                                ? 'bg-[#4285F4]/15 text-[#4285F4] border border-[#4285F4]/30'
                                : 'bg-[#10A37F]/15 text-[#10A37F] border border-[#10A37F]/30'
                            }`}
                          >
                            {session.assistant[0]}
                          </div>
                          <div className="min-w-0">
                            <h5 className="text-xs font-semibold text-white truncate max-w-[360px]">
                              {session.summary}
                            </h5>
                            <div className="flex items-center gap-2 text-[10px] text-linear-text-tertiary font-mono mt-0.5">
                              <span>{session.assistant}</span>
                              <span>•</span>
                              <span>{session.model || 'AI Model'}</span>
                              <span>•</span>
                              <span>{new Date(session.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                        </div>

                        <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded shrink-0">
                          {session.tokens >= 1000000000
                            ? `${(session.tokens / 1000000000).toFixed(2)}B`
                            : session.tokens >= 1000000
                            ? `${(session.tokens / 1000000).toFixed(2)}M`
                            : session.tokens.toLocaleString()} tok
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CLI Whitelist Tab */}
        {activeTab === 'cli' && (
          <div className="max-w-2xl flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-linear-text-primary tracking-tight">CLI Agent Whitelist</h2>
                <p className="text-xs text-linear-text-secondary mt-1">
                  Control developer tools (like Antigravity CLI) from mobile. Only explicitly authorized commands can be triggered.
                </p>
              </div>

              <button className="linear-button-primary px-3 py-1.5 flex items-center gap-1.5">
                <Plus size={13} /> Add Command
              </button>
            </div>

            {/* Command List */}
            <div className="flex flex-col gap-2">
              {commands.map((cmd) => (
                <div
                  key={cmd.id}
                  className="linear-card linear-card-hover rounded-lg p-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 rounded-md bg-linear-brand/10 border border-linear-brand/20 flex items-center justify-center text-linear-brand shrink-0">
                      <Terminal size={14} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-medium text-linear-text-primary tracking-tight truncate">{cmd.title}</h3>
                        <span className="text-[10px] font-mono text-linear-text-tertiary bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/5">
                          {cmd.id}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-linear-text-secondary truncate mt-0.5">
                        $ {cmd.program} {cmd.args}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() =>
                        setCommands((prev) =>
                          prev.map((c) =>
                            c.id === cmd.id ? { ...c, requiresBiometrics: !c.requiresBiometrics } : c
                          )
                        )
                      }
                      title="Toggle Biometric Requirement"
                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                        cmd.requiresBiometrics
                          ? 'bg-[#5E6AD2]/10 border-[#5E6AD2]/30 text-[#8B95EC]'
                          : 'bg-white/[0.04] border-white/10 text-linear-text-tertiary hover:text-white'
                      }`}
                    >
                      {cmd.requiresBiometrics ? <Lock size={10} /> : <Unlock size={10} />}
                      {cmd.requiresBiometrics ? 'Biometric Protected' : 'Direct Run'}
                    </button>

                    <button
                      onClick={() => setCommands((prev) => prev.filter((c) => c.id !== cmd.id))}
                      className="p-1 rounded hover:bg-linear-red/10 text-linear-text-tertiary hover:text-linear-red transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* File Storage Tab */}
        {activeTab === 'files' && (
          <div className="max-w-xl flex flex-col gap-6">
            <div>
              <h2 className="text-base font-semibold text-linear-text-primary tracking-tight">Hotspot File Conduit & Transmit</h2>
              <p className="text-xs text-linear-text-secondary mt-1">
                Select or drag APKs and project files to transmit to the Mobile Companion over local Wi-Fi / Hotspot LAN at up to 42 MB/s.
              </p>
            </div>

            {/* Drag & Drop File Selector Box */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(false);
              }}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ${
                isDragging
                  ? 'border-linear-brand bg-[#5E6AD2]/10 scale-[1.01]'
                  : 'border-white/10 hover:border-white/20 bg-[#121417] hover:bg-[#15181C]'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-linear-brand/10 border border-linear-brand/20 flex items-center justify-center text-linear-brand mb-3">
                <UploadCloud size={24} />
              </div>
              <h3 className="text-sm font-semibold text-white tracking-tight">
                Click to browse or drag & drop files here
              </h3>
              <p className="text-xs text-linear-text-secondary mt-1 max-w-sm">
                Select any <span className="font-mono text-white">.apk</span> or binary payload from your desktop filesystem to transmit to your phone.
              </p>

              <div className="flex items-center gap-3 mt-4" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="linear-button-primary px-4 py-2 flex items-center gap-2 text-xs"
                >
                  <FileUp size={14} /> Choose File from Desktop
                </button>
                <button
                  onClick={() => connectionService.sendTestTransfer('soko-v1.0.0-release.apk')}
                  className="linear-button-secondary px-3 py-2 flex items-center gap-1.5 text-xs"
                  title="Transmit production companion APK to phone"
                >
                  <Smartphone size={13} /> Send Companion APK
                </button>
              </div>
            </div>

            {/* Live / Recent File Transfer Status Card */}
            {activeTransfer && (
              <div className="linear-card rounded-lg p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <FolderDown
                      size={16}
                      className={`shrink-0 ${
                        activeTransfer.status === 'completed'
                          ? 'text-linear-green'
                          : activeTransfer.status === 'cancelled'
                          ? 'text-linear-amber'
                          : activeTransfer.status === 'failed'
                          ? 'text-linear-red'
                          : 'text-linear-brand'
                      }`}
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-white font-mono truncate max-w-xs">
                        {activeTransfer.filename}
                      </span>
                      <span className="text-[10px] text-linear-text-secondary font-mono">
                        {(activeTransfer.bytesDownloaded / 1_048_576).toFixed(1)} MB / {(activeTransfer.totalBytes / 1_048_576).toFixed(1)} MB
                        {activeTransfer.status === 'active' && ` • ${(activeTransfer.speedBytesPerSec / 1_048_576).toFixed(1)} MB/s`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {activeTransfer.status === 'active' && (
                      <button
                        onClick={() => connectionService.cancelTransfer(activeTransfer.id, activeTransfer.filename)}
                        className="px-2.5 py-1 rounded bg-linear-red/10 hover:bg-linear-red/20 text-linear-red border border-linear-red/20 text-xs font-medium transition-colors flex items-center gap-1"
                      >
                        <X size={12} /> Cancel
                      </button>
                    )}
                    {activeTransfer.status === 'completed' && (
                      <span className="flex items-center gap-1 text-xs text-linear-green font-medium font-mono">
                        <CheckCircle2 size={13} /> Completed
                      </span>
                    )}
                    {(activeTransfer.status === 'cancelled' || activeTransfer.status === 'failed') && (
                      <div className="flex items-center gap-2">
                        <span className={`flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded ${
                          activeTransfer.status === 'cancelled'
                            ? 'text-linear-amber bg-linear-amber/10 border border-linear-amber/20'
                            : 'text-linear-red bg-linear-red/10 border border-linear-red/20'
                        }`}>
                          {activeTransfer.status === 'cancelled' ? <Ban size={11} /> : <AlertCircle size={11} />}
                          {activeTransfer.status === 'cancelled' ? 'Cancelled' : 'Failed'}
                        </span>
                        <button
                          onClick={() => connectionService.retryTransfer(activeTransfer.id, activeTransfer.filename)}
                          className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors flex items-center gap-1"
                        >
                          <RotateCcw size={12} /> Retry
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-150 rounded-full ${
                      activeTransfer.status === 'completed'
                        ? 'bg-linear-green'
                        : activeTransfer.status === 'cancelled'
                        ? 'bg-linear-amber'
                        : activeTransfer.status === 'failed'
                        ? 'bg-linear-red'
                        : 'bg-linear-brand'
                    }`}
                    style={{
                      width: activeTransfer.status === 'cancelled' || activeTransfer.status === 'failed'
                        ? '100%'
                        : `${Math.min(100, activeTransfer.percentage)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Transfer History Card */}
            <div className="linear-card rounded-lg p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History size={16} className="text-[#5E6AD2]" />
                  <h3 className="text-xs font-semibold text-white tracking-tight">Transfer History</h3>
                  <span className="text-[10px] font-mono text-linear-text-secondary bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/5">
                    {transferHistory.length} {transferHistory.length === 1 ? 'file' : 'files'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => connectionService.openTransfersFolder()}
                    className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] text-linear-text-secondary hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 transition-colors"
                    title="Open transfers folder in file manager"
                  >
                    <FolderDown size={12} className="text-linear-green" />
                    <span>Show on Disk</span>
                  </button>
                  {transferHistory.length > 0 && (
                    <button
                      onClick={() => {
                        connectionService.clearTransferHistory();
                        setHistoryNotice('Transfer history cleared. All physical files remain safely on disk.');
                        setTimeout(() => setHistoryNotice(null), 4000);
                      }}
                      className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] text-linear-text-tertiary hover:text-linear-red hover:bg-linear-red/10 border border-transparent hover:border-linear-red/20 transition-colors"
                      title="Clear history list (Files on disk will NOT be deleted)"
                    >
                      <Trash2 size={12} />
                      <span>Clear History</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Explanatory Safety Notice Banner */}
              <div className="flex items-center justify-between bg-black/40 px-3 py-2 rounded-md border border-white/5 text-[11px] text-linear-text-tertiary">
                <span>Deleting history only removes the log record. Underlying files on disk are preserved.</span>
                <span className="text-[10px] font-mono text-linear-green bg-linear-green/10 px-1.5 py-0.5 rounded border border-linear-green/20">
                  Zero Data Loss
                </span>
              </div>

              {historyNotice && (
                <div className="flex items-center gap-2 bg-linear-green/10 border border-linear-green/20 px-3 py-2 rounded-md text-xs text-linear-green">
                  <CheckCircle2 size={14} className="shrink-0" />
                  <span>{historyNotice}</span>
                </div>
              )}

              {/* History Items List */}
              {transferHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center text-linear-text-tertiary gap-1">
                  <Clock size={20} className="opacity-40 mb-1" />
                  <span className="text-xs font-medium text-linear-text-secondary">No transfer history yet</span>
                  <span className="text-[11px]">Transfers completed with mobile companion will appear here.</span>
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
                  {transferHistory.map((item) => (
                    <div
                      key={item.id}
                      className="bg-[#08090A] border border-white/5 hover:border-white/10 rounded-md p-2.5 flex items-center justify-between transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 rounded bg-white/[0.04] border border-white/5 flex items-center justify-center text-linear-text-secondary shrink-0">
                          {item.direction === 'sent' ? (
                            <ArrowUpRight size={13} className="text-linear-brand" />
                          ) : (
                            <ArrowDownLeft size={13} className="text-linear-green" />
                          )}
                        </div>
                        <div className="min-w-0 flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-white font-mono truncate max-w-xs" title={item.filename}>
                              {item.filename}
                            </span>
                            <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-white/[0.04] text-linear-text-tertiary border border-white/5">
                              {item.direction === 'sent' ? 'Sent to Phone' : 'Received from Phone'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-linear-text-tertiary font-mono mt-0.5">
                            <span>{(item.totalBytes / 1_048_576).toFixed(2)} MB</span>
                            <span>•</span>
                            <span>{new Date(item.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                            {item.sha256 && (
                              <>
                                <span>•</span>
                                <span title={`SHA-256: ${item.sha256}`}>SHA: {item.sha256.slice(0, 8)}...</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => connectionService.openTransferredFile(item.filename)}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-[#5E6AD2]/15 hover:bg-[#5E6AD2]/25 text-[#5E6AD2] border border-[#5E6AD2]/30 text-[10px] font-medium transition-colors"
                          title="Open file in default desktop app"
                        >
                          <ExternalLink size={10} /> Open
                        </button>
                        <a
                          href={connectionService.getDownloadUrl(item.filename) + '?download=1'}
                          download={item.filename}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 rounded text-linear-text-tertiary hover:text-white hover:bg-white/10 border border-white/5 transition-colors"
                          title="Download file"
                        >
                          <FolderDown size={11} />
                        </a>
                        <button
                          onClick={() => {
                            connectionService.deleteTransferHistoryItem(item.id);
                            setHistoryNotice(`Removed "${item.filename}" from log. Physical file is preserved.`);
                            setTimeout(() => setHistoryNotice(null), 3500);
                          }}
                          className="p-1 rounded text-linear-text-tertiary hover:text-linear-red hover:bg-linear-red/10 transition-colors opacity-70 group-hover:opacity-100"
                          title="Remove from history (file remains on disk)"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Default Download Directory */}
            <div className="linear-card rounded-lg p-4 flex flex-col gap-3">
              <label className="text-xs font-medium text-linear-text-primary tracking-tight">Default Download Directory</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={downloadDir}
                  onChange={(e) => setDownloadDir(e.target.value)}
                  className="flex-1 bg-[#08090A] border border-white/10 rounded-md px-3 py-1.5 text-xs font-mono text-linear-text-primary focus:outline-none focus:border-[#5E6AD2]"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="linear-button-secondary px-3 py-1.5"
                >
                  Browse
                </button>
              </div>
              <p className="text-[11px] text-linear-text-tertiary">
                Incoming files are strictly constrained to this directory with automatic path traversal defenses.
              </p>
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="max-w-xl flex flex-col gap-6">
            <div>
              <h2 className="text-base font-semibold text-linear-text-primary tracking-tight">Security & Encryption</h2>
              <p className="text-xs text-linear-text-secondary mt-1">
                Cryptographic parameters protecting the Bluetooth link and local Hotspot conduit.
              </p>
            </div>

            <div className="linear-card rounded-lg p-4 flex flex-col gap-2.5 text-xs">
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-linear-text-secondary">Cipher Suite</span>
                <span className="font-mono text-linear-text-primary">AES-256-GCM + X25519</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-linear-text-secondary">Replay Protection</span>
                <span className="font-mono text-linear-green">Monotonic Nonces (Strict)</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-linear-text-secondary">Firewall Evasion</span>
                <span className="font-mono text-linear-text-primary">Outbound Client-Pull (Zero PC ports opened)</span>
              </div>
            </div>
          </div>
        )}

        {/* Mascot & Island Tab */}
        {activeTab === 'mascot' && (
          <div className="max-w-xl flex flex-col gap-6">
            <div>
              <h2 className="text-base font-semibold text-linear-text-primary tracking-tight">Mascot & Dynamic Island</h2>
              <p className="text-xs text-linear-text-secondary mt-1">
                Customize Soko's mascot character pack, atmospheric state backgrounds, ambient idle behavior, and interactive HUD morphing.
              </p>
            </div>

            {/* Character Selection & Custom Import System */}
            <div className="linear-card rounded-lg p-5">
              <CharacterSelector />
            </div>

            <div className="linear-card rounded-lg p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <div>
                  <h3 className="text-xs font-semibold text-white">Idle Mascot Orb Mode</h3>
                  <p className="text-[11px] text-linear-text-tertiary mt-0.5">
                    When inactive, removes controls and leaves an enlarged, living Soko mascot orb.
                  </p>
                </div>
                <button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('soko:preview-mascot-mode'));
                    onClose?.();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#5E6AD2]/15 hover:bg-[#5E6AD2]/30 text-[#7C88E8] hover:text-white text-xs font-medium border border-[#5E6AD2]/30 active:scale-95 transition-all shadow-sm"
                  title="Close settings and preview enlarged mascot orb now"
                >
                  Test Mascot Orb Now
                </button>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-linear-text-secondary">
                  Auto-Contract Inactivity Delay
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { label: '30s (Quick)', val: 30000 },
                    { label: '1m (Default)', val: 60000 },
                    { label: '2m', val: 120000 },
                    { label: '5m', val: 300000 },
                    { label: 'Disabled', val: 0 },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => {
                        setMascotIdleTimeout(opt.val);
                        localStorage.setItem('soko_idle_timeout', String(opt.val));
                        window.dispatchEvent(new Event('soko:idle-settings-changed'));
                      }}
                      className={`py-2 px-2 rounded-lg text-center font-mono text-[11px] transition-all border ${
                        mascotIdleTimeout === opt.val
                          ? 'bg-[#5E6AD2] text-white font-semibold border-[#5E6AD2] shadow-[0_0_12px_rgba(94,106,210,0.4)]'
                          : 'bg-white/[0.03] hover:bg-white/[0.08] text-white/70 hover:text-white border-white/[0.08]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reactive Cursor Eye Tracking Toggle */}
              <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-white">Interactive Eye Cursor Tracking</h3>
                  <p className="text-[11px] text-linear-text-tertiary mt-0.5">
                    Soko's eyes and head organically follow your cursor as you move across the Island HUD.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleCursorTracking}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    cursorTrackingEnabled ? 'bg-[#5E6AD2]' : 'bg-white/10'
                  }`}
                  role="switch"
                  aria-checked={cursorTrackingEnabled}
                  title="Toggle reactive cursor eye tracking"
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      cursorTrackingEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3 text-[11px] text-linear-text-tertiary flex flex-col gap-1.5 font-mono">
                <div className="flex items-center gap-1.5 text-white/90 font-sans font-medium">
                  <Sparkles size={12} className="text-emerald-400" />
                  <span>How Ambient Idle Mode Works:</span>
                </div>
                <p>• After the selected idle duration without mouse interactions, the island contracts to a 68×64px circular orb.</p>
                <p>• Status indicators & buttons fade away, leaving only Soko's face enlarged to 56px.</p>
                <p>• Soko's eyes naturally follow your mouse around the island with smooth 3D visor physics and organic blinks.</p>
                <p>• Hovering your mouse, clicking, or receiving any incoming notification immediately wakes Soko up and restores the full pill.</p>
              </div>
            </div>
          </div>
        )}

        {/* Auto-Updates & Gist Feed Tab */}
        {activeTab === 'updates' && (
          <div className="max-w-xl flex flex-col gap-6">
            <div>
              <h2 className="text-base font-semibold text-linear-text-primary tracking-tight">Auto-Updates & Version Feed</h2>
              <p className="text-xs text-linear-text-secondary mt-1">
                Continuous build updates, version synchronization, and zero-rate-limit Gist distribution.
              </p>
            </div>

            {/* Current Version Card */}
            <div className="linear-card rounded-xl p-5 flex flex-col gap-4 border border-white/10 bg-[#121417]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-linear-brand/10 border border-linear-brand/30 flex items-center justify-center text-linear-brand">
                    <RefreshCw size={20} className={isCheckingUpdate ? 'animate-spin' : ''} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white tracking-tight">Soko Desktop</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        v{CURRENT_VERSION}
                      </span>
                    </div>
                    <p className="text-xs text-linear-text-secondary mt-0.5">
                      Release Channel: <span className="text-white font-medium">Stable</span>
                    </p>
                  </div>
                </div>

                <button
                  onClick={async () => {
                    setIsCheckingUpdate(true);
                    try {
                      const res = await autoUpdateService.checkForUpdates();
                      setUpdateInfo(res);
                    } finally {
                      setIsCheckingUpdate(false);
                    }
                  }}
                  disabled={isCheckingUpdate}
                  className="linear-button-primary px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium"
                >
                  <RefreshCw size={12} className={isCheckingUpdate ? 'animate-spin' : ''} />
                  {isCheckingUpdate ? 'Checking...' : 'Check for Updates'}
                </button>
              </div>

              {/* Status Banner */}
              {updateInfo && (
                <div className="mt-2">
                  {updateInfo.hasUpdate ? (
                    <div className="bg-amber-500/10 border border-amber-500/25 rounded-lg p-3.5 flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-amber-400 text-xs font-medium">
                          <AlertCircle size={15} />
                          <span>New Update Available: <b>v{updateInfo.latestVersion}</b></span>
                        </div>
                        {updateInfo.releaseDate && (
                          <span className="text-[10px] text-linear-text-tertiary font-mono">
                            {new Date(updateInfo.releaseDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      {updateInfo.releaseNotes && (
                        <p className="text-xs text-white/80 whitespace-pre-line bg-black/30 p-2.5 rounded border border-white/5 font-mono text-[11px]">
                          {updateInfo.releaseNotes}
                        </p>
                      )}

                      <div className="flex items-center gap-2 mt-1">
                        {updateInfo.recommendedDownloadUrl && (
                          <button
                            onClick={() => autoUpdateService.openUrl(updateInfo.recommendedDownloadUrl!)}
                            className="linear-button-primary px-3 py-1.5 text-xs flex items-center gap-1.5"
                          >
                            <ExternalLink size={12} /> Download Update
                          </button>
                        )}
                        {updateInfo.releaseUrl && (
                          <button
                            onClick={() => autoUpdateService.openUrl(updateInfo.releaseUrl!)}
                            className="linear-button-secondary px-3 py-1.5 text-xs flex items-center gap-1.5"
                          >
                            <ExternalLink size={12} /> Release Notes
                          </button>
                        )}
                        {updateInfo.downloads?.androidApk && (
                          <button
                            onClick={() => autoUpdateService.openUrl(updateInfo.downloads!.androidApk!)}
                            className="px-2.5 py-1.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-linear-text-secondary hover:text-white border border-white/10 text-xs flex items-center gap-1.5"
                          >
                            <Smartphone size={12} /> Download Mobile APK
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 flex items-center gap-2 text-emerald-400 text-xs">
                      <CheckCircle2 size={15} />
                      <span>You are running the latest version of Soko (v{CURRENT_VERSION}).</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Gist Feed Configuration */}
            <div className="linear-card rounded-xl p-5 flex flex-col gap-4 border border-white/10 bg-[#121417]">
              <div>
                <h3 className="text-sm font-semibold text-white tracking-tight">GitHub Gist Auto-Update Feed</h3>
                <p className="text-xs text-linear-text-secondary mt-1">
                  Soko uses a public GitHub Gist (<span className="font-mono text-emerald-400">soko-version.json</span>) for instantaneous, rate-limit-free version updates without hitting GitHub API restrictions.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-linear-text-secondary">
                  Raw Gist Feed URL (Optional custom endpoint)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={feedUrlInput}
                    onChange={(e) => setFeedUrlInput(e.target.value)}
                    placeholder="https://gist.githubusercontent.com/.../raw/soko-version.json"
                    className="linear-input flex-1 text-xs font-mono py-2"
                  />
                  <button
                    onClick={() => {
                      autoUpdateService.setFeedUrl(feedUrlInput);
                      setFeedSaved(true);
                      setTimeout(() => setFeedSaved(false), 2000);
                    }}
                    className="linear-button-primary px-3 py-2 text-xs flex items-center gap-1.5 shrink-0"
                  >
                    {feedSaved ? <Check size={13} /> : <Sliders size={13} />}
                    {feedSaved ? 'Saved' : 'Save Feed'}
                  </button>
                </div>
              </div>

              <div className="bg-black/30 border border-white/5 rounded-lg p-3 text-[11px] text-linear-text-tertiary flex flex-col gap-1.5 font-mono">
                <span className="text-white/80 font-medium font-sans">How Gist Secrets Work:</span>
                <p>1. In GitHub repo Settings &gt; Secrets, add <span className="text-linear-brand">GIST_SECRET</span> (a Personal Access Token with gist scope).</p>
                <p>2. On every build, GitHub Actions automatically updates the Gist with new binary links.</p>
                <p>3. Clients query the raw Gist URL instantly with zero API rate limits or authentication.</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
