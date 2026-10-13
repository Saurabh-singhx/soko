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
  Bell,
  Terminal,
  FolderDown,
} from 'lucide-react';
import { ConnectionStatus, PairedDevice } from '../../types/index.ts';
import { connectionService } from '../../services/connection.ts';

interface ConnectionPopoverProps {
  status: ConnectionStatus;
  device: PairedDevice | null;
  sasPin: string;
  onScanAndConnect: () => void;
  onDisconnect: () => void;
  onRegeneratePin: () => void;
  onOpenSettings: () => void;
  onClose: () => void;
}

/**
 * Linear-styled Floating Connection Hub Popover.
 *
 * Displays live device pairing details, signal metrics (RSSI, ping),
 * SAS cryptographic PIN, transport protocol status, local network pairing IP,
 * and quick connection actions.
 */
export const ConnectionPopover: React.FC<ConnectionPopoverProps> = ({
  status,
  device,
  sasPin,
  onScanAndConnect,
  onDisconnect,
  onRegeneratePin,
  onOpenSettings,
  onClose,
}) => {
  const [copiedIp, setCopiedIp] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isConnected = status === 'connected';
  const isScanning = status === 'scanning' || status === 'connecting';
  const localIps = connectionService.getLocalIps();
  const primaryIp = localIps[0] || '192.168.31.210';
  const mobileUrl = `http://${primaryIp}:8766`;

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
      initial={{ opacity: 0, y: -8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.96 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      onClick={(e) => e.stopPropagation()}
      className="absolute top-14 z-50 w-84 bg-[#0C0D0E]/95 border border-white/10 rounded-xl shadow-2xl p-3.5 backdrop-blur-2xl font-sans text-linear-text-primary"
      style={{ width: '340px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-[#5E6AD2]/15 border border-[#5E6AD2]/30 flex items-center justify-center text-[#5E6AD2]">
            <Radio size={12} />
          </div>
          <span className="text-xs font-semibold tracking-tight text-white">Connection Hub</span>
          <span className="text-[10px] font-mono text-linear-green bg-linear-green/10 px-1.5 py-0.5 rounded border border-linear-green/20">
            :8766
          </span>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-md text-linear-text-tertiary hover:text-white hover:bg-white/5 transition-colors"
          title="Close connection hub"
        >
          <X size={13} />
        </button>
      </div>

      {/* Main Connection State Card */}
      <div className="bg-[#121417] border border-white/5 rounded-lg p-3 mb-2.5">
        {isConnected && device ? (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-linear-brand/10 border border-linear-brand/20 flex items-center justify-center text-linear-brand">
                  <Smartphone size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-white tracking-tight">{device.name}</h4>
                  <span className="text-[10px] text-linear-text-secondary block font-mono">
                    {device.model}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-linear-green/10 border border-linear-green/20 text-linear-green text-[10px] font-medium font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-linear-green animate-pulse" />
                Active
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-white/5 text-[10px] font-mono text-linear-text-secondary">
              <div className="flex flex-col items-center justify-center bg-black/30 p-1.5 rounded border border-white/5">
                <span className="text-[9px] text-linear-text-tertiary">PING</span>
                <span className="text-white font-medium">{device.pingMs} ms</span>
              </div>
              <div className="flex flex-col items-center justify-center bg-black/30 p-1.5 rounded border border-white/5">
                <span className="text-[9px] text-linear-text-tertiary">SIGNAL</span>
                <span className="text-white font-medium">{device.rssi} dBm</span>
              </div>
              <div className="flex flex-col items-center justify-center bg-black/30 p-1.5 rounded border border-white/5">
                <span className="text-[9px] text-linear-text-tertiary">BATTERY</span>
                <span className="text-white font-medium flex items-center gap-1">
                  <Battery size={10} className="text-linear-green" /> {device.batteryLevel}%
                </span>
              </div>
            </div>

            {/* Protocols Active */}
            <div className="flex items-center justify-between pt-1 text-[10px] text-linear-text-tertiary font-mono">
              <span className="flex items-center gap-1">
                <Bluetooth size={11} className="text-linear-brand" /> BLE 5.3 Active
              </span>
              <span className="flex items-center gap-1">
                <Wifi size={11} className="text-linear-green" /> Hotspot 42MB/s
              </span>
            </div>
          </div>
        ) : isScanning ? (
          <div className="flex flex-col items-center justify-center py-4 gap-2 text-center">
            <RefreshCw size={20} className="text-linear-brand animate-spin" />
            <h4 className="text-xs font-semibold text-white">Scanning for Devices...</h4>
            <p className="text-[10px] text-linear-text-secondary max-w-[200px]">
              Searching for mobile companion running on Pixel or Galaxy device.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-3 gap-2 text-center">
            <div className="w-8 h-8 rounded-full bg-linear-red/10 border border-linear-red/20 flex items-center justify-center text-linear-red">
              <Power size={14} />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-white">Not Connected</h4>
              <p className="text-[10px] text-linear-text-secondary">
                No paired mobile companion currently linked.
              </p>
            </div>
            <button
              onClick={onScanAndConnect}
              className="mt-1 px-3 py-1 rounded-md bg-linear-brand hover:bg-linear-brand-hover text-white text-[11px] font-medium transition-colors"
            >
              Scan & Connect
            </button>
          </div>
        )}
      </div>

      {/* Mobile Pairing URL Card (Connect Phone via Wi-Fi) */}
      <div className="bg-[#121417] border border-white/5 rounded-lg p-2.5 mb-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-linear-text-secondary">
            <Globe size={11} className="text-linear-brand" />
            <span>Open on Mobile Phone:</span>
          </div>
          <button
            onClick={openMobileApp}
            className="flex items-center gap-1 text-[10px] text-linear-brand hover:underline font-mono"
            title="Open companion in browser"
          >
            Open Web App <ExternalLink size={9} />
          </button>
        </div>

        <div className="flex items-center justify-between bg-black/40 px-2.5 py-1.5 rounded border border-white/5 font-mono text-[11px]">
          <span className="text-white select-all">{mobileUrl}</span>
          <button
            onClick={copyMobileLink}
            className="p-1 rounded hover:bg-white/10 text-linear-text-tertiary hover:text-white transition-colors"
            title="Copy URL"
          >
            {copiedIp ? <Check size={12} className="text-linear-green" /> : <Copy size={12} />}
          </button>
        </div>
      </div>

      {/* Security SAS PIN Card */}
      <div className="bg-[#121417] border border-white/5 rounded-lg p-2.5 mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} className="text-linear-brand shrink-0" />
          <div className="flex flex-col">
            <span className="text-[9px] uppercase tracking-wider text-linear-text-tertiary font-mono">
              Pairing PIN (SAS)
            </span>
            <span className="text-xs font-mono font-semibold tracking-wider text-white">
              {sasPin}
            </span>
          </div>
        </div>

        <button
          onClick={onRegeneratePin}
          title="Regenerate Pairing PIN"
          className="p-1 rounded-md hover:bg-white/5 text-linear-text-tertiary hover:text-white transition-colors"
        >
          <RefreshCw size={12} />
        </button>
      </div>

      {/* Hidden file input for native file selection */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".apk,application/vnd.android.package-archive,*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Quick Test Actions */}
      <div className="flex items-center gap-1.5 mb-2.5">
        <button
          onClick={() => connectionService.sendTestNotification('WhatsApp', 'Alex Rivera', 'Hey! Live connection test from Dynamic Island.')}
          className="flex-1 flex items-center justify-center gap-1 py-1 rounded bg-white/5 hover:bg-white/10 text-[10px] text-linear-text-secondary hover:text-white border border-white/5 transition-colors"
        >
          <Bell size={10} /> Test Notif
        </button>
        <button
          onClick={() => connectionService.sendTestCli('status')}
          className="flex-1 flex items-center justify-center gap-1 py-1 rounded bg-white/5 hover:bg-white/10 text-[10px] text-linear-text-secondary hover:text-white border border-white/5 transition-colors"
        >
          <Terminal size={10} /> Test CLI
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          title="Select an APK or file from desktop to transmit"
          className="flex-1 flex items-center justify-center gap-1 py-1 rounded bg-white/5 hover:bg-white/10 text-[10px] text-linear-green border border-white/5 transition-colors"
        >
          <FolderDown size={10} /> Send APK
        </button>
      </div>

      {/* Recent Transfer Pill */}
      {connectionService.getTransferHistory().length > 0 && (
        <div className="bg-[#121417] border border-white/5 rounded-lg px-2.5 py-1.5 mb-2.5 flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-1.5 h-1.5 rounded-full bg-linear-green" />
            <span className="text-linear-text-secondary truncate font-mono">
              Last: {connectionService.getTransferHistory()[0].filename}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            <button
              onClick={() => connectionService.openTransferredFile(connectionService.getTransferHistory()[0].filename)}
              className="text-[10px] text-linear-brand hover:underline font-mono"
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

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-white/5">
        {isConnected ? (
          <button
            onClick={onDisconnect}
            className="px-2.5 py-1 rounded-md text-linear-red hover:bg-linear-red/10 text-[11px] font-medium border border-linear-red/20 transition-colors"
          >
            Disconnect Link
          </button>
        ) : (
          <span className="text-[10px] text-linear-text-tertiary font-mono">Offline</span>
        )}

        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-linear-text-secondary hover:text-white hover:bg-white/5 text-[11px] font-medium transition-colors ml-auto"
        >
          <span>Settings</span>
          <ExternalLink size={11} />
        </button>
      </div>
    </motion.div>
  );
};
