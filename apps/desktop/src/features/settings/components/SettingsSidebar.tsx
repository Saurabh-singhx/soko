import React, { useState } from 'react';
import { Sliders, Smartphone, Zap, FolderDown, ShieldCheck, Sparkles, RefreshCw, Bot, Search, X, Power, Radio } from 'lucide-react';
import { SettingsTabId } from '../types.ts';

export const SETTINGS_NAVIGATION = [
  { id: 'pairing', label: 'Devices & pairing', icon: Smartphone, group: 'Workspace', shortcut: '2', keywords: 'phone bluetooth wifi connect' },
  { id: 'files', label: 'File transfers', icon: FolderDown, group: 'Workspace', shortcut: '5', keywords: 'storage downloads send apk' },
  { id: 'swarm', label: 'Agent activity', icon: Bot, group: 'Workspace', shortcut: '3', keywords: 'swarm sub agents visualizer' },
  { id: 'tokens', label: 'Token usage', icon: Zap, group: 'Workspace', shortcut: '9', keywords: 'ai telemetry tracker cost' },
  { id: 'general', label: 'General', icon: Sliders, group: 'Preferences', shortcut: '1', keywords: 'startup system display' },
  { id: 'mascot', label: 'Mascot & island', icon: Sparkles, group: 'Preferences', shortcut: '7', keywords: 'characters appearance idle' },
  { id: 'security', label: 'Security', icon: ShieldCheck, group: 'Preferences', shortcut: '6', keywords: 'trust tunnel credentials' },
  { id: 'updates', label: 'Updates', icon: RefreshCw, group: 'Preferences', shortcut: '8', keywords: 'version feed download' },
] satisfies { id: SettingsTabId; label: string; icon: typeof Sliders; group: string; shortcut: string; keywords: string }[];

interface SettingsSidebarProps {
  activeTab: SettingsTabId;
  onSelectTab: (tab: SettingsTabId) => void;
  version: string;
  isBridgeOnline: boolean;
  deviceName?: string;
  onQuit?: () => void;
}

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({ activeTab, onSelectTab, version, isBridgeOnline, deviceName, onQuit }) => {
  const [query, setQuery] = useState('');
  const matches = SETTINGS_NAVIGATION.filter(tab => `${tab.label} ${tab.keywords}`.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <aside className="settings-sidebar">
      <div className="settings-brand">
        <div className="settings-brand-mark" aria-hidden="true"><Sparkles size={22} /></div>
        <div><span className="settings-brand-name">soko<span>.</span></span><p>Your connected workspace</p></div>
      </div>
      <div className="settings-search">
        <Search size={16} aria-hidden="true" />
        <input aria-label="Find a settings section" placeholder="Find a setting…" value={query} onChange={event => setQuery(event.target.value)} />
        {query && <button onClick={() => setQuery('')} aria-label="Clear settings search"><X size={14} /></button>}
      </div>
      <nav className="settings-navigation" aria-label="Settings sections">
        {['Workspace', 'Preferences'].map(group => {
          const tabs = matches.filter(tab => tab.group === group);
          if (!tabs.length) return null;
          return <div className="settings-nav-group" key={group}>
            <p className="settings-nav-label">{group}</p>
            {tabs.map(({ id, label, icon: Icon, shortcut }) => (
              <button key={id} className={`settings-nav-item ${activeTab === id ? 'is-active' : ''}`} aria-current={activeTab === id ? 'page' : undefined}
                aria-controls="settings-content" onClick={() => onSelectTab(id)} title={`${label} · ${shortcut}`}>
                <Icon size={18} aria-hidden="true" /><span>{label}</span><kbd>{shortcut}</kbd>
              </button>
            ))}
          </div>;
        })}
        {!matches.length && <p className="settings-search-empty" role="status">No matching sections. Try “devices”, “files”, or “startup”.</p>}
      </nav>
      <div className="settings-sidebar-footer">
        <button className="settings-connection" onClick={() => onSelectTab('pairing')} aria-label="View device connection">
          <Radio size={18} className={isBridgeOnline ? 'text-emerald-400' : 'text-amber-300'} aria-hidden="true" />
          <span><strong>{deviceName || (isBridgeOnline ? 'Ready to connect' : 'Bridge offline')}</strong><small>{deviceName ? 'Device connected' : (isBridgeOnline ? 'Pair your phone to get started' : 'Waiting for the local bridge')}</small></span>
        </button>
        <div className="settings-version"><span>Soko Desktop <span className="font-mono">v{version}</span></span>
          {onQuit && <button onClick={onQuit} title="Quit Soko" aria-label="Quit Soko"><Power size={16} /></button>}
        </div>
      </div>
    </aside>
  );
};
