import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  Search,
  X,
  Play,
  Square,
  Terminal,
  Activity,
  AlertTriangle,
  Zap,
  Radio,
  ChevronDown,
  Layers,
  Archive,
  ArrowRight,
  Clock,
} from 'lucide-react';
import { SwarmStats, DiscoveredSessionSummary } from '../types';

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

function formatRelativeTime(mtimeMs?: number): string {
  if (!mtimeMs) return '';
  const diffSec = Math.floor((Date.now() - mtimeMs) / 1000);
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

function formatTokens(tokens?: number): string {
  if (!tokens || tokens === 0) return '0 tok';
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M tok`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k tok`;
  return `${tokens} tok`;
}

export const TopBarControls: React.FC<TopBarControlsProps> = ({
  stats,
  filterQuery,
  onFilterChange,
  isRunning,
  onToggleRunning,
  currentAlignment = 'CENTER',
  onAlignView,
  showLogsModal = false,
  onToggleLogsModal,
  sessions = [],
  activeSessionId,
  onSelectSession,
  isConnected = true,
  viewMode = 'live',
  hasBackgroundLiveAgent = false,
  onSwitchToLive,
  onToggleViewMode,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isSessionDropdownOpen, setIsSessionDropdownOpen] = useState(false);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsSessionDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Global Cmd+K / Ctrl+K keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Format token rate cleanly (e.g. 14.2k tok/s or 0 tok/s when idle)
  const formattedTokenRate = useMemo(() => {
    if (!stats || typeof stats.tokenRate !== 'number' || stats.tokenRate <= 0) return '0 tok/s';
    if (stats.tokenRate >= 1_000_000) {
      return `${(stats.tokenRate / 1_000_000).toFixed(1)}M tok/s`;
    }
    if (stats.tokenRate >= 1_000) {
      return `${(stats.tokenRate / 1_000).toFixed(1)}k tok/s`;
    }
    return `${stats.tokenRate.toFixed(0)} tok/s`;
  }, [stats?.tokenRate]);

  // Split sessions into Active vs Previous Conversations
  const { activeSessions, previousSessions } = useMemo(() => {
    const active: DiscoveredSessionSummary[] = [];
    const previous: DiscoveredSessionSummary[] = [];

    sessions.forEach((s) => {
      if (s.isLocked || s.status === 'working') {
        active.push(s);
      } else {
        previous.push(s);
      }
    });

    return { activeSessions: active, previousSessions: previous };
  }, [sessions]);

  // Current session object
  const currentSession = useMemo(() => {
    if (activeSessionId) {
      const found = sessions.find((s) => s.sessionId === activeSessionId);
      if (found) return found;
    }
    return sessions[0] || null;
  }, [sessions, activeSessionId]);

  return (
    <header className="w-full bg-[#0E121B] border-b border-white/[0.08] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs select-none relative z-20">
      {/* Left Section: Live Engine Toggle, Session Selector & Live/Archive Pills */}
      <div className="flex items-center flex-wrap gap-2.5">
        {/* Live Engine Start / Stop Control */}
        <button
          onClick={onToggleRunning}
          type="button"
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-all shadow-sm active:scale-[0.98] ${
            isRunning
              ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 shadow-[0_0_12px_rgba(244,63,94,0.2)]'
              : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
          }`}
          title={isRunning ? 'Stop live agent telemetry' : 'Start live agent monitor'}
        >
          <span className="relative flex h-2 w-2">
            {isRunning && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isRunning ? 'bg-emerald-400' : 'bg-zinc-500'
              }`}
            />
          </span>

          {isRunning ? (
            <>
              <Square size={12} className="fill-current" />
              <span>Stop Monitor</span>
            </>
          ) : (
            <>
              <Play size={12} className="fill-current" />
              <span>Start Live Monitor</span>
            </>
          )}
        </button>

        {/* Live vs Archive Button */}
        {viewMode === 'live' ? (
          <button
            type="button"
            onClick={() => onToggleViewMode ? onToggleViewMode('history') : undefined}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-sans font-medium bg-emerald-950/40 border-emerald-800/40 text-emerald-300 hover:bg-emerald-900/50 transition-colors cursor-pointer"
            title="Current mode: Live Telemetry. Click to toggle Historical Archive mode."
          >
            <Radio size={12} className={isConnected ? 'text-emerald-400 animate-pulse' : 'text-slate-500'} />
            <span>LIVE</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onSwitchToLive ? onSwitchToLive() : onToggleViewMode?.('live')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-sans font-medium bg-amber-950/30 border-amber-800/40 text-amber-300 hover:bg-amber-900/50 transition-colors cursor-pointer"
            title="Current mode: Historical Archive. Click to switch to Live Telemetry."
          >
            <Archive size={12} className="text-amber-400" />
            <span>ARCHIVE</span>
          </button>
        )}

        {/* Live Alert Pill: "Live agent active • Switch to Live" */}
        {hasBackgroundLiveAgent && viewMode === 'history' && (
          <button
            type="button"
            onClick={onSwitchToLive}
            className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-300 text-[11px] font-medium shadow-[0_0_12px_rgba(16,185,129,0.3)] animate-pulse transition-all cursor-pointer"
            title="Switch from historical session to active live session"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Live agent active • Switch to Live</span>
            <ArrowRight size={12} className="text-emerald-400" />
          </button>
        )}

        {/* Dynamic CLI Session Selector Dropdown */}
        <div ref={dropdownRef} className="relative">
          <button
            type="button"
            onClick={() => setIsSessionDropdownOpen(!isSessionDropdownOpen)}
            className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#141824] border border-white/[0.08] hover:border-slate-500 text-slate-200 text-[11px] font-mono transition-colors"
            title="Switch Session"
          >
            <Layers size={12} className="text-indigo-400" />
            <span className="max-w-[150px] truncate font-medium">
              {currentSession?.taskSummary || currentSession?.name || currentSession?.sessionId?.slice(0, 8) || 'Select Session'}
            </span>
            <ChevronDown size={12} className="text-slate-400" />
          </button>

          {isSessionDropdownOpen && (
            <div className="absolute left-0 top-full mt-1 w-80 bg-[#0D111A] border border-[#252F48] rounded-lg shadow-2xl p-1.5 z-50 text-xs max-h-96 overflow-y-auto custom-scrollbar">
              {/* Active Sessions Group */}
              {activeSessions.length > 0 && (
                <div className="mb-2">
                  <div className="px-2 py-1 text-[10px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Active Sessions ({activeSessions.length})</span>
                  </div>
                  {activeSessions.map((s) => {
                    const isSelected = s.sessionId === activeSessionId;
                    return (
                      <button
                        key={s.sessionId}
                        type="button"
                        onClick={() => {
                          onSelectSession?.(s.sessionId);
                          setIsSessionDropdownOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-2 rounded-md flex flex-col gap-1 transition-colors border mb-1 ${
                          isSelected
                            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                            : 'border-transparent text-slate-300 hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[11px] font-semibold text-white truncate max-w-[170px]">
                            {s.taskSummary || s.name || s.sessionId.slice(0, 12)}
                          </span>
                          <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded font-sans">
                            ACTIVE
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                          <span>{formatTokens(s.tokensUsed)}</span>
                          {s.subagentCount && s.subagentCount > 0 ? (
                            <span className="text-indigo-400">{s.subagentCount} subagents</span>
                          ) : (
                            <span className="text-slate-500">single agent</span>
                          )}
                          <span>{formatRelativeTime(s.mtimeMs)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Previous / Completed Conversations Group */}
              <div>
                <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock size={11} className="text-slate-500" />
                  <span>Previous Conversations ({previousSessions.length})</span>
                </div>
                {previousSessions.length === 0 && activeSessions.length === 0 && (
                  <div className="px-3 py-4 text-center text-slate-500 text-xs font-mono">
                    No sessions discovered yet.
                  </div>
                )}
                {previousSessions.map((s) => {
                  const isSelected = s.sessionId === activeSessionId;
                  return (
                    <button
                      key={s.sessionId}
                      type="button"
                      onClick={() => {
                        onSelectSession?.(s.sessionId);
                        setIsSessionDropdownOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-2 rounded-md flex flex-col gap-1 transition-colors border mb-1 ${
                        isSelected
                          ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                          : 'border-transparent text-slate-300 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[11px] font-medium text-slate-200 truncate max-w-[180px]">
                          {s.taskSummary || s.name || s.sessionId.slice(0, 12)}
                        </span>
                        {s.isSubagent ? (
                          <span className="text-[9px] bg-purple-900/40 text-purple-300 px-1 rounded font-sans">
                            Subagent
                          </span>
                        ) : (
                          <span className="text-[9px] bg-slate-800 text-slate-400 px-1 rounded font-sans">
                            Root
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span>{formatTokens(s.tokensUsed)}</span>
                        {s.subagentCount && s.subagentCount > 0 ? (
                          <span className="text-indigo-400">{s.subagentCount} subagents</span>
                        ) : (
                          <span className="text-slate-500">single agent</span>
                        )}
                        <span>{formatRelativeTime(s.mtimeMs)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* View Alignment Segmented Buttons */}
        <div className="hidden sm:flex items-center bg-[#141824] rounded-md p-0.5 border border-white/[0.06]">
          {(['CENTER', 'TOP', 'BOTTOM'] as const).map((alignment) => {
            const isActive = currentAlignment === alignment;
            return (
              <button
                key={alignment}
                type="button"
                onClick={() => onAlignView?.(alignment)}
                className={`px-2.5 py-1 text-[11px] font-mono font-medium rounded transition-colors ${
                  isActive
                    ? 'bg-white/[0.1] text-white shadow-hairline'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                }`}
                title={`Align canvas to ${alignment}`}
              >
                {alignment}
              </button>
            );
          })}
        </div>
      </div>

      {/* Middle Section: Dynamic Stat Chips */}
      <div className="flex items-center flex-wrap gap-2">
        {/* Chip 1: Total Parallel Sub-Agents */}
        <button
          type="button"
          onClick={() => onFilterChange('')}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#141824] hover:bg-[#1a2030] border border-white/[0.06] text-slate-300 transition-colors cursor-pointer"
          title="Click to reset filter and show all subagents"
        >
          <Activity size={13} className="text-[#2DD4BF]" />
          <span className="font-semibold text-white font-mono">
            {stats?.totalParallel ?? 0}
          </span>
          <span className="text-[11px] hidden md:inline">
            Sub-Agents Running in Parallel
          </span>
          <span className="text-[11px] md:hidden">Parallel</span>
        </button>

        {/* Chip 2: Awaiting Approval (Pulses if > 0) */}
        <button
          type="button"
          onClick={() => {
            if ((stats?.awaitingApproval ?? 0) > 0) {
              onFilterChange(filterQuery.toLowerCase() === 'awaiting' ? '' : 'awaiting');
            }
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
            (stats?.awaitingApproval ?? 0) > 0
              ? 'bg-amber-500/15 border border-amber-500/35 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.2)] animate-pulse hover:bg-amber-500/25'
              : 'bg-[#141824] border border-white/[0.06] text-slate-300 hover:bg-[#1a2030]'
          }`}
          title="Click to filter subagents awaiting approval"
        >
          <AlertTriangle
            size={13}
            className={
              (stats?.awaitingApproval ?? 0) > 0 ? 'text-amber-400' : 'text-slate-500'
            }
          />
          <span className="font-semibold font-mono text-white">
            {stats?.awaitingApproval ?? 0}
          </span>
          <span className="text-[11px]">Awaiting Approval</span>
        </button>

        {/* Chip 3: Dynamic Real Token Rate */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#141824] border border-white/[0.06] text-slate-300">
          <Zap size={13} className="text-[#56B6F7]" />
          <span className="font-mono font-semibold text-white">
            {formattedTokenRate}
          </span>
        </div>

        {/* Raw Terminal Logs Toggle Button (>_) */}
        <button
          type="button"
          onClick={onToggleLogsModal}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono text-[11px] transition-colors ${
            showLogsModal
              ? 'bg-[#5E6AD2] text-white shadow-hairline'
              : 'bg-[#141824] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/[0.06]'
          }`}
          title="Toggle Raw Terminal Stream (>_)"
        >
          <Terminal size={13} />
          <span className="font-bold tracking-tight">&gt;_</span>
        </button>
      </div>

      {/* Right Section: Search Filter Bar with Cmd+K */}
      <div className="flex items-center min-w-[200px] sm:w-64 max-w-xs relative">
        <Search
          size={13}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
        />
        <input
          ref={searchInputRef}
          type="text"
          value={filterQuery}
          onChange={(e) => onFilterChange(e.target.value)}
          placeholder="Filter agents (Cmd+K)..."
          className="w-full bg-[#141824] border border-white/[0.08] focus:border-[#2DD4BF]/50 focus:ring-1 focus:ring-[#2DD4BF]/30 rounded-md pl-8 pr-14 py-1 text-xs text-white placeholder-slate-500 focus:outline-none transition-all"
        />
        {filterQuery ? (
          <button
            type="button"
            onClick={() => onFilterChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded"
          >
            <X size={12} />
          </button>
        ) : (
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-mono px-1 py-0.5 rounded bg-white/[0.06] text-slate-500 pointer-events-none border border-white/[0.04]">
            ⌘K
          </kbd>
        )}
      </div>
    </header>
  );
};
