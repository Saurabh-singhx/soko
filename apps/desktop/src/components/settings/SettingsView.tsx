import React, { useState } from 'react';
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
} from 'lucide-react';

interface SettingsViewProps {
  onClose?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'pairing' | 'cli' | 'files' | 'security'>('pairing');
  const [pairingPin] = useState('482 195');

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
    <div className="flex h-screen w-screen bg-[#0D0D12] text-zinc-100 font-sans select-none overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-56 bg-[#12121A] border-r border-white/10 flex flex-col justify-between p-4">
        <div>
          {/* Logo & Header */}
          <div className="flex items-center gap-2 mb-6 px-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center font-bold text-white text-sm shadow-md">
              S
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight">SOKO</h1>
              <span className="text-[10px] text-zinc-400 font-mono">v0.1.0 • Desktop</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1">
            <button
              onClick={() => setActiveTab('pairing')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'pairing'
                  ? 'bg-white/10 text-cyan-400'
                  : 'text-zinc-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Smartphone size={16} /> Device Pairing
            </button>

            <button
              onClick={() => setActiveTab('cli')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'cli'
                  ? 'bg-white/10 text-cyan-400'
                  : 'text-zinc-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Terminal size={16} /> CLI Whitelist
            </button>

            <button
              onClick={() => setActiveTab('files')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'files'
                  ? 'bg-white/10 text-cyan-400'
                  : 'text-zinc-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <FolderDown size={16} /> File Storage
            </button>

            <button
              onClick={() => setActiveTab('security')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'security'
                  ? 'bg-white/10 text-cyan-400'
                  : 'text-zinc-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <ShieldCheck size={16} /> Security & Tunnel
            </button>
          </nav>
        </div>

        {/* Status Pill */}
        <div className="bg-black/40 border border-white/5 rounded-lg p-2.5 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <div className="flex flex-col text-[10px]">
            <span className="font-semibold text-zinc-300">Bluetooth Active</span>
            <span className="text-zinc-500 font-mono">BLE 5.2 • Hotspot Ready</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-8 relative">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
            title="Close Settings"
          >
            <X size={18} />
          </button>
        )}
        {/* Device Pairing Tab */}
        {activeTab === 'pairing' && (
          <div className="max-w-xl flex flex-col gap-6">
            <div>
              <h2 className="text-lg font-bold text-white">Device Pairing & Link Status</h2>
              <p className="text-xs text-zinc-400 mt-1">
                Pair your mobile phone using Bluetooth Low Energy. Soko verifies connection integrity with a 6-digit confirmation code.
              </p>
            </div>

            {/* Confirmation Code Card */}
            <div className="bg-[#15151F] border border-white/10 rounded-xl p-5 flex flex-col items-center justify-center gap-3">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">
                Pairing Confirmation PIN (SAS)
              </span>
              <div className="text-3xl font-mono font-bold tracking-widest text-cyan-400 bg-black/50 px-6 py-2.5 rounded-lg border border-cyan-500/20 shadow-mascot-glow">
                {pairingPin}
              </div>
              <p className="text-[11px] text-zinc-400 text-center max-w-sm">
                Verify that this 6-digit number matches the PIN shown on your mobile device's pairing screen.
              </p>
            </div>

            {/* Paired Device Card */}
            <div className="bg-[#15151F] border border-white/10 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Smartphone size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Pixel 8 Pro (Connected)</h3>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 size={12} /> Paired & Trusted
                    </span>
                    <span>•</span>
                    <span className="font-mono">RSSI: -58 dBm</span>
                  </div>
                </div>
              </div>

              <button className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium transition-colors">
                Unpair
              </button>
            </div>
          </div>
        )}

        {/* CLI Whitelist Tab */}
        {activeTab === 'cli' && (
          <div className="max-w-2xl flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Remote CLI Whitelist</h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Control developer tools (like Antigravity CLI) from your phone. Only commands registered here can be executed.
                </p>
              </div>

              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-semibold transition-colors">
                <Plus size={14} /> Add Command
              </button>
            </div>

            {/* Command List */}
            <div className="flex flex-col gap-2.5">
              {commands.map((cmd) => (
                <div
                  key={cmd.id}
                  className="bg-[#15151F] border border-white/10 rounded-xl p-3.5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                      <Terminal size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-semibold text-white truncate">{cmd.title}</h3>
                        <span className="text-[10px] font-mono text-zinc-400 bg-black/40 px-1.5 py-0.5 rounded border border-white/5">
                          {cmd.id}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-cyan-400 truncate mt-0.5">
                        $ {cmd.program} {cmd.args}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() =>
                        setCommands((prev) =>
                          prev.map((c) =>
                            c.id === cmd.id ? { ...c, requiresBiometrics: !c.requiresBiometrics } : c
                          )
                        )
                      }
                      title="Toggle Biometric Requirement"
                      className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium border transition-colors ${
                        cmd.requiresBiometrics
                          ? 'bg-purple-500/10 border-purple-500/30 text-purple-300'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                      }`}
                    >
                      {cmd.requiresBiometrics ? <Lock size={11} /> : <Unlock size={11} />}
                      {cmd.requiresBiometrics ? 'Biometrics Required' : 'Instant Run'}
                    </button>

                    <button
                      onClick={() => setCommands((prev) => prev.filter((c) => c.id !== cmd.id))}
                      className="p-1.5 rounded hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
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
              <h2 className="text-lg font-bold text-white">High-Speed File Transfer & Sandbox</h2>
              <p className="text-xs text-zinc-400 mt-1">
                Files transferred via Mobile Hotspot / LAN are automatically saved here with cryptographic verification.
              </p>
            </div>

            <div className="bg-[#15151F] border border-white/10 rounded-xl p-4 flex flex-col gap-3">
              <label className="text-xs font-semibold text-zinc-300">Default Download Directory</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={downloadDir}
                  onChange={(e) => setDownloadDir(e.target.value)}
                  className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-cyan-500"
                />
                <button className="px-3 py-2 bg-white/10 hover:bg-white/20 text-xs font-medium rounded-lg transition-colors">
                  Browse
                </button>
              </div>
              <p className="text-[11px] text-zinc-500">
                All incoming files are scanned for path traversal attempts (`../`) and SHA-256 checksums are verified before final commit.
              </p>
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="max-w-xl flex flex-col gap-6">
            <div>
              <h2 className="text-lg font-bold text-white">Zero-Trust Security & Encryption</h2>
              <p className="text-xs text-zinc-400 mt-1">
                Cryptographic parameters protecting the Bluetooth link and local Hotspot conduit.
              </p>
            </div>

            <div className="bg-[#15151F] border border-white/10 rounded-xl p-4 flex flex-col gap-3 text-xs">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-zinc-400">Cipher Suite</span>
                <span className="font-mono text-cyan-400">AES-256-GCM + X25519</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-zinc-400">Replay Attack Protection</span>
                <span className="font-mono text-emerald-400">Monotonic Nonces (Strict)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-zinc-400">Firewall Evasion</span>
                <span className="font-mono text-zinc-300">Outbound Client-Pull (No open PC ports)</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
