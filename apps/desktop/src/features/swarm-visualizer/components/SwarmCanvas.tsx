import React, { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import {
  Workflow,
  Sparkles,
  CheckCircle2,
  Brain,
  Wrench,
  MessageSquare,
} from 'lucide-react';
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
  stats,
  selectedAgentId,
  onSelectAgent,
  viewAlignment = 'CENTER',
  filterQuery = '',
  isRunning = true,
  sessionId,
  workspaceName = 'workspace',
  model = 'gemini-3.8-flash-high',
  className = '',
  turns = [],
  activeTurnIndex,
  viewMode = 'live',
  onToggleClusterCollapse,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const orchestratorPinRef = useRef<HTMLDivElement>(null);
  const clusterPinsRef = useRef<Record<string, HTMLDivElement | null>>({});
  const pipelinePinRef = useRef<HTMLDivElement>(null);

  const [connectionLines, setConnectionLines] = useState<ConnectionLine[]>([]);
  const [collapsedClusters, setCollapsedClusters] = useState<Record<string, boolean>>({});
  const [svgDimensions, setSvgDimensions] = useState<{ width: number; height: number }>({
    width: 1200,
    height: 800,
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

  const totalAgentsCount =
    stats?.totalParallel ??
    clusters.reduce((acc, c) => acc + (c.agents?.length || 0), 0);

  const isSingleAgentPipeline = clusters.length === 0;

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

  const handleClusterPinMount = useCallback((clusterId: string, el: HTMLDivElement | null) => {
    clusterPinsRef.current[clusterId] = el;
    requestAnimationFrame(recalculateConnections);
  }, []);

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

    setSvgDimensions({
      width: scrollWidth,
      height: scrollHeight,
    });

    const orchPin = orchestratorPinRef.current;
    if (!orchPin) return;

    const orchRect = orchPin.getBoundingClientRect();
    const startX = orchRect.left + orchRect.width / 2 - containerRect.left + scrollLeft;
    const startY = orchRect.top + orchRect.height / 2 - containerRect.top + scrollTop;

    const lines: ConnectionLine[] = [];

    // If 0 clusters (Single-Agent Turn Execution Pipeline)
    if (isSingleAgentPipeline && pipelinePinRef.current) {
      const pinRect = pipelinePinRef.current.getBoundingClientRect();
      const endX = pinRect.left + pinRect.width / 2 - containerRect.left + scrollLeft;
      const endY = pinRect.top + pinRect.height / 2 - containerRect.top + scrollTop;

      const dx = Math.max(60, Math.abs(endX - startX) * 0.55);
      const pathD = `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`;

      lines.push({
        id: 'wire-single-agent-pipeline',
        clusterId: 'pipeline',
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

    setConnectionLines(lines);
  }, [clusters, isSingleAgentPipeline]);

  // Recalculate on mount, resize, cluster collapse, and state updates
  useLayoutEffect(() => {
    recalculateConnections();
    const timer = setTimeout(recalculateConnections, 100);
    return () => clearTimeout(timer);
  }, [recalculateConnections, collapsedClusters, clusters, isSingleAgentPipeline]);

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

  // Current turn for Single-Agent Turn Execution Pipeline
  const currentTurn = turns && turns.length > 0
    ? (activeTurnIndex !== undefined && activeTurnIndex >= 0 && activeTurnIndex < turns.length
        ? turns[activeTurnIndex]
        : turns[turns.length - 1])
    : null;

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
              strokeOpacity={isSingleAgentPipeline ? 0.7 : 0.85}
              strokeDasharray={isSingleAgentPipeline ? 'none' : isRunning ? 'none' : '4 4'}
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
      <div className="relative z-20 min-w-[760px] max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col md:flex-row items-start gap-8 lg:gap-14">
        {/* Left Column: Root Orchestrator */}
        <div className="w-full md:w-72 lg:w-80 shrink-0 pt-4 md:pt-16">
          <OrchestratorNode
            pinRef={orchestratorPinRef}
            sessionId={sessionId}
            workspaceName={workspaceName}
            model={model}
            activeCount={totalAgentsCount}
            totalParallel={totalAgentsCount}
            isRunning={isRunning}
            statusText={isSingleAgentPipeline ? 'Primary Agent' : 'Root Orchestrator'}
          />

          {/* Quick Swarm Graph Info Card */}
          <div className="mt-4 p-3 rounded-lg bg-white/[0.02] border border-white/5 text-[11px] font-mono text-slate-400 space-y-1.5 hidden md:block">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Topology:</span>
              <span className="text-slate-300">
                {isSingleAgentPipeline ? 'Single-Agent Pipeline' : 'Hierarchical DAG'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Dispatch Mode:</span>
              <span className="text-teal-400">
                {isSingleAgentPipeline ? 'Turn Execution Loop' : 'Non-blocking Async'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Execution Depth:</span>
              <span className="text-slate-300">
                {isSingleAgentPipeline ? `${turns.length} Turns` : `${totalAgentsCount} Subagents`}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Active Clusters or Single-Agent Turn Execution Pipeline */}
        <div className="flex-1 w-full space-y-5">
          {/* Real Active Clusters (N dynamic clusters) */}
          {!isSingleAgentPipeline &&
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

          {/* Single-Agent Turn Execution Pipeline when clusters.length === 0 */}
          {isSingleAgentPipeline && (
            <div
              className="relative rounded-xl bg-[#0E121B]/95 border border-cyan-500/30 p-5 sm:p-6 shadow-[0_4px_24px_rgba(0,0,0,0.4)] backdrop-blur-sm"
              data-cluster-id="single-agent-pipeline"
            >
              {/* Input Connection Pin */}
              <div
                ref={pipelinePinRef}
                id="cluster-pin-pipeline"
                data-pin="cluster-in-pipeline"
                className="absolute -left-2 top-8 -translate-y-1/2 flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[#0E121B] border-2 border-cyan-400 shadow-sm z-20 cursor-crosshair"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#06B6D4]" />
              </div>

              {/* Pipeline Header */}
              <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shrink-0">
                    <Workflow className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-white text-sm font-semibold tracking-tight font-sans">
                        Single-Agent Turn Execution Pipeline
                      </h3>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                        <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
                        {isRunning ? 'EXECUTING PIPELINE' : viewMode === 'history' ? 'ARCHIVED PIPELINE' : 'PIPELINE READY'}
                      </span>
                    </div>
                    <p className="text-slate-400 text-xs mt-0.5">
                      Autonomous sequential turn execution with chain-of-thought reasoning and tool invocations.
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0 hidden sm:block font-mono text-[11px] text-slate-400">
                  <span className="text-cyan-300 font-semibold">{turns.length}</span> turns total
                </div>
              </div>

              {/* Pipeline Stages Flow Diagram */}
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                {/* Stage 1: Ingestion */}
                <div className="p-3 rounded-lg bg-[#121624] border border-white/5 flex flex-col justify-between space-y-2">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[10px] font-mono uppercase tracking-wider">Stage 01</span>
                    <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-200">Context Assembly</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Prompt & History</div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Loaded</span>
                  </div>
                </div>

                {/* Stage 2: Reasoning */}
                <div className="p-3 rounded-lg bg-[#121624] border border-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.1)] flex flex-col justify-between space-y-2">
                  <div className="flex items-center justify-between text-cyan-400">
                    <span className="text-[10px] font-mono uppercase tracking-wider">Stage 02</span>
                    <Brain className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-cyan-200">Thinking & Plan</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Chain-of-Thought</div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-cyan-400">
                    {isRunning ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                        <span>Active CoT</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>Resolved</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Stage 3: Tool Execution */}
                <div className="p-3 rounded-lg bg-[#121624] border border-amber-500/20 flex flex-col justify-between space-y-2">
                  <div className="flex items-center justify-between text-amber-400">
                    <span className="text-[10px] font-mono uppercase tracking-wider">Stage 03</span>
                    <Wrench className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-amber-200">Tool Execution</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Bash, Edits, Search</div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
                    {currentTurn && currentTurn.toolCalls?.length > 0 ? (
                      <span className="text-amber-300 font-semibold">{currentTurn.toolCalls.length} tools dispatched</span>
                    ) : (
                      <span>Direct Response</span>
                    )}
                  </div>
                </div>

                {/* Stage 4: Synthesis */}
                <div className="p-3 rounded-lg bg-[#121624] border border-white/5 flex flex-col justify-between space-y-2">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[10px] font-mono uppercase tracking-wider">Stage 04</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-200">Turn Synthesis</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Response Output</div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Verified</span>
                  </div>
                </div>
              </div>

              {/* Current / Latest Turn Live Execution Details */}
              {currentTurn && (
                <div className="mt-4 p-3.5 rounded-lg bg-[#0A0D15] border border-white/[0.08] text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-cyan-300">
                        Turn #{currentTurn.stepIndex !== undefined ? currentTurn.stepIndex : (activeTurnIndex !== undefined ? activeTurnIndex + 1 : turns.length)}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {currentTurn.status.toUpperCase()}
                      </span>
                    </div>
                    {currentTurn.timestamp && (
                      <span className="text-[10px] font-mono text-slate-500">
                        {new Date(currentTurn.timestamp).toLocaleTimeString()}
                      </span>
                    )}
                  </div>

                  {currentTurn.userInput && (
                    <div className="text-slate-300 font-sans text-xs bg-slate-900/50 p-2 rounded border border-white/5 truncate">
                      <span className="text-slate-500 font-mono text-[10px] mr-1.5">USER:</span>
                      {currentTurn.userInput}
                    </div>
                  )}

                  {currentTurn.thinking && currentTurn.thinking.length > 0 && (
                    <div className="text-slate-400 font-mono text-[11px] bg-slate-900/30 p-2 rounded border-l-2 border-cyan-500 truncate">
                      <span className="text-cyan-400 font-semibold mr-1.5">CoT:</span>
                      {currentTurn.thinking[0]}
                    </div>
                  )}

                  {currentTurn.toolCalls && currentTurn.toolCalls.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <span className="text-[10px] font-mono text-slate-500">Tools:</span>
                      {currentTurn.toolCalls.map((t, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/15 text-indigo-300 border border-indigo-500/30"
                        >
                          {t.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Filter query with 0 matches */}
          {!isSingleAgentPipeline && filteredClusters.length === 0 && (
            <div className="text-center py-12 rounded-xl bg-white/[0.02] border border-dashed border-white/10 text-slate-400 font-mono text-xs">
              No agents or clusters matched your filter query: &quot;{filterQuery}&quot;
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
