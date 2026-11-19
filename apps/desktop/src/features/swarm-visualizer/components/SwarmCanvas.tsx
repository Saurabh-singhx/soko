import React, { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { Activity, Bot, Network, Brain, Wrench, MessageSquare, Terminal, Sparkles } from 'lucide-react';
import type { AgentCluster, SwarmStats, TranscriptTurn } from '../types';
import { OrchestratorNode } from './OrchestratorNode';
import { AgentClusterGroup } from './AgentClusterGroup';

export interface SwarmCanvasProps {
  clusters: AgentCluster[];
  stats?: SwarmStats;
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string) => void;
  viewAlignment?: 'CENTER' | 'TOP' | 'BOTTOM';
  filterQuery?: string;
  isRunning?: boolean;
  sessionId?: string;
  workspaceName?: string;
  model?: string;
  agentName?: string;
  agentStatus?: string;
  agentDetail?: string;
  className?: string;
  turns?: TranscriptTurn[];
  activeTurnIndex?: number;
  viewMode?: 'live' | 'history';
  onToggleClusterCollapse?: (clusterId: string) => void;
}

interface ConnectionLine {
  id: string;
  clusterId: string;
  pathD: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export const SwarmCanvas: React.FC<SwarmCanvasProps> = ({
  clusters = [],
  selectedAgentId,
  onSelectAgent,
  viewAlignment = 'CENTER',
  filterQuery = '',
  isRunning = true,
  sessionId,
  workspaceName,
  model,
  agentName,
  agentStatus,
  agentDetail,
  className = '',
  turns = [],
  activeTurnIndex,
  viewMode = 'live',
  onToggleClusterCollapse,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const orchestratorPinRef = useRef<HTMLDivElement>(null);
  const clusterPinsRef = useRef<Record<string, HTMLDivElement | null>>({});
  const sessionPinRef = useRef<HTMLDivElement | null>(null);

  const [connectionLines, setConnectionLines] = useState<ConnectionLine[]>([]);
  const [collapsedClusters, setCollapsedClusters] = useState<Record<string, boolean>>({});
  const [svgDimensions, setSvgDimensions] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  // Filter agents by filterQuery if provided
  const query = (filterQuery || '').trim().toLowerCase();
  const filteredClusters: AgentCluster[] = clusters
    .map((cluster) => {
      if (!query) return cluster;
      const clusterMatches =
        cluster.name.toLowerCase().includes(query) ||
        cluster.id.toLowerCase().includes(query) ||
        (cluster.role && cluster.role.toLowerCase().includes(query)) ||
        (cluster.roleCategory && cluster.roleCategory.toLowerCase().includes(query));
      if (clusterMatches) return cluster;

      const matchingAgents = (cluster.agents || []).filter(
        (agent) =>
          agent.id.toLowerCase().includes(query) ||
          agent.name.toLowerCase().includes(query) ||
          agent.role.toLowerCase().includes(query) ||
          agent.status.toLowerCase().includes(query) ||
          (agent.taskSummary && agent.taskSummary.toLowerCase().includes(query)) ||
          (agent.task && agent.task.toLowerCase().includes(query))
      );
      return {
        ...cluster,
        agents: matchingAgents,
      };
    })
    .filter((c) => !query || c.agents.length > 0);

  const childSessionCount = clusters.reduce((acc, c) => acc + (c.agents?.length || 0), 0);

  const isSingleSessionView = clusters.length === 0;

  const toggleClusterCollapse = (clusterId: string) => {
    setCollapsedClusters((prev) => {
      const current = prev[clusterId] !== undefined
        ? prev[clusterId]
        : Boolean(clusters.find((c) => c.id === clusterId)?.isCollapsed);
      return {
        ...prev,
        [clusterId]: !current,
      };
    });
    onToggleClusterCollapse?.(clusterId);
  };

  /**
   * Dynamically measures pins and calculates SVG cubic bezier paths for any N clusters
   */
  const recalculateConnections = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const scrollLeft = container.scrollLeft;
    const scrollTop = container.scrollTop;

    // Update overall SVG canvas dimensions to span full scrollable content
    const scrollWidth = Math.max(container.scrollWidth, container.clientWidth);
    const scrollHeight = Math.max(container.scrollHeight, container.clientHeight);

    setSvgDimensions((current) =>
      current.width === scrollWidth && current.height === scrollHeight
        ? current
        : { width: scrollWidth, height: scrollHeight }
    );

    const orchPin = orchestratorPinRef.current;
    if (!orchPin) return;

    const orchRect = orchPin.getBoundingClientRect();
    const startX = orchRect.left + orchRect.width / 2 - containerRect.left + scrollLeft;
    const startY = orchRect.top + orchRect.height / 2 - containerRect.top + scrollTop;

    const lines: ConnectionLine[] = [];

    // Connect a single session view to its activity card.
    if (isSingleSessionView && sessionPinRef.current) {
      const pinRect = sessionPinRef.current.getBoundingClientRect();
      const endX = pinRect.left + pinRect.width / 2 - containerRect.left + scrollLeft;
      const endY = pinRect.top + pinRect.height / 2 - containerRect.top + scrollTop;

      const dx = Math.max(60, Math.abs(endX - startX) * 0.55);
      const pathD = `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`;

      lines.push({
        id: 'wire-single-session',
        clusterId: 'session',
        pathD,
        startX,
        startY,
        endX,
        endY,
      });
    } else {
      // Connect dynamically to any number of active clusters (1, 2, 4, 6, 8+)
      clusters.forEach((cluster) => {
        const pinEl = clusterPinsRef.current[cluster.id];
        if (!pinEl) return;

        const pinRect = pinEl.getBoundingClientRect();
        const endX = pinRect.left + pinRect.width / 2 - containerRect.left + scrollLeft;
        const endY = pinRect.top + pinRect.height / 2 - containerRect.top + scrollTop;

        const dx = Math.max(60, Math.abs(endX - startX) * 0.55);
        const pathD = `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`;

        lines.push({
          id: `wire-${cluster.id}`,
          clusterId: cluster.id,
          pathD,
          startX,
          startY,
          endX,
          endY,
        });
      });
    }

    setConnectionLines((current) => {
      const unchanged = current.length === lines.length && current.every((line, index) =>
        line.id === lines[index]?.id && line.pathD === lines[index]?.pathD
      );
      return unchanged ? current : lines;
    });
  }, [clusters, isSingleSessionView]);

