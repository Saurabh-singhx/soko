import React from 'react';
import {
  Sliders,
  Smartphone,
  Zap,
  Terminal,
  FolderDown,
  ShieldCheck,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { SettingsTabId } from '../types.ts';

interface SettingsSidebarProps {
  activeTab: SettingsTabId;
  onSelectTab: (tab: SettingsTabId) => void;
  version?: string;
}

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  activeTab,
  onSelectTab,
  version = '1.0.3',
}) => {
  const tabs = [
    { id: 'general' as const, label: 'General', icon: Sliders },
    { id: 'pairing' as const, label: 'Device & Pairing', icon: Smartphone },
    { id: 'tokens' as const, label: 'Token Telemetry', icon: Zap },
    { id: 'cli' as const, label: 'CLI & Agents', icon: Terminal },
    { id: 'files' as const, label: 'File Transfers', icon: FolderDown },
    { id: 'security' as const, label: 'Zero-Trust Security', icon: ShieldCheck },
    { id: 'mascot' as const, label: 'Mascot & Characters', icon: Sparkles },
    { id: 'updates' as const, label: 'Updates', icon: RefreshCw },
  ];

  return (
    <aside
      className="w-56 shrink-0 bg-[#08090C] border-r border-white/[0.08] flex flex-col justify-between p-3 select-none"
      role="tablist"
      aria-orientation="vertical"
      aria-label="Settings Navigation"
    >
      <div className="space-y-1">
        <div className="px-2.5 py-2 mb-2 flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[#5E6AD2]/20 border border-[#5E6AD2]/40 flex items-center justify-center text-[#5E6AD2] shadow-[0_0_12px_rgba(94,106,210,0.3)]">
            <Sparkles size={13} />
          </div>
          <div>
            <span className="text-xs font-semibold text-white tracking-tight block">Soko Hub</span>
            <span className="text-[10px] text-neutral-400 font-mono block">v{version}</span>
          </div>
        </div>

        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onSelectTab(tab.id)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5E6AD2] ${
                isActive
                  ? 'bg-white/[0.08] text-white shadow-xs border border-white/[0.12]'
                  : 'text-neutral-400 hover:text-white hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              <Icon
                size={14}
                className={isActive ? 'text-[#8A95FF]' : 'text-neutral-400'}
              />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="p-2 border-t border-white/[0.06] text-[10px] text-neutral-400 font-mono">
        <span>Desktop HUD Companion</span>
      </div>
    </aside>
  );
};
