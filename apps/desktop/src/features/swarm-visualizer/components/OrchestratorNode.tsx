import React, { useState } from 'react';
import { Network, Activity, Sparkles, Copy, Check, FolderGit2 } from 'lucide-react';
import { motion } from 'framer-motion';

export interface OrchestratorNodeProps {
  sessionId?: string;
  workspaceName?: string;
  model?: string;
  agentName?: string;
  agentStatus?: string;
  activeCount?: number;
  totalParallel?: number;
  isRunning?: boolean;
  statusText?: string;
  pinRef?: React.Ref<HTMLDivElement>;
  className?: string;
}

/**
 * Root Orchestrator Node
 *
 * Left-side orchestrator node representing the master swarm coordinator,
 * featuring real session ID, workspace details, purple gradient border,
 * glowing pulse orb, branching icon, and SVG output connection pin.
 */
export const OrchestratorNode: React.FC<OrchestratorNodeProps> = ({
  sessionId,
  workspaceName,
  model,
  agentName,
  agentStatus,
  activeCount = 0,
  totalParallel = 0,
  isRunning = true,
  statusText = 'Root Orchestrator',
  pinRef,
  className = '',
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyId = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (sessionId) {
      navigator.clipboard?.writeText(sessionId)?.catch?.(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shortSessionId = sessionId
    ? sessionId.length > 12
      ? `${sessionId.slice(0, 8)}...`
      : sessionId
    : 'coordinator';

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`relative select-none ${className}`}
    >
      {/* Outer ambient glow */}
      <div className="absolute -inset-1 bg-gradient-to-r from-purple-600/30 via-indigo-600/20 to-teal-500/10 rounded-2xl blur-lg opacity-70 pointer-events-none" />

      {/* Main card container */}
      <div className="relative flex flex-col gap-3 px-4 py-3.5 sm:px-5 sm:py-4 rounded-xl bg-[#0E121B]/95 backdrop-blur-md border border-purple-500/40 shadow-[0_0_25px_rgba(168,85,247,0.18)] hover:border-purple-400/60 transition-all duration-200">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Glowing pulse orb & branching icon badge */}
            <div className="relative flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-purple-900/60 to-indigo-950/80 border border-purple-400/40 text-purple-300 shadow-[inset_0_0_12px_rgba(168,85,247,0.3)] shrink-0">
              <Network className="w-5 h-5 text-purple-300 animate-pulse" />
              {/* Glowing pulse orb dot */}
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                {isRunning && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                )}
                <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500 border border-purple-200 shadow-[0_0_8px_#C084FC]" />
              </span>
            </div>

            {/* Node titles & status */}
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-white font-semibold text-sm sm:text-base tracking-tight font-sans truncate">
                  {agentName || statusText}
                </span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
                  <Sparkles className="w-2.5 h-2.5 text-purple-300" />
                  {agentStatus || 'unknown'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 font-mono">
                <span className="flex items-center gap-1">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isRunning ? 'bg-emerald-400 shadow-[0_0_6px_#34D399]' : 'bg-slate-500'
                    }`}
                  />
                  {agentStatus || 'Unknown status'}
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-300 font-medium">
                  {totalParallel || activeCount} Child sessions
                </span>
              </div>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 pl-3 border-l border-white/10 text-xs text-slate-400 font-mono shrink-0">
            <Activity className={`w-3.5 h-3.5 ${isRunning ? 'text-teal-400 animate-pulse' : 'text-slate-500'}`} />
            <span>{isRunning ? 'Active' : 'Inactive'}</span>
          </div>
        </div>

        {/* Real Session & Workspace Metadata Badges */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-white/5 text-[11px] font-mono text-slate-400">
          {sessionId && (
            <button
              type="button"
              onClick={handleCopyId}
              title={`Click to copy session: ${sessionId}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-colors"
            >
              <span className="text-purple-400">id:</span>
              <span className="truncate max-w-[120px]">{shortSessionId}</span>
              {copied ? (
                <Check className="w-2.5 h-2.5 text-emerald-400" />
              ) : (
                <Copy className="w-2.5 h-2.5 text-slate-400 hover:text-white" />
              )}
            </button>
          )}

          {workspaceName && (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">
              <FolderGit2 className="w-2.5 h-2.5 text-indigo-400" />
              <span className="truncate max-w-[100px]">{workspaceName}</span>
            </div>
          )}

          {model && (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[10px]">
              <span>{model.replace('gemini-', 'gem-')}</span>
            </div>
          )}
        </div>

        {/* SVG Output Connection Pin (Right side anchor) */}
        <div
          ref={pinRef}
          id="orchestrator-output-pin"
          data-pin="orchestrator-out"
          className="absolute -right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-4 h-4 rounded-full bg-[#0E121B] border-2 border-purple-400 shadow-[0_0_10px_#A855F7] cursor-crosshair z-20 transition-transform hover:scale-125"
          title="Swarm DAG Output Pin"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-purple-300 shadow-[0_0_6px_#C084FC]" />
        </div>
      </div>
    </motion.div>
  );
};
