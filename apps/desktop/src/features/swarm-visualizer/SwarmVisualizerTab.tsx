import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Copy,
  Check,
  Trash2,
  Terminal,
  Bot,
  Play,
} from 'lucide-react';
import { SwarmState, SwarmAgent } from './types';
import { swarmDataEngine } from './services/swarmDataEngine';
import { TopBarControls } from './components/TopBarControls';
import { SwarmCanvas } from './components/SwarmCanvas';
import { InspectorPanel } from './components/InspectorPanel';
import { TraceWaterfall } from './components/TraceWaterfall';

export interface SwarmVisualizerTabProps {
  className?: string;
}

/**
 * SwarmVisualizerTab Component
 *
 * Primary coordinator view for the Soko Multi-Agent Swarm Visualizer.
 * Coordinates real-time agent telemetry, visual graph canvas, right-hand
 * inspector drawer, trace waterfall timeline, and live execution engine.
 *
 * CRITICAL LIFECYCLE BEHAVIOR:
 * - Starts telemetry ONLY when this component mounts (i.e. user explicitly opens Swarm tab).
 * - Zero background processing, zero intervals, and zero CPU usage before opening.
 * - On unmount (or explicit stop), all timers and listeners are cleanly torn down.
 */
export const SwarmVisualizerTab: React.FC<SwarmVisualizerTabProps> = ({
  className = '',
}) => {
  // Swarm Engine telemetry state
  const [state, setState] = useState<SwarmState>(() => swarmDataEngine.getState());
  const [filterQuery, setFilterQuery] = useState('');
  const [isWaterfallCollapsed, setIsWaterfallCollapsed] = useState(false);
  const [showTerminalLogs, setShowTerminalLogs] = useState(false);
  const [isMobileInspectorOpen, setIsMobileInspectorOpen] = useState(false);
  const [copiedLogs, setCopiedLogs] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs when open and new logs arrive
  useEffect(() => {
    if (showTerminalLogs) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [state.terminalLogs, showTerminalLogs]);

  // CRITICAL LIFECYCLE HOOK:
  // Starts live engine ONLY upon user mounting this tab.
  // Cleanly stops all intervals and listeners when unmounting or navigating away.
  useEffect(() => {
    // Start engine on mount
    swarmDataEngine.start();
    setState(swarmDataEngine.getState());

    // Subscribe to state updates
    const unsubscribe = swarmDataEngine.subscribe((nextState) => {
      setState(nextState);
    });

    // Clean teardown on unmount
    return () => {
      swarmDataEngine.stop();
      unsubscribe();
    };
  }, []);

  // Handle agent selection
  const handleSelectAgent = (agentId: string) => {
    swarmDataEngine.selectAgent(agentId);
    setIsMobileInspectorOpen(true);
  };

  // Close inspector
  const handleCloseInspector = () => {
    setIsMobileInspectorOpen(false);
    swarmDataEngine.selectAgent(null);
  };

  // Filter change handler
  const handleFilterChange = (query: string) => {
    setFilterQuery(query);
    swarmDataEngine.setFilterQuery(query);
  };

  // Flattened list of all agents across clusters for inspector selector
  const allAgents = useMemo<SwarmAgent[]>(() => {
    return state.clusters.flatMap((cluster) => cluster.agents);
  }, [state.clusters]);

  // Active agent: selected agent or null for clean empty state
  const activeAgent = useMemo<SwarmAgent | null>(() => {
    if (state.selectedAgent) return state.selectedAgent;
    return null;
  }, [state.selectedAgent]);

  // Copy raw terminal logs to clipboard
  const handleCopyLogs = () => {
    const raw = state.terminalLogs
      .map((l) => `[${new Date(l.timestamp).toISOString()}] [${l.level.toUpperCase()}] ${l.agentId ? `(${l.agentId}) ` : ''}${l.message}`)
      .join('\n');
    navigator.clipboard?.writeText(raw)?.catch?.(() => {});
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  return (
    <div
      className={`w-full h-full flex flex-col bg-[#08090A] text-slate-100 select-none overflow-hidden relative ${className}`}
    >
      {/* Top Bar Controls & Telemetry Stats */}
      <TopBarControls
        stats={state.stats}
        filterQuery={filterQuery}
        onFilterChange={handleFilterChange}
        isRunning={state.isRunning}
        onToggleRunning={() => {
          if (state.isRunning) {
            swarmDataEngine.stop();
          } else {
            swarmDataEngine.start();
          }
        }}
        currentAlignment={state.viewAlignment}
        onAlignView={(align) => swarmDataEngine.setViewAlignment(align)}
        showLogsModal={showTerminalLogs}
        onToggleLogsModal={() => setShowTerminalLogs((prev) => !prev)}
        sessions={state.availableSessions}
        activeSessionId={state.selectedSessionId || state.activeSession?.sessionId || null}
        onSelectSession={(sessionId) => swarmDataEngine.loadSession(sessionId)}
        viewMode={state.viewMode}
        hasBackgroundLiveAgent={state.hasBackgroundLiveAgent}
        onSwitchToLive={() => swarmDataEngine.setViewMode('live')}
        onToggleViewMode={(mode) => swarmDataEngine.setViewMode(mode)}
      />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
        {/* Workspace Upper Region: Canvas & Inspector */}
        <div className="flex-1 flex min-h-0 relative overflow-hidden">
          {/* Central Multi-Agent Graph Canvas */}
          <div className="flex-1 min-w-0 h-full relative overflow-hidden bg-[#0A0D14]">
            <SwarmCanvas
              clusters={state.clusters}
              stats={state.stats}
              selectedAgentId={activeAgent?.id || null}
              onSelectAgent={handleSelectAgent}
              viewAlignment={state.viewAlignment}
              filterQuery={filterQuery}
              isRunning={state.isRunning}
              sessionId={state.selectedSessionId || state.activeSession?.sessionId || undefined}
              workspaceName={state.activeSession?.workspaceName}
              model={state.activeSession?.model}
              agentName={state.activeSession?.name}
              agentStatus={state.activeSession?.status}
              agentDetail={state.activeSession?.detail || state.activeSession?.taskSummary}
              turns={state.turns || []}
              activeTurnIndex={state.activeTurnIndex}
              viewMode={state.viewMode}
              onToggleClusterCollapse={(clusterId) => swarmDataEngine.toggleClusterCollapse(clusterId)}
              className="w-full h-full"
            />

            {/* Mobile / Compact Inspector Toggle Floating Button */}
            <div className="xl:hidden absolute bottom-4 right-4 z-20">
              <button
                type="button"
                onClick={() => {
                  if (isMobileInspectorOpen) {
                    setIsMobileInspectorOpen(false);
                  } else {
                    if (!activeAgent && allAgents[0]) {
                      swarmDataEngine.selectAgent(allAgents[0].id);
                    }
                    setIsMobileInspectorOpen(true);
                  }
                }}
                disabled={allAgents.length === 0}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#5E6AD2] hover:bg-[#6875E8] text-white shadow-lg text-xs font-medium transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                title={allAgents.length === 0 ? 'No agents are available to inspect' : 'Open the agent inspector'}
              >
                <Bot size={14} />
                <span>{isMobileInspectorOpen ? 'Hide Inspector' : 'Show Inspector'}</span>
              </button>
            </div>

            {/* Live Paused Overlay Banner if user explicitly paused live monitoring */}
            {!state.isRunning && state.viewMode === 'live' && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 px-3.5 py-1.5 rounded-full bg-[#121417]/90 border border-white/10 shadow-lg backdrop-blur-md flex items-center gap-2.5 text-xs text-slate-300 animate-fadeIn">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>Live monitor paused</span>
                <button
                  type="button"
                  onClick={() => swarmDataEngine.start()}
                  className="ml-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
                >
                  <Play size={10} className="fill-current" />
                  Resume
                </button>
              </div>
            )}
          </div>

          {/* Desktop Right Inspector Panel (docked on screens >= lg) */}
          <div className="hidden xl:block w-80 2xl:w-96 shrink-0 min-w-0 h-full border-l border-white/[0.08] bg-[#0E121B] overflow-y-auto">
            <InspectorPanel
              agent={activeAgent}
              allAgents={allAgents}
              onSelectAgent={handleSelectAgent}
              onClose={handleCloseInspector}
              onApprove={(agentId, actionId) => swarmDataEngine.approveAction(agentId, actionId)}
              onReject={(agentId, actionId) => swarmDataEngine.rejectAction(agentId, actionId)}
              onRetry={(agentId) => swarmDataEngine.retryAgent(agentId)}
              onSendPrompt={(agentId, prompt) => swarmDataEngine.sendPrompt(agentId, prompt)}
              viewMode={state.viewMode}
              className="h-full border-none"
            />
          </div>

          {/* Compact Slide-Over Inspector Drawer (screens < xl) */}
          {isMobileInspectorOpen && (
            <div className="xl:hidden fixed inset-0 z-40 flex justify-end">
              {/* Backdrop */}
              <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={handleCloseInspector}
              />
              {/* Drawer Container */}
              <div className="relative w-full max-w-md h-full bg-[#0E121B] shadow-2xl z-50 flex flex-col border-l border-white/10">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#141824]">
                  <div className="flex items-center gap-2 text-xs font-semibold text-white">
                    <Bot size={15} className="text-[#2DD4BF]" />
                    <span>Agent Inspector</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseInspector}
                    className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/5"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <InspectorPanel
                    agent={activeAgent}
                    allAgents={allAgents}
                    onSelectAgent={handleSelectAgent}
                    onClose={handleCloseInspector}
                    onApprove={(agentId, actionId) => swarmDataEngine.approveAction(agentId, actionId)}
                    onReject={(agentId, actionId) => swarmDataEngine.rejectAction(agentId, actionId)}
                    onRetry={(agentId) => swarmDataEngine.retryAgent(agentId)}
                    onSendPrompt={(agentId, prompt) => swarmDataEngine.sendPrompt(agentId, prompt)}
                    viewMode={state.viewMode}
                    className="h-full border-none"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Workspace Bottom Region: Trace Waterfall Timeline */}
        <div className="shrink-0 border-t border-white/[0.08] bg-[#0E121B] z-10">
          <TraceWaterfall
            cursorMs={state.timeTravelCursorMs}
            maxTimeMs={state.maxTimeMs}
            onTimeTravelChange={(ms) => swarmDataEngine.setTimeTravelCursor(ms)}
            isSynchronized={state.isSynchronizedWithArize}
            onToggleSync={() => swarmDataEngine.toggleArizeSync()}
            spans={activeAgent?.traceSpans || []}
            turns={state.turns || []}
            isCollapsed={isWaterfallCollapsed}
            onToggleCollapse={() => setIsWaterfallCollapsed((prev) => !prev)}
            className="w-full"
          />
        </div>
      </div>

      {/* Raw Terminal Logs Viewer Modal / Drawer */}
      {showTerminalLogs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-4xl h-[70vh] bg-[#0C0D12] border border-white/15 rounded-xl shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-4 py-3 bg-[#12151F] border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Terminal size={15} className="text-[#5E6AD2]" />
                <span className="text-xs font-mono font-semibold text-white tracking-wide">
                  Raw Swarm Event Stream (&gt;_)
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-400">
                  {state.terminalLogs.length} events
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyLogs}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-xs text-slate-300 hover:text-white transition-colors"
                  title="Copy logs to clipboard"
                >
                  {copiedLogs ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  <span>{copiedLogs ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => swarmDataEngine.clearTerminalLogs()}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/5 hover:bg-rose-500/10 text-xs text-slate-300 hover:text-rose-400 transition-colors"
                  title="Clear event logs"
                >
                  <Trash2 size={12} />
                  <span>Clear</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowTerminalLogs(false)}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/5 transition-colors ml-1"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Logs Body */}
            <div className="flex-1 p-4 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-1.5 bg-[#08090E]">
              {state.terminalLogs.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  No log entries recorded yet.
                </div>
              ) : (
                state.terminalLogs.map((log) => {
                  const levelColors = {
                    info: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
                    warn: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
                    error: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
                    success: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
                  }[log.level] || 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20';

                  const timeStr = new Date(log.timestamp).toLocaleTimeString();

                  return (
                    <div
                      key={log.id}
                      className="flex items-start gap-2.5 py-1 px-2 rounded hover:bg-white/[0.02] border-b border-white/[0.02]"
                    >
                      <span className="text-zinc-600 shrink-0">{timeStr}</span>
                      <span
                        className={`text-[9px] font-semibold px-1.5 py-0.2 rounded border uppercase shrink-0 ${levelColors}`}
                      >
                        {log.level}
                      </span>
                      {log.agentId && (
                        <span className="text-[#2DD4BF] font-semibold shrink-0">
                          [{log.agentId}]
                        </span>
                      )}
                      <span className="text-zinc-300 break-all">{log.message}</span>
                    </div>
                  );
                })
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
