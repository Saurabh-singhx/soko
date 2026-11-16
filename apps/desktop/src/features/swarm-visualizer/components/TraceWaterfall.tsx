import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Play,
  Pause,
  ArrowLeftRight,
  ExternalLink,
  Maximize2,
  Minimize2,
  Check,
  Terminal,
  FileCode,
  Globe,
  Cpu,
  Activity,
} from 'lucide-react';
import { TraceSpan, SwarmTraceLane, TranscriptTurn } from '../types';

export interface TraceWaterfallProps {
  cursorMs?: number;
  maxTimeMs?: number;
  onTimeTravelChange?: (cursorMs: number) => void;
  isSynchronized?: boolean;
  onToggleSync?: () => void;
  spans?: TraceSpan[];
  turns?: TranscriptTurn[];
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  className?: string;
}

interface SpanItem {
  id: string;
  lane: SwarmTraceLane;
  label: string;
  startPct: number;
  widthPct: number;
  durationMs: number;
  status: 'running' | 'success' | 'failed';
  color: 'emerald' | 'sky' | 'amber' | 'purple';
}

function formatTime(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatDuration(ms: number) {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

/**
 * Generate spans dynamically from session turns if spans are not directly provided
 */
function generateSpansFromTurns(turns: TranscriptTurn[], maxTimeMs: number): SpanItem[] {
  if (!turns || turns.length === 0) return [];

  const items: SpanItem[] = [];
  const totalTurns = turns.length;
  const turnWindow = 100 / Math.max(1, totalTurns);

  turns.forEach((turn, idx) => {
    const turnBasePct = idx * turnWindow;

    // 1. LLM Inference Span
    const llmDuration = turn.thinking && turn.thinking.length > 0 ? 3200 : 1800;
    const llmWidth = Math.min(turnWindow * 0.45, (llmDuration / maxTimeMs) * 100);
    items.push({
      id: `turn-${turn.stepIndex || idx}-llm`,
      lane: 'llm',
      label: `LLM Turn ${turn.stepIndex || idx + 1}: ${turn.userInput ? turn.userInput.slice(0, 24) + '...' : 'Inference'}`,
      startPct: Math.max(1, turnBasePct),
      widthPct: Math.max(3, llmWidth),
      durationMs: llmDuration,
      status: turn.status === 'running' ? 'running' : turn.status === 'failed' ? 'failed' : 'success',
      color: 'emerald',
    });

    // 2. Tool execution spans
    const toolCalls = turn.toolCalls || [];
    if (toolCalls.length > 0) {
      const toolSlice = (turnWindow * 0.5) / toolCalls.length;
      toolCalls.forEach((tool, tIdx) => {
        const toolStart = turnBasePct + turnWindow * 0.45 + tIdx * toolSlice;
        const name = tool.name || 'tool_call';
        let lane: SwarmTraceLane = 'tool_blue';
        let color: 'sky' | 'amber' | 'purple' = 'sky';

        if (name.includes('edit') || name.includes('write') || name.includes('patch')) {
          lane = 'tool_orange';
          color = 'amber';
        } else if (name.includes('read') || name.includes('search') || name.includes('web')) {
          lane = 'tool_purple';
          color = 'purple';
        } else {
          lane = 'tool_blue';
          color = 'sky';
        }

        const durationMs = 800 + (tIdx + 1) * 600;
        const widthPct = Math.max(2.5, Math.min(toolSlice * 0.9, (durationMs / maxTimeMs) * 100));

        items.push({
          id: `turn-${turn.stepIndex || idx}-tool-${tIdx}`,
          lane,
          label: `${name}${tool.summary ? ` (${tool.summary.slice(0, 20)})` : ''}`,
          startPct: Math.min(96, Math.max(1, toolStart)),
          widthPct,
          durationMs,
          status: 'success',
          color,
        });
      });
    }
  });

  return items;
}

export const TraceWaterfall: React.FC<TraceWaterfallProps> = ({
  cursorMs = 0,
  maxTimeMs = 60000,
  onTimeTravelChange,
  isSynchronized = true,
  onToggleSync,
  spans,
  turns,
  isCollapsed = false,
  onToggleCollapse,
  className = '',
}) => {
  const [collapsed, setCollapsed] = useState(isCollapsed);
  const [isPlaying, setIsPlaying] = useState(false);
  const [localCursorMs, setLocalCursorMs] = useState(cursorMs);
  const [isArizeDropdownOpen, setIsArizeDropdownOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [hoveredSpan, setHoveredSpan] = useState<SpanItem | null>(null);
  const [expandedLanes, setExpandedLanes] = useState<Record<string, boolean>>({
    llm: true,
    tool_blue: true,
    tool_orange: true,
    tool_purple: true,
  });

  const timelineRef = useRef<HTMLDivElement>(null);
  const arizeDropdownRef = useRef<HTMLDivElement>(null);
  const playTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Close Arize Phoenix dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (arizeDropdownRef.current && !arizeDropdownRef.current.contains(e.target as Node)) {
        setIsArizeDropdownOpen(false);
      }
    };
    if (isArizeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isArizeDropdownOpen]);

  // Sync with prop updates
  useEffect(() => {
    setLocalCursorMs(cursorMs);
  }, [cursorMs]);

  useEffect(() => {
    setCollapsed(isCollapsed);
  }, [isCollapsed]);

  // Handle Play/Pause Auto-playback
  useEffect(() => {
    if (isPlaying) {
      playTimerRef.current = setInterval(() => {
        setLocalCursorMs((prev) => {
          const next = prev + 500;
          if (next >= maxTimeMs) {
            setIsPlaying(false);
            return maxTimeMs;
          }
          if (onTimeTravelChange) onTimeTravelChange(next);
          return next;
        });
      }, 100);
    } else {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    }
    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    };
  }, [isPlaying, maxTimeMs, onTimeTravelChange]);

  const effectiveMaxMs = Math.max(1000, maxTimeMs);
  const cursorPercent = Math.min(100, Math.max(0, (localCursorMs / effectiveMaxMs) * 100));

  const handleScrubChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setLocalCursorMs(val);
    if (onTimeTravelChange) onTimeTravelChange(val);
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.min(1, Math.max(0, clickX / rect.width));
    const newMs = Math.round(pct * effectiveMaxMs);
    setLocalCursorMs(newMs);
    if (onTimeTravelChange) onTimeTravelChange(newMs);
  };

  const toggleLane = (laneId: string) => {
    setExpandedLanes((prev) => ({ ...prev, [laneId]: !prev[laneId] }));
  };

  // Convert spans or synthesize from turns
  const activeSpans: SpanItem[] = useMemo(() => {
    if (spans && spans.length > 0) {
      return spans.map((s) => ({
        id: s.id,
        lane: s.lane,
        label: s.name,
        startPct: s.startTimePercent,
        widthPct: s.widthPercent,
        durationMs: s.durationMs || 1000,
        status: s.status || 'success',
        color:
          s.lane === 'llm'
            ? ('emerald' as const)
            : s.lane === 'tool_blue'
            ? ('sky' as const)
            : s.lane === 'tool_orange'
            ? ('amber' as const)
            : ('purple' as const),
      }));
    }

    if (turns && turns.length > 0) {
      return generateSpansFromTurns(turns, effectiveMaxMs);
    }

    return [];
  }, [spans, turns, effectiveMaxMs]);

  // Dynamic time ticks based on effectiveMaxMs
  const timeTicks = useMemo(() => {
    const tickCount = 8;
    const step = effectiveMaxMs / tickCount;
    return Array.from({ length: tickCount + 1 }, (_, i) => {
      const ms = Math.round(i * step);
      return formatTime(ms);
    });
  }, [effectiveMaxMs]);

  const lanesMeta: Array<{
    id: SwarmTraceLane;
    label: string;
    dotColor: string;
    pillClass: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'llm',
      label: 'LLM Call',
      dotColor: 'bg-emerald-400',
      pillClass: 'border-emerald-400 bg-emerald-500/20 text-emerald-300',
      icon: <Cpu className="w-3 h-3 text-emerald-400" />,
    },
    {
      id: 'tool_blue',
      label: 'Command Execution',
      dotColor: 'bg-sky-400',
      pillClass: 'border-sky-400 bg-sky-500/20 text-sky-300',
      icon: <Terminal className="w-3 h-3 text-sky-400" />,
    },
    {
      id: 'tool_orange',
      label: 'File Mutations',
      dotColor: 'bg-amber-400',
      pillClass: 'border-amber-400 bg-amber-500/20 text-amber-300',
      icon: <FileCode className="w-3 h-3 text-amber-400" />,
    },
    {
      id: 'tool_purple',
      label: 'File & Web Inspection',
      dotColor: 'bg-purple-400',
      pillClass: 'border-purple-400 bg-purple-500/20 text-purple-300',
      icon: <Globe className="w-3 h-3 text-purple-400" />,
    },
  ];

  return (
    <section
      className={`w-full flex flex-col bg-[#0B0F19]/95 backdrop-blur-md border-t border-[#1A2234] text-slate-200 select-none transition-all duration-300 z-20 ${
        isMaximized ? 'h-[480px]' : collapsed ? 'h-10' : 'h-[260px]'
      } ${className}`}
    >
      {/* Top Header Row */}
      <div className="flex items-center justify-between px-4 h-10 border-b border-[#1A2234] bg-[#0E1322]/80 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (onToggleCollapse) onToggleCollapse();
              setCollapsed(!collapsed);
            }}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-200 hover:text-white transition-colors focus:outline-none"
          >
            {collapsed ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
            <span className="font-semibold text-slate-100">Trace waterfall</span>
            <span className="text-[10px] font-mono text-slate-400 px-1.5 py-0.2 rounded bg-white/5 border border-white/5">
              {activeSpans.length} spans
            </span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Synchronized status badge */}
          {/* Synchronized status button */}
          <button
            type="button"
            onClick={onToggleSync}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors focus:outline-none cursor-pointer"
            title={isSynchronized ? 'Telemetry synchronized. Click to toggle.' : 'Telemetry desynchronized. Click to synchronize.'}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isSynchronized ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'bg-slate-600'
              }`}
            />
            <span>Synchronized</span>
          </button>

          {/* Arize Phoenix Badge / Toggle */}
          <div ref={arizeDropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setIsArizeDropdownOpen(!isArizeDropdownOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#161C2C] border border-[#252F48] hover:border-slate-500 text-xs text-slate-200 transition-colors cursor-pointer"
              title="Arize Phoenix Telemetry Options"
            >
              <span className="font-medium">Arize</span>
              <span className="text-slate-400">Phoenix</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {isArizeDropdownOpen && (
              <div className="absolute right-0 bottom-full mb-1 w-48 bg-[#0D111A] border border-[#252F48] rounded-lg shadow-xl p-2 text-xs space-y-1.5 z-40">
                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                  Telemetry Target
                </div>
                <div className="flex items-center justify-between text-slate-200 py-1 px-1.5 rounded bg-indigo-600/20 text-indigo-300">
                  <span>Phoenix v4.12</span>
                  <Check className="w-3 h-3 text-indigo-400" />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (onToggleSync) onToggleSync();
                    setIsArizeDropdownOpen(false);
                  }}
                  className="w-full text-[10px] text-slate-400 hover:text-white px-1 pt-1 border-t border-slate-800 flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span>OTel Sync: {isSynchronized ? 'Enabled' : 'Disabled'}</span>
                  <ExternalLink className="w-3 h-3 text-slate-500" />
                </button>
              </div>
            )}
          </div>

          {/* Expand / Minimize toggle */}
          <button
            type="button"
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title={isMaximized ? 'Minimize trace panel' : 'Maximize trace panel'}
          >
            {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Collapsible Content Area */}
      {!collapsed && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Main Timeline Grid */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left Lane Labels Column */}
            <div className="w-48 shrink-0 border-r border-[#1A2234] bg-[#0A0D16] flex flex-col text-xs font-mono select-none">
              {/* Lane header */}
              <div className="h-7 px-3 flex items-center justify-between border-b border-[#1A2234] text-[11px] text-slate-400 font-sans">
                <span>Lane</span>
                <ArrowLeftRight className="w-3 h-3 text-slate-500" />
              </div>

              {/* Lane row items */}
              <div className="flex-1 flex flex-col justify-around py-1">
                {lanesMeta.map((lane) => {
                  const isOpen = !!expandedLanes[lane.id];
                  const count = activeSpans.filter((s) => s.lane === lane.id).length;
                  return (
                    <button
                      key={lane.id}
                      type="button"
                      onClick={() => toggleLane(lane.id)}
                      className="px-3 py-1 flex items-center gap-1.5 text-slate-300 hover:text-white hover:bg-slate-800/40 text-left transition-colors focus:outline-none"
                    >
                      <ChevronRight
                        className={`w-3 h-3 text-slate-500 transition-transform ${
                          isOpen ? 'rotate-90 text-indigo-400' : ''
                        }`}
                      />
                      <span className={`w-2 h-2 rounded-full shrink-0 ${lane.dotColor}`} />
                      <span className="truncate font-sans text-xs flex-1">{lane.label}</span>
                      {count > 0 && (
                        <span className="text-[10px] text-slate-500 font-mono">({count})</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Timeline Canvas with Time Ruler and Span Lanes */}
            <div
              ref={timelineRef}
              onClick={handleTimelineClick}
              className="flex-1 flex flex-col bg-[#080B12] relative overflow-hidden cursor-crosshair select-none"
            >
              {/* Top Time Ruler Header */}
              <div className="h-7 border-b border-[#1A2234] bg-[#0A0E18] flex items-center justify-between px-6 text-[10px] font-mono text-slate-500 relative shrink-0">
                {timeTicks.map((tick, tIdx) => (
                  <div key={tIdx} className="flex flex-col items-center relative">
                    <span>{tick}</span>
                    <span className="w-px h-1.5 bg-slate-700 absolute -bottom-1" />
                  </div>
                ))}
              </div>

              {/* Vertical Grid Lines aligning with the ticks */}
              <div className="absolute inset-0 top-7 pointer-events-none flex justify-between px-6">
                {timeTicks.map((_, tIdx) => (
                  <div key={tIdx} className="w-px h-full bg-slate-800/30" />
                ))}
              </div>

              {/* Multi-lane span rows */}
              <div className="flex-1 flex flex-col justify-around py-1 relative z-10 px-2">
                {lanesMeta.map((lane) => {
                  const laneSpans = activeSpans.filter((s) => s.lane === lane.id);
                  const isOpen = expandedLanes[lane.id] !== false;
                  return (
                    <div
                      key={lane.id}
                      className={`relative h-6 flex items-center transition-all duration-200 ${
                        isOpen ? 'opacity-100' : 'opacity-20 pointer-events-none'
                      }`}
                    >
                      {laneSpans.map((span) => {
                        return (
                          <div
                            key={span.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              const targetMs = Math.round((span.startPct / 100) * effectiveMaxMs);
                              setLocalCursorMs(targetMs);
                              if (onTimeTravelChange) onTimeTravelChange(targetMs);
                            }}
                            onMouseEnter={() => setHoveredSpan(span)}
                            onMouseLeave={() => setHoveredSpan(null)}
                            title={`${span.label} (${formatDuration(span.durationMs)}) - Click to scrub here`}
                            className={`absolute h-4 rounded-md border transition-all hover:brightness-125 cursor-pointer shadow-sm flex items-center px-1.5 active:scale-95 ${
                              span.color === 'emerald'
                                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                                : span.color === 'sky'
                                ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                                : span.color === 'amber'
                                ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                                : 'bg-purple-500/20 border-purple-400 text-purple-200'
                            }`}
                            style={{
                              left: `${span.startPct}%`,
                              width: `${Math.max(3, span.widthPct)}%`,
                            }}
                          >
                            <span className="text-[9px] truncate font-mono select-none">
                              {span.label}
                            </span>
                          </div>
                        );
                      })}

                      {laneSpans.length === 0 && (
                        <div className="text-[10px] text-slate-700 font-mono italic pl-2">
                          Idle
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Empty state overlay when 0 spans across all lanes */}
              {activeSpans.length === 0 && (
                <div className="absolute inset-0 top-7 flex items-center justify-center pointer-events-none">
                  <div className="text-center text-slate-600 font-mono text-xs flex items-center gap-2">
                    <Activity className="w-4 h-4 text-slate-600" />
                    <span>No trace events recorded for this timeline.</span>
                  </div>
                </div>
              )}

              {/* Hover Tooltip Overlay */}
              {hoveredSpan && (
                <div className="absolute bottom-2 right-4 bg-[#0D111A] border border-[#252F48] rounded px-2.5 py-1 text-[11px] font-mono text-slate-200 shadow-xl z-40 pointer-events-none flex items-center gap-2">
                  <span className="text-indigo-400 font-semibold">{hoveredSpan.label}</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-emerald-300">{formatDuration(hoveredSpan.durationMs)}</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-400 uppercase text-[9px]">{hoveredSpan.status}</span>
                </div>
              )}

              {/* Draggable Vertical Scrubber Needle */}
              <div
                className="absolute top-0 bottom-0 pointer-events-none z-30 transition-all duration-75 ease-out"
                style={{ left: `${cursorPercent}%` }}
              >
                {/* Downward indicator handle on ruler */}
                <div className="absolute -top-0.5 -translate-x-1/2 w-3.5 h-4 bg-indigo-500 text-white flex items-center justify-center shadow-lg rounded-b-sm">
                  <span className="text-[7px] font-bold">▼</span>
                </div>

                {/* Vertical glowing line extending through all lanes */}
                <div className="w-0.5 h-full bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.95)]" />
              </div>
            </div>
          </div>

          {/* Bottom Time Travel Scrub Bar */}
          <div className="h-10 px-4 border-t border-[#1A2234] bg-[#0E1322] flex items-center gap-4 shrink-0">
            {/* Play/Pause control */}
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-1.5 rounded-md bg-slate-800/80 hover:bg-indigo-600 text-slate-300 hover:text-white transition-colors focus:outline-none"
              title={isPlaying ? 'Pause replay' : 'Play replay'}
            >
              {isPlaying ? (
                <Pause className="w-3.5 h-3.5 fill-current" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
            </button>

            {/* Label */}
            <span className="text-xs font-medium text-slate-300 shrink-0 font-sans">
              Time travel scrub bar
            </span>

            {/* Full-width draggable slider */}
            <div className="flex-1 relative flex items-center">
              <input
                type="range"
                min={0}
                max={effectiveMaxMs}
                step={250}
                value={localCursorMs}
                onChange={handleScrubChange}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                style={{
                  background: `linear-gradient(to right, #6366F1 0%, #6366F1 ${cursorPercent}%, #1E293B ${cursorPercent}%, #1E293B 100%)`,
                }}
              />
            </div>

            {/* Formatted timestamp display */}
            <div className="text-[11px] font-mono text-slate-400 shrink-0">
              <span className="text-indigo-300 font-semibold">{formatTime(localCursorMs)}</span>
              <span className="text-slate-600"> / </span>
              <span>{formatTime(effectiveMaxMs)}</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
