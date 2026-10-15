import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Smartphone,
  Wifi,
  Bluetooth,
  RefreshCw,
  Power,
  ShieldCheck,
  Radio,
  ExternalLink,
  Battery,
  X,
  Copy,
  Check,
  Globe,
  Terminal,
  FolderDown,
  Sparkles,
  Headphones,
  ArrowLeft,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import { ConnectionStatus, PairedDevice, DiscoveredDevice, AiTokenSummary } from '../../types/index.ts';
import { connectionService } from '../../services/connection.ts';

interface ConnectionPopoverProps {
  status: ConnectionStatus;
  device: PairedDevice | null;
  sasPin: string;
  onDisconnect: () => void;
  onRegeneratePin: () => void;
  onOpenSettings: (tab?: string) => void;
  onClose: () => void;
}

/**
 * Premium Glassmorphic Connection Hub Popover.
 *
 * Displays live device pairing details, signal metrics (RSSI, ping),
 * SAS cryptographic PIN, transport protocol status, local network pairing IP,
 * and quick workstation actions.
 */
export const ConnectionPopover: React.FC<ConnectionPopoverProps> = ({
  status,
  device,
  sasPin,
  onDisconnect,
  onRegeneratePin,
  onOpenSettings,
  onClose,
}) => {
  const [copiedIp, setCopiedIp] = useState(false);
  const [idleTimeoutVal, setIdleTimeoutVal] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('soko_idle_timeout');
      if (stored !== null) {
        const val = parseInt(stored, 10);
        if (!isNaN(val)) return val;
      }
    } catch {}
    return 60000;
  });
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDevice[]>([]);
  const [isScanningDevices, setIsScanningDevices] = useState(false);
  const [selectedDeviceToPair, setSelectedDeviceToPair] = useState<DiscoveredDevice | null>(null);
  const [isPairingInFlight, setIsPairingInFlight] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isConnected = status === 'connected' || Boolean(device);
  const isScanning = isScanningDevices || status === 'scanning' || status === 'connecting';
  const localIps = connectionService.getLocalIps();
  const primaryIp = localIps[0] || '192.168.31.210';
  const mobileUrl = `http://${primaryIp}:8766`;

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

  React.useEffect(() => {
    if (!isConnected) {
      fetchDiscoveredDevices();
    }
  }, [isConnected]);

  const [tokenSummary, setTokenSummary] = useState<AiTokenSummary | null>(() => connectionService.getTokenSummary());

  React.useEffect(() => {
    const unsubTokens = connectionService.subscribeTokenStats((stats) => {
      setTokenSummary(stats);
    });
    if (!connectionService.getTokenSummary()) {
      connectionService.fetchTokenSummary().catch(() => {});
    }
    return unsubTokens;
  }, []);

  const formatTokens = (num: number) => {
    if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
    return num.toLocaleString();
  };

  const handleConfirmPair = async () => {
    if (!selectedDeviceToPair) return;
    setIsPairingInFlight(true);
    try {
      await connectionService.pairWithDevice(selectedDeviceToPair, sasPin);
      setSelectedDeviceToPair(null);
    } finally {
      setIsPairingInFlight(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      connectionService.sendRealFile(file);
      e.target.value = '';
      onClose();
    }
  };

  const copyMobileLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(mobileUrl);
    setCopiedIp(true);
    setTimeout(() => setCopiedIp(false), 2000);
  };

  const openMobileApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(mobileUrl, '_blank');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      onClick={(e) => e.stopPropagation()}
      data-no-drag="true"
      className="relative mt-2 z-50 w-[360px] max-h-[min(82vh,560px)] flex flex-col bg-[#0A0C14]/90 border border-white/[0.14] rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.16)] p-3.5 backdrop-blur-3xl font-sans text-linear-text-primary overflow-hidden"
    >
      {/* Header with Glass Accent */}
      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/[0.08] shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[#5E6AD2]/20 border border-[#5E6AD2]/40 flex items-center justify-center text-[#5E6AD2] shadow-[0_0_12px_rgba(94,106,210,0.3)]">
            <Radio size={13} />
          </div>
          <span className="text-xs font-semibold tracking-tight text-white">Connection Hub</span>
          <span className="text-[10px] font-mono font-medium text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded-md border border-emerald-500/30">
            :8766
          </span>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-lg text-linear-text-tertiary hover:text-white hover:bg-white/10 active:scale-90 transition-all duration-150"
          title="Close connection hub"
        >
          <X size={14} />
        </button>
      </div>

      {/* Scrollable Body Container */}
      <div className="flex-1 overflow-y-auto pr-0.5 space-y-2.5 custom-scrollbar">
        {/* Main Connection State Card */}
        <div className="bg-white/[0.035] hover:bg-white/[0.05] border border-white/[0.08] rounded-xl p-3 backdrop-blur-xl transition-all duration-200">
          {isConnected ? (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#5E6AD2]/15 border border-[#5E6AD2]/30 flex items-center justify-center text-[#5E6AD2] shadow-[0_0_12px_rgba(94,106,210,0.2)]">
                    <Smartphone size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white tracking-tight">{device?.name || 'Mobile Companion (Android)'}</h4>
                    <span className="text-[10px] text-linear-text-secondary block font-mono">
                      {device?.model || `Local Companion (${primaryIp}:8766)`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-medium font-mono shadow-[0_0_10px_rgba(52,211,153,0.25)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Active Link
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-white/[0.06] text-[10px] font-mono text-linear-text-secondary">
                <div className="flex flex-col items-center justify-center bg-black/30 p-1.5 rounded-lg border border-white/[0.05]">
                  <span className="text-[9px] text-linear-text-tertiary">PING</span>
                  <span className="text-white font-medium">{device?.pingMs ?? 8} ms</span>
                </div>
                <div className="flex flex-col items-center justify-center bg-black/30 p-1.5 rounded-lg border border-white/[0.05]">
                  <span className="text-[9px] text-linear-text-tertiary">SIGNAL</span>
                  <span className="text-white font-medium">{device?.rssi ?? -45} dBm</span>
                </div>
                <div className="flex flex-col items-center justify-center bg-black/30 p-1.5 rounded-lg border border-white/[0.05]">
                  <span className="text-[9px] text-linear-text-tertiary">BATTERY</span>
                  <span className="text-white font-medium flex items-center gap-1">
                    <Battery size={11} className="text-emerald-400" /> {device?.batteryLevel ?? 95}%
                  </span>
                </div>
              </div>

              {/* Protocols Active */}
              <div className="flex items-center justify-between pt-0.5 text-[10px] text-linear-text-tertiary font-mono">
                <span className="flex items-center gap-1">
                  <Bluetooth size={11} className="text-[#5E6AD2]" /> BLE 5.3 Active
                </span>
                <span className="flex items-center gap-1">
                  <Wifi size={11} className="text-emerald-400" /> Direct LAN 42MB/s
                </span>
              </div>
            </div>
          ) : selectedDeviceToPair ? (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
                <button
                  onClick={() => setSelectedDeviceToPair(null)}
                  className="flex items-center gap-1 text-[11px] text-linear-text-secondary hover:text-white transition-colors"
                >
                  <ArrowLeft size={12} />
                  <span>Back to list</span>
                </button>
                <span className="text-[10px] font-mono font-medium text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/30">
                  Pairing SAS
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#5E6AD2]/20 border border-[#5E6AD2]/35 flex items-center justify-center text-[#5E6AD2]">
                  {selectedDeviceToPair.transport === 'ble' ? (
                    selectedDeviceToPair.name.toLowerCase().includes('bud') ||
                    selectedDeviceToPair.name.toLowerCase().includes('ear') ? (
                      <Headphones size={16} />
                    ) : (
                      <Bluetooth size={16} />
                    )
                  ) : (
                    <Smartphone size={16} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-semibold text-white tracking-tight truncate">
                    {selectedDeviceToPair.name}
                  </h4>
                  <span className="text-[10px] text-linear-text-secondary block font-mono truncate">
                    {selectedDeviceToPair.model}
                  </span>
                </div>
              </div>

              {/* 6-Digit PIN Verification Code Card */}
              <div className="bg-black/50 border border-white/[0.08] rounded-xl p-2.5 flex flex-col items-center justify-center gap-1 text-center">
                <span className="text-[9.5px] uppercase font-mono tracking-wider text-linear-text-tertiary flex items-center gap-1">
                  <ShieldCheck size={11} className="text-emerald-400" /> Verify SAS Pairing PIN
                </span>
                <span className="text-base font-mono font-bold tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/25 my-0.5">
                  {sasPin}
                </span>
                <span className="text-[9.5px] text-linear-text-tertiary">
                  Confirm PIN code matches your companion device
                </span>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => setSelectedDeviceToPair(null)}
                  className="flex-1 py-1.5 px-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-linear-text-secondary hover:text-white text-[11px] font-medium border border-white/[0.08] transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmPair}
                  disabled={isPairingInFlight}
                  className="flex-1 py-1.5 px-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-[11px] font-semibold shadow-[0_0_16px_rgba(52,211,153,0.35)] active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  {isPairingInFlight ? (
                    <RefreshCw size={12} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={13} />
                  )}
                  <span>Confirm Link</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.06]">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-white tracking-tight">Available Devices</span>
                  <span className="text-[9.5px] font-mono text-linear-text-tertiary">
                    ({discoveredDevices.length})
                  </span>
                </div>
                <button
                  onClick={fetchDiscoveredDevices}
                  disabled={isScanning}
                  className="flex items-center gap-1 text-[10.5px] text-[#5E6AD2] hover:text-[#7C88E8] font-mono transition-colors disabled:opacity-50"
                  title="Rescan nearby devices"
                >
                  <RefreshCw size={11} className={isScanning ? 'animate-spin' : ''} />
                  <span>{isScanning ? 'Scanning...' : 'Scan'}</span>
                </button>
              </div>

              {isScanning && discoveredDevices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-5 gap-2 text-center">
                  <RefreshCw size={18} className="text-[#5E6AD2] animate-spin" />
                  <span className="text-xs font-medium text-white">Scanning for nearby devices...</span>
                  <span className="text-[10px] text-linear-text-tertiary">
                    Checking Bluetooth peripherals & local Wi-Fi companions
                  </span>
                </div>
              ) : discoveredDevices.length > 0 ? (
                <div className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto pr-0.5 custom-scrollbar">
                  {discoveredDevices.map((dev) => (
                    <div
                      key={dev.id}
                      className="group flex items-center justify-between p-2 rounded-xl bg-black/30 hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/[0.12] transition-all"
                    >
                      <div className="flex items-center gap-2 min-w-0 mr-2">
                        <div className="w-7 h-7 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-[#5E6AD2] shrink-0">
                          {dev.transport === 'ble' ? (
                            dev.name.toLowerCase().includes('bud') || dev.name.toLowerCase().includes('ear') ? (
                              <Headphones size={13} />
                            ) : (
                              <Bluetooth size={13} />
                            )
                          ) : (
                            <Wifi size={13} className="text-emerald-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h5 className="text-[11px] font-semibold text-white truncate">{dev.name}</h5>
                          <div className="flex items-center gap-1.5 text-[9.5px] text-linear-text-tertiary font-mono">
                            <span>{dev.transport === 'ble' ? 'BLE 5.3' : 'Wi-Fi LAN'}</span>
                            <span>•</span>
                            <span>{dev.rssi} dBm</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => setSelectedDeviceToPair(dev)}
                        className="px-2.5 py-1 rounded-lg bg-[#5E6AD2] hover:bg-[#6875E3] text-white text-[10.5px] font-semibold shrink-0 shadow-[0_0_12px_rgba(94,106,210,0.3)] active:scale-95 transition-all"
                      >
                        Pair
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-4 gap-2 text-center">
                  <div className="w-8 h-8 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                    <Power size={14} />
                  </div>
                  <div>
                    <h5 className="text-xs font-semibold text-white">No Devices Detected</h5>
                    <p className="text-[10px] text-linear-text-secondary mt-0.5">
                      Turn on Bluetooth or connect companion to local Wi-Fi.
                    </p>
                  </div>
                  <button
                    onClick={fetchDiscoveredDevices}
                    className="mt-1 px-3 py-1 rounded-lg bg-[#5E6AD2] hover:bg-[#6875E3] text-white text-[10.5px] font-medium shadow-[0_0_12px_rgba(94,106,210,0.3)] active:scale-95 transition-all"
                  >
                    Scan Again
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pairing Credentials Glass Card (Mobile URL + SAS PIN) */}
        <div className="bg-white/[0.035] hover:bg-white/[0.05] border border-white/[0.08] rounded-xl p-2.5 backdrop-blur-xl transition-all duration-200 flex flex-col gap-2">
          {/* Mobile Web URL Row */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-linear-text-secondary">
                <Globe size={11} className="text-[#5E6AD2]" />
                <span>Mobile Link:</span>
              </div>
              <button
                onClick={openMobileApp}
                className="flex items-center gap-1 text-[10px] text-[#5E6AD2] hover:text-[#7C88E8] hover:underline font-mono transition-colors"
                title="Open companion in browser"
              >
                Open Web App <ExternalLink size={9} />
              </button>
            </div>

            <div className="flex items-center justify-between bg-black/40 px-2 py-1 rounded-lg border border-white/[0.06] font-mono text-[11px]">
              <span className="text-white/90 select-all truncate mr-1.5">{mobileUrl}</span>
              <button
                onClick={copyMobileLink}
                className="p-1 rounded-md hover:bg-white/10 active:scale-90 text-linear-text-tertiary hover:text-white transition-all"
                title="Copy URL"
              >
                {copiedIp ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              </button>
            </div>
          </div>

          {/* SAS PIN Row */}
          <div className="flex items-center justify-between pt-1.5 border-t border-white/[0.05]">
            <div className="flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-[#5E6AD2]" />
              <span className="text-[10px] text-linear-text-tertiary font-mono uppercase tracking-wider">
                Pairing PIN (SAS):
              </span>
              <span className="text-xs font-mono font-semibold tracking-wider text-white bg-black/40 px-1.5 py-0.5 rounded border border-white/[0.06]">
                {sasPin}
              </span>
            </div>

            <button
              onClick={onRegeneratePin}
              title="Regenerate Pairing PIN"
              className="p-1 rounded-md hover:bg-white/10 active:scale-90 text-linear-text-tertiary hover:text-white transition-all"
            >
              <RefreshCw size={11} />
            </button>
          </div>
        </div>

        {/* Hidden file input for native file selection */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".apk,application/vnd.android.package-archive,*"
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Native AI Token Telemetry Quick Glance */}
        <div
          onClick={() => {
            onClose();
            onOpenSettings('tokens');
          }}
          className="group cursor-pointer bg-white/[0.035] hover:bg-white/[0.06] border border-white/[0.08] hover:border-[#5E6AD2]/40 rounded-xl p-2.5 backdrop-blur-xl transition-all duration-200 flex flex-col gap-1.5 shadow-sm hover:shadow-[0_0_16px_rgba(94,106,210,0.15)]"
          title="Click to view AI Token Telemetry dashboard"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-md bg-[#5E6AD2]/20 border border-[#5E6AD2]/35 flex items-center justify-center text-[#7C88E8] group-hover:scale-110 transition-transform">
                <Zap size={11} className="text-[#5E6AD2]" />
              </div>
              <span className="text-[11px] font-semibold text-white tracking-tight flex items-center gap-1.5">
                AI Token Telemetry
                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Native
                </span>
              </span>
            </div>
            <span className="text-[10px] text-[#7C88E8] group-hover:text-white font-mono flex items-center gap-0.5 transition-colors">
              Details &rarr;
            </span>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-white/[0.05] text-[10px] font-mono">
            <div className="flex flex-col">
              <span className="text-[8.5px] uppercase text-linear-text-tertiary">Today's Tokens</span>
              <span className="text-white font-bold text-xs tracking-tight">
                {tokenSummary ? formatTokens(tokenSummary.todayTokens) : '...'}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[9px] text-linear-text-secondary">
              {tokenSummary?.byPlatform?.antigravity?.sessionsCount ? (
                <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/25">
                  Antigravity
                </span>
              ) : null}
              {tokenSummary?.byPlatform?.codex?.sessionsCount ? (
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                  Codex
                </span>
              ) : null}
              {tokenSummary?.byPlatform?.claude?.sessionsCount ? (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25">
                  Claude
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Quick Workstation Actions (Glassmorphic Buttons with Glows) */}
        <div>
          <div className="flex items-center justify-between mb-1.5 px-0.5">
            <span className="text-[9.5px] uppercase font-mono tracking-wider text-linear-text-tertiary flex items-center gap-1">
              <Sparkles size={9} className="text-[#5E6AD2]" /> Quick Actions
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Select files from desktop to send to phone"
              className="flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 hover:border-emerald-500/40 hover:shadow-[0_0_16px_rgba(52,211,153,0.3)] active:scale-[0.96] transition-all duration-150 text-[10.5px] font-semibold"
            >
              <FolderDown size={12} /> Send File
            </button>
            <button
              onClick={() => {
                connectionService.executeCliCommand('sysinfo');
                onClose();
              }}
              title="Run system specs diagnostics"
              className="flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl bg-[#5E6AD2]/10 hover:bg-[#5E6AD2]/20 text-[#7C88E8] border border-[#5E6AD2]/25 hover:border-[#5E6AD2]/40 hover:shadow-[0_0_16px_rgba(94,106,210,0.3)] active:scale-[0.96] transition-all duration-150 text-[10.5px] font-semibold"
            >
              <Terminal size={12} /> Specs
            </button>
            <button
              onClick={() => connectionService.openTransfersFolder()}
              title="Open downloads & transfers directory"
              className="flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl bg-white/[0.05] hover:bg-white/[0.12] text-white/90 hover:text-white border border-white/[0.08] hover:border-white/20 hover:shadow-[0_0_14px_rgba(255,255,255,0.15)] active:scale-[0.96] transition-all duration-150 text-[10.5px] font-semibold"
            >
              <FolderDown size={12} /> Storage
            </button>
          </div>
        </div>

        {/* Ambient Mascot Orb Settings & Instant Preview */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-2.5 flex flex-col gap-2 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles size={11} className="text-[#5E6AD2]" />
              <span className="text-[11px] font-semibold text-white tracking-tight">Idle Mascot Orb</span>
            </div>
            <button
              onClick={() => {
                onClose();
                window.dispatchEvent(new CustomEvent('soko:preview-mascot-mode'));
              }}
              className="text-[10px] text-[#7C88E8] hover:text-white bg-[#5E6AD2]/15 hover:bg-[#5E6AD2]/30 px-2 py-0.5 rounded-lg border border-[#5E6AD2]/30 active:scale-95 transition-all font-medium flex items-center gap-1"
              title="Preview enlarged mascot orb now"
            >
              <span>Preview Orb</span>
            </button>
          </div>
          <div className="flex items-center justify-between text-[10px] text-linear-text-secondary">
            <span>Auto-contract after:</span>
            <div className="flex items-center gap-1">
              {[
                { label: '30s', val: 30000 },
                { label: '1m', val: 60000 },
                { label: '2m', val: 120000 },
                { label: '5m', val: 300000 },
                { label: 'Off', val: 0 },
              ].map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => {
                    setIdleTimeoutVal(opt.val);
                    localStorage.setItem('soko_idle_timeout', String(opt.val));
                    window.dispatchEvent(new Event('soko:idle-settings-changed'));
                  }}
                  className={`px-1.5 py-0.5 rounded font-mono text-[9.5px] transition-all ${
                    idleTimeoutVal === opt.val
                      ? 'bg-[#5E6AD2] text-white font-semibold shadow-sm'
                      : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Transfer Pill */}
        {connectionService.getTransferHistory().length > 0 && (
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl px-2.5 py-1.5 flex items-center justify-between text-[10px] backdrop-blur-md">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-linear-text-secondary truncate font-mono">
                Last: {connectionService.getTransferHistory()[0].filename}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 ml-2">
              <button
                onClick={() => connectionService.openTransferredFile(connectionService.getTransferHistory()[0].filename)}
                className="text-[10px] text-[#5E6AD2] hover:text-[#7C88E8] hover:underline font-mono"
                title="Open transferred file"
              >
                Open
              </button>
              <span className="text-white/20">•</span>
              <button
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
                className="text-[10px] text-linear-text-secondary hover:text-white font-mono"
              >
                History &rarr;
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Action Footer (Permanently Pinned at Bottom, Never Cut Off) */}
      <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-white/[0.08] shrink-0">
        {isConnected ? (
          <button
            onClick={onDisconnect}
            className="px-3 py-1.5 rounded-xl text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 text-[11px] font-semibold border border-rose-500/25 hover:border-rose-500/40 hover:shadow-[0_0_12px_rgba(244,63,94,0.25)] active:scale-[0.96] transition-all duration-150"
          >
            Disconnect Link
          </button>
        ) : (
          <span className="text-[10px] text-linear-text-tertiary font-mono">Status: Offline</span>
        )}

        <button
          onClick={() => onOpenSettings()}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-white bg-white/[0.08] hover:bg-white/[0.14] text-[11px] font-semibold border border-white/[0.12] hover:border-white/20 hover:shadow-[0_0_14px_rgba(255,255,255,0.15)] active:scale-[0.96] transition-all duration-150 ml-auto"
        >
          <span>Open Settings</span>
          <ExternalLink size={12} />
        </button>
      </div>
    </motion.div>
  );
};
