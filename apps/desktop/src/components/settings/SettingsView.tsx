import React, { useState, useEffect } from 'react';
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
  Bell,
} from 'lucide-react';
import { connectionService } from '../../services/connection.ts';
import { ConnectionStatus, PairedDevice } from '../../types/index.ts';

interface SettingsViewProps {
  onClose?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'pairing' | 'cli' | 'files' | 'security'>('pairing');
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

    return () => {
      unsubStatus();
      unsubBridge();
    };
  }, []);

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
              <span className="linear-kbd">1</span>
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
              <span className="linear-kbd">2</span>
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
              <span className="linear-kbd">3</span>
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
              <span className="linear-kbd">4</span>
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
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-1.5 rounded-md hover:bg-white/5 text-linear-text-secondary hover:text-white transition-colors"
            title="Close Settings"
          >
            <X size={16} />
          </button>
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

            {/* Paired Device Card */}
            <div className="linear-card rounded-lg p-4 flex items-center justify-between">
              {connectionStatus === 'connected' && pairedDevice ? (
                <>
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
                </>
              ) : connectionStatus === 'scanning' || connectionStatus === 'connecting' ? (
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-linear-amber/15 border border-linear-amber/30 flex items-center justify-center text-linear-amber">
                      <RefreshCw size={16} className="animate-spin" />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-white">Scanning for Devices...</h3>
                      <span className="text-[11px] text-linear-text-secondary font-mono">
                        Advertising Soko BLE Service (7D2A0001)...
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => connectionService.disconnectDevice()}
                    className="px-2.5 py-1 rounded-md bg-white/5 text-linear-text-secondary text-xs hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-linear-red/15 border border-linear-red/30 flex items-center justify-center text-linear-red">
                      <Power size={16} />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-white">No Device Connected</h3>
                      <span className="text-[11px] text-linear-text-secondary font-mono">
                        Bluetooth & Hotspot ready for pairing
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => connectionService.scanAndConnect()}
                    className="linear-button-primary px-3 py-1 text-xs"
                  >
                    Scan & Connect
                  </button>
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

              {/* Direct Diagnostic Triggers */}
              <div className="pt-2 border-t border-white/5 flex flex-col gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-linear-text-tertiary">
                  Instant Link Verification Triggers
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => connectionService.sendTestNotification('WhatsApp', 'Alex Rivera', 'Live connection verified from Settings!')}
                    className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded bg-white/5 hover:bg-white/10 text-[11px] text-white border border-white/5 transition-colors"
                  >
                    <Bell size={12} className="text-[#25D366]" /> Send Notif
                  </button>
                  <button
                    onClick={() => connectionService.sendTestCli('status')}
                    className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded bg-white/5 hover:bg-white/10 text-[11px] text-white border border-white/5 transition-colors"
                  >
                    <Terminal size={12} className="text-linear-brand" /> Run CLI
                  </button>
                  <button
                    onClick={() => connectionService.sendTestTransfer()}
                    className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded bg-white/5 hover:bg-white/10 text-[11px] text-white border border-white/5 transition-colors"
                  >
                    <FolderDown size={12} className="text-linear-green" /> Send APK
                  </button>
                </div>
              </div>
            </div>
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
              <h2 className="text-base font-semibold text-linear-text-primary tracking-tight">Hotspot File Conduit</h2>
              <p className="text-xs text-linear-text-secondary mt-1">
                Build APKs and assets transferred over Mobile Hotspot LAN are saved here with SHA-256 validation.
              </p>
            </div>

            <div className="linear-card rounded-lg p-4 flex flex-col gap-3">
              <label className="text-xs font-medium text-linear-text-primary tracking-tight">Default Download Directory</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={downloadDir}
                  onChange={(e) => setDownloadDir(e.target.value)}
                  className="flex-1 bg-[#08090A] border border-white/10 rounded-md px-3 py-1.5 text-xs font-mono text-linear-text-primary focus:outline-none focus:border-[#5E6AD2]"
                />
                <button className="linear-button-secondary px-3 py-1.5">
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
      </main>
    </div>
  );
};
