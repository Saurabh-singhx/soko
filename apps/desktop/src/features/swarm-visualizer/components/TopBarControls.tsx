import React, { useEffect, useRef } from 'react';
import { Search, X, Play, Pause, Terminal, Radio, History } from 'lucide-react';
import type { SwarmStats, DiscoveredSessionSummary } from '../types';

export interface TopBarControlsProps {
  stats: SwarmStats;
  filterQuery: string;
  onFilterChange: (query: string) => void;
  isRunning: boolean;
  onToggleRunning: () => void;
  currentAlignment?: 'CENTER' | 'TOP' | 'BOTTOM';
  onAlignView?: (alignment: 'CENTER' | 'TOP' | 'BOTTOM') => void;
  showLogsModal?: boolean;
  onToggleLogsModal?: () => void;
  sessions?: DiscoveredSessionSummary[];
  activeSessionId?: string | null;
  onSelectSession?: (sessionId: string) => void;
  isConnected?: boolean;
  viewMode?: 'live' | 'history';
  hasBackgroundLiveAgent?: boolean;
  onSwitchToLive?: () => void;
  onToggleViewMode?: (mode: 'live' | 'history') => void;
}

export const TopBarControls: React.FC<TopBarControlsProps> = ({
  filterQuery, onFilterChange, isRunning, onToggleRunning, onToggleLogsModal,
  sessions = [], activeSessionId, onSelectSession, viewMode = 'live',
  hasBackgroundLiveAgent, onSwitchToLive, onToggleViewMode,
}) => {
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  return <header className="activity-toolbar">
    <div className="activity-toolbar-row">
      <div className="activity-mode-switch" role="group" aria-label="Activity view">
        <button type="button" aria-pressed={viewMode === 'live'} onClick={() => onSwitchToLive?.()}><Radio size={14} />Live overview
          {hasBackgroundLiveAgent && <i className="activity-live-dot" />}</button>
        <button type="button" aria-pressed={viewMode === 'history'} onClick={() => {
          if (onSelectSession && sessions[0]) onSelectSession(sessions[0].sessionId);
          else onToggleViewMode?.('history');
        }}><History size={14} />History</button>
      </div>
      <div className="activity-toolbar-actions">
        <button type="button" onClick={onToggleRunning} aria-label={isRunning ? 'Pause monitoring' : 'Resume monitoring'}>
          {isRunning ? <Pause size={14} /> : <Play size={14} />}<span>{isRunning ? 'Pause' : 'Resume'}</span></button>
        <button type="button" onClick={onToggleLogsModal} aria-label="Open activity event log" title="Activity event log"><Terminal size={16} /></button>
      </div>
    </div>
    <div className="activity-toolbar-row">
      <label className="activity-search"><Search size={15} /><input ref={searchRef} value={filterQuery}
        aria-label="Search agents" placeholder="Search tasks, projects, or agents…" onChange={e => onFilterChange(e.target.value)} />
        {filterQuery && <button type="button" aria-label="Clear agent search" onClick={() => onFilterChange('')}><X size={14} /></button>}
      </label>
      {viewMode === 'history' && <select className="activity-session-select" aria-label="Session history" value={activeSessionId || ''}
        onChange={e => onSelectSession?.(e.target.value)}>
        <option value="" disabled>Select a session</option>
        {sessions.map(s => <option key={s.sessionId} value={s.sessionId}>{s.agent || 'Agent'} · {s.workspaceName || 'Unknown project'} · {s.taskSummary || s.name} · {s.sessionId.slice(-8)}</option>)}
      </select>}
    </div>
  </header>;
};