  const handleClusterPinMount = useCallback((clusterId: string, el: HTMLDivElement | null) => {
    clusterPinsRef.current[clusterId] = el;
    requestAnimationFrame(recalculateConnections);
  }, [recalculateConnections]);

  const handleSessionPinMount = useCallback((el: HTMLDivElement | null) => {
    sessionPinRef.current = el;
    requestAnimationFrame(recalculateConnections);
  }, [recalculateConnections]);

  // Recalculate on mount, resize, cluster collapse, and state updates
  useLayoutEffect(() => {
    recalculateConnections();
    const timer = setTimeout(recalculateConnections, 100);
    return () => clearTimeout(timer);
  }, [recalculateConnections, collapsedClusters, clusters, isSingleSessionView]);

  useEffect(() => {
    const handleResize = () => {
      recalculateConnections();
    };

    window.addEventListener('resize', handleResize);
    const observer = new ResizeObserver(() => {
      recalculateConnections();
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, [recalculateConnections]);

  // Handle View Alignment: 'CENTER' | 'TOP' | 'BOTTOM'
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (viewAlignment === 'TOP') {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (viewAlignment === 'BOTTOM') {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    } else if (viewAlignment === 'CENTER') {
      const targetY = (container.scrollHeight - container.clientHeight) / 2;
      container.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
    }
  }, [viewAlignment]);

  const observedActionCount = turns.reduce((total, turn) => total + turn.toolCalls.length, 0);
  const recentTurns = turns.slice(-12);
  const maxTurnActions = Math.max(1, ...recentTurns.map((turn) => turn.toolCalls.length));
  const isAgentActive = ['working', 'active', 'thinking', 'waiting'].includes(agentStatus || '');
  const isAgentComplete = agentStatus === 'completed';

  const latestTurn =
    typeof activeTurnIndex === 'number' && turns[activeTurnIndex]
      ? turns[activeTurnIndex]
      : turns.length > 0
      ? turns[turns.length - 1]
      : null;

  const singleAgentRole =
    agentDetail && agentDetail.length > 0 && agentDetail.length < 50
      ? agentDetail
      : 'Primary Execution Agent';

  if (!sessionId && clusters.length === 0) {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-[#0A0D14] ${className}`}>
        <div className="max-w-md mx-5 rounded-2xl border border-white/10 bg-[#0E121B] px-8 py-10 text-center shadow-xl">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]">
            <Network className="h-5 w-5 text-slate-400" />
          </div>
          <h2 className="text-base font-semibold text-white">
            {isRunning ? 'No CLI agents are running' : 'Live monitoring is paused'}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            {isRunning
              ? 'Live session activity will appear here when a supported agent starts working.'
              : 'Resume live monitoring to discover agent sessions on this machine.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-auto bg-[#080B11] select-none text-slate-100 ${className}`}
      style={{
        backgroundImage: `
          radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.04) 1px, transparent 0),
          linear-gradient(to right, rgba(255, 255, 255, 0.015) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255, 255, 255, 0.015) 1px, transparent 1px)
        `,
        backgroundSize: '28px 28px, 112px 112px, 112px 112px',
      }}
    >
      {/* SVG Canvas Overlay for Connection Curves & Pulse Dots */}
      <svg
        className="absolute top-0 left-0 pointer-events-none z-10"
        width={svgDimensions.width}
        height={svgDimensions.height}
        style={{ minWidth: '100%', minHeight: '100%' }}
      >
        <defs>
          {/* Main wire gradient: Purple to Cyan/Teal */}
          <linearGradient id="swarmWireGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#A855F7" stopOpacity="0.9" />
            <stop offset="40%" stopColor="#6366F1" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#2DD4BF" stopOpacity="0.9" />
          </linearGradient>

          {/* Secondary glow filter */}
          <filter id="wireGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="particleGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {connectionLines.map((line, idx) => (
          <g key={line.id} className="transition-opacity duration-300">
            {/* Background blur stroke for neon aura */}
            <path
              d={line.pathD}
              fill="none"
              stroke="url(#swarmWireGradient)"
              strokeWidth="6"
              strokeOpacity="0.2"
              filter="url(#wireGlow)"
            />

            {/* Core crisp connection stroke */}
            <path
              d={line.pathD}
              fill="none"
              stroke="url(#swarmWireGradient)"
              strokeWidth="2"
              strokeOpacity={isSingleSessionView ? 0.85 : 0.85}
              strokeDasharray={isSingleSessionView ? 'none' : isRunning ? 'none' : '4 4'}
            />

            {/* Animated Pulse Data Packets along the wire */}
            {isRunning && (
              <>
                {/* Primary Teal packet */}
                <circle r="3.5" fill="#2DD4BF" filter="url(#particleGlow)">
                  <animateMotion
                    path={line.pathD}
                    dur={`${2.2 + idx * 0.35}s`}
                    repeatCount="indefinite"
                    keyPoints="0;1"
                    keyTimes="0;1"
                    calcMode="linear"
                  />
                </circle>

                {/* Secondary Purple packet with time offset */}
                <circle r="2.5" fill="#C084FC" filter="url(#particleGlow)">
                  <animateMotion
                    path={line.pathD}
                    dur={`${2.6 + idx * 0.3}s`}
                    begin={`${1.1 + idx * 0.2}s`}
                    repeatCount="indefinite"
                    keyPoints="0;1"
                    keyTimes="0;1"
                    calcMode="linear"
                  />
                </circle>
              </>
            )}
          </g>
        ))}
      </svg>

      {/* Main Graph Layout Content */}
      <div className="relative z-20 w-full min-w-0 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col xl:flex-row items-stretch xl:items-start gap-5 xl:gap-8 2xl:gap-14">
        {/* Left Column: Root Orchestrator */}
        <div className="w-full xl:w-72 2xl:w-80 min-w-0 shrink-0 pt-2 xl:pt-16">
          <OrchestratorNode
            pinRef={orchestratorPinRef}
            sessionId={sessionId}
            workspaceName={workspaceName}
            model={model}
            agentName={agentName}
            agentStatus={agentStatus}
            activeCount={childSessionCount}
            totalParallel={childSessionCount}
            isRunning={agentStatus === 'working' || agentStatus === 'active' || agentStatus === 'thinking' || agentStatus === 'waiting'}
            statusText={isSingleSessionView ? 'Agent session' : 'Parent session'}
          />

          {/* Quick Swarm Graph Info Card */}
          <div className="mt-4 p-3 rounded-lg bg-white/[0.02] border border-white/5 text-[11px] font-mono text-slate-400 space-y-1.5 hidden md:block">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Topology:</span>
              <span className="text-slate-300">{isSingleSessionView ? 'Single session' : 'Parent and child sessions'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Observed sessions:</span>
              <span className="text-slate-300">
                {childSessionCount + 1}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Active Clusters or selected session activity */}
        <div className="flex-1 w-full min-w-0 space-y-5">
          {/* Real Active Clusters (N dynamic clusters) */}
          {!isSingleSessionView &&
            filteredClusters.map((cluster) => (
              <AgentClusterGroup
                key={cluster.id}
                cluster={cluster}
                selectedAgentId={selectedAgentId}
                onSelectAgent={onSelectAgent}
                isCollapsed={collapsedClusters[cluster.id] !== undefined ? collapsedClusters[cluster.id] : cluster.isCollapsed}
                onToggleCollapse={toggleClusterCollapse}
                onPinMount={handleClusterPinMount}
              />
            ))}

          {/* A real root session with no discovered child sessions. */}
          {isSingleSessionView && (
            <div
              className={`relative overflow-hidden rounded-2xl border transition-all duration-300 ${
                isAgentActive
                  ? 'border-cyan-400/40 shadow-[0_0_30px_rgba(6,182,212,0.18)] bg-gradient-to-br from-[#111827] via-[#0E1524] to-[#101827]'
                  : isAgentComplete
                  ? 'border-emerald-500/30 shadow-[0_0_24px_rgba(16,185,129,0.12)] bg-gradient-to-br from-[#111827] via-[#0D1917] to-[#101827]'
                  : 'border-white/10 shadow-xl bg-gradient-to-br from-[#111827] via-[#0E121B] to-[#101827]'
              } p-5 sm:p-7`}
            >
              {/* SVG Input Connection Pin linking directly from Orchestrator */}
              <div
                ref={handleSessionPinMount}
                id="single-agent-pin"
                data-pin="session-in"
                className="absolute -left-2 top-8 -translate-y-1/2 flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[#0E121B] border-2 border-cyan-400 shadow-[0_0_8px_#06B6D4] z-20 cursor-crosshair transition-transform hover:scale-125"
                title="Agent Input Connection Pin"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#2DD4BF]" />
              </div>

              <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-cyan-500/[0.07] blur-3xl" />
              <div className="relative flex flex-col gap-6">
                {/* Agent Header */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-4">
                    <div
                      className={`relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border ${
                        isAgentComplete
                          ? 'border-emerald-400/30 bg-emerald-500/10'
                          : isAgentActive
                          ? 'border-cyan-300/30 bg-cyan-500/10'
                          : 'border-slate-500/30 bg-slate-500/10'
                      }`}
                    >
                      <Bot
                        className={`h-8 w-8 ${
                          isAgentComplete
                            ? 'text-emerald-300'
                            : isAgentActive
                            ? 'text-cyan-200'
                            : 'text-slate-300'
                        }`}
                      />
                      <span
                        className={`absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-[#111827] ${
                          isAgentComplete
                            ? 'bg-emerald-400'
                            : isAgentActive
                            ? 'bg-cyan-300 animate-pulse'
                            : 'bg-slate-500'
                        }`}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">
                          {viewMode === 'live' ? 'Live Agent' : 'Agent Session'}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                          <Sparkles className="w-2.5 h-2.5 text-cyan-300" />
                          <span>{singleAgentRole}</span>
                        </span>
                      </div>
                      <h3 className="mt-1 truncate text-lg font-semibold text-white">
                        {agentName || workspaceName || 'Agent session'}
                      </h3>
                      <div className="mt-1 flex items-center gap-2 text-xs capitalize text-slate-400">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            isAgentComplete
                              ? 'bg-emerald-400'
                              : isAgentActive
                              ? 'bg-cyan-300'
                              : 'bg-slate-500'
                          }`}
                        />
                        {agentStatus || 'Status unavailable'}
                      </div>
                    </div>
                  </div>
                  <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                    {viewMode === 'live' ? 'Live telemetry' : 'Session history'}
                  </div>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-white/[0.07] bg-black/15 p-3">
                    <div className="text-[9px] uppercase tracking-wider text-slate-500">Observed turns</div>
                    <div className="mt-1.5 font-mono text-xl text-white">{turns.length}</div>
                  </div>
                  <div className="rounded-xl border border-white/[0.07] bg-black/15 p-3">
                    <div className="text-[9px] uppercase tracking-wider text-slate-500">Observed actions</div>
                    <div className="mt-1.5 font-mono text-xl text-white">{observedActionCount}</div>
                  </div>
                  <div className="col-span-2 rounded-xl border border-white/[0.07] bg-black/15 p-3 sm:col-span-1">
                    <div className="text-[9px] uppercase tracking-wider text-slate-500">Subagent Topology</div>
                    <div className="mt-1.5 flex items-center gap-2 font-mono text-sm text-cyan-300">
                      <Network className="h-4 w-4 text-cyan-400 shrink-0" />
                      <span>Direct (1 Working Agent)</span>
                    </div>
                  </div>
                </div>

                {/* Current Instruction / Active Task */}
                {(latestTurn?.userInput || agentDetail) && (
                  <div className="rounded-xl border border-white/[0.08] bg-black/25 p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs font-medium text-slate-300">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-3.5 w-3.5 text-cyan-300" />
                        <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
                          Active Task / Instruction
                        </span>
                      </div>
                      {latestTurn && (
                        <span className="text-[10px] font-mono text-slate-500">Turn {latestTurn.stepIndex + 1}</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-200 line-clamp-3 leading-relaxed whitespace-pre-wrap font-sans">
                      {latestTurn?.userInput || agentDetail}
                    </p>
                  </div>
                )}

                {/* Real-time Chain-of-Thought / Active Reasoning */}
                {latestTurn?.thinking && latestTurn.thinking.length > 0 && (
                  <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs font-medium text-indigo-300">
                      <div className="flex items-center gap-2">
                        <Brain className="h-3.5 w-3.5 text-indigo-400" />
                        <span className="font-mono text-[11px] uppercase tracking-wider">Active Reasoning / CoT</span>
                      </div>
                      {isAgentActive && (
                        <span className="flex items-center gap-1.5 text-[10px] font-mono text-cyan-400 animate-pulse">
                          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                          Thinking in progress
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-300 line-clamp-4 leading-relaxed font-mono bg-black/30 p-2.5 rounded-lg border border-white/5">
                      {latestTurn.thinking[latestTurn.thinking.length - 1]}
                    </div>
                  </div>
                )}

                {/* Active Tool Executions */}
                {latestTurn?.toolCalls && latestTurn.toolCalls.length > 0 && (
                  <div className="rounded-xl border border-white/[0.07] bg-black/15 p-4 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-medium text-slate-300">
                      <div className="flex items-center gap-2">
                        <Wrench className="h-3.5 w-3.5 text-teal-400" />
                        <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
                          Observed Tool Calls ({latestTurn.toolCalls.length})
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {latestTurn.toolCalls.map((tc, idx) => (
                        <div
                          key={`${tc.name}-${idx}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/10 text-xs text-slate-300 font-mono"
                          title={tc.summary || JSON.stringify(tc.args)}
                        >
                          <Terminal className="w-3 h-3 text-teal-400" />
                          <span className="font-semibold text-teal-300">{tc.name}</span>
                          {tc.summary && (
                            <span className="text-[11px] text-slate-400 max-w-[200px] truncate">
                              ({tc.summary})
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Activity by Turn Chart */}
                <div className="rounded-xl border border-white/[0.07] bg-black/15 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
                      <Activity className="h-3.5 w-3.5 text-cyan-300" />Activity by turn
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">Action events</span>
                  </div>
                  {recentTurns.length > 0 ? (
                    <div className="mt-5 flex h-24 items-end gap-1.5 sm:gap-2">
                      {recentTurns.map((turn) => {
                        const actionCount = turn.toolCalls.length;
                        const height = actionCount === 0 ? 8 : 12 + (actionCount / maxTurnActions) * 56;
                        return (
                          <div
                            key={turn.id || turn.stepIndex}
                            className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
                            title={`Turn ${turn.stepIndex + 1}: ${actionCount} observed actions`}
                          >
                            <div className="flex w-full flex-1 items-end justify-center rounded-t bg-white/[0.025]">
                              <div
                                className={`w-full max-w-8 rounded-t-sm transition-[height] ${
                                  actionCount > 0
                                    ? 'bg-gradient-to-t from-indigo-500/70 to-cyan-300/80'
                                    : 'bg-slate-700/70'
                                }`}
                                style={{ height: `${height}px` }}
                              />
                            </div>
                            <span className="text-[9px] font-mono text-slate-500">{turn.stepIndex + 1}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-4 flex h-20 items-center justify-center rounded-lg border border-dashed border-white/[0.08] text-xs text-slate-500">
                      <Activity className="mr-2 h-4 w-4 text-slate-600" />No turn activity recorded
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Filter query with 0 matches */}
          {!isSingleSessionView && filteredClusters.length === 0 && (
            <div className="text-center py-12 rounded-xl bg-white/[0.02] border border-dashed border-white/10 text-slate-400 font-mono text-xs">
              No agents or clusters matched your filter query: &quot;{filterQuery}&quot;
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
