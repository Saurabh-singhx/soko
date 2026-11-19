import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Sparkles,
  RotateCcw,
  Ban,
  CheckCircle,
  Cpu,
  Zap,
  Send,
  MessageSquare,
  Archive,
  Bot,
  Activity,
  GitBranch,
} from 'lucide-react';
import { SwarmAgent } from '../types';
import { ReasoningStepsViewer } from './ReasoningStepsViewer';
import { StateDiffViewer } from './StateDiffViewer';

export interface InspectorPanelProps {
  agent?: SwarmAgent | null;
  onClose?: () => void;
  onApprove?: (agentId: string, actionId: string) => void;
  onReject?: (agentId: string, actionId: string) => void;
  onRetry?: (agentId: string) => void;
  onSendPrompt?: (agentId: string, promptText: string) => void;
  allAgents?: SwarmAgent[];
  onSelectAgent?: (agentId: string) => void;
  viewMode?: 'live' | 'history';
  className?: string;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  agent,
  onClose,
  onApprove,
  onReject,
  onRetry,
  onSendPrompt,
  allAgents = [],
  onSelectAgent,
  viewMode = 'live',
  className = '',
}) => {
  // Collapsible sections
  const [isReasoningOpen, setIsReasoningOpen] = useState(true);
  const [isDiffOpen, setIsDiffOpen] = useState(true);
  const [isActionDropdownOpen, setIsActionDropdownOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [showPromptInput, setShowPromptInput] = useState(false);

  // Interaction feedback states
  const [copiedId, setCopiedId] = useState(false);
  const [copiedSession, setCopiedSession] = useState(false);
  const [approvalFeedback, setApprovalFeedback] = useState<'idle' | 'approving' | 'approved'>('idle');
  const [rejectFeedback, setRejectFeedback] = useState<'idle' | 'rejecting' | 'rejected'>('idle');

  const actionDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (actionDropdownRef.current && !actionDropdownRef.current.contains(e.target as Node)) {
        setIsActionDropdownOpen(false);
      }
    };
    if (isActionDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isActionDropdownOpen]);

  const isHistoryMode = viewMode === 'history';

  // Empty state when no agent is selected
  if (!agent) {
    return (
      <aside
        className={`w-full h-full flex flex-col bg-[#0B0F19] border-l border-[#1A2234] text-slate-200 select-none overflow-hidden relative ${className}`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1A2234] bg-[#0E1322]/80 backdrop-blur-sm shrink-0">
          <h2 className="text-sm font-semibold text-slate-100 tracking-wide font-sans">Inspector</h2>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors focus:outline-none"
              title="Close Inspector"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500 font-mono space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-900/80 border border-slate-800 flex items-center justify-center text-slate-400">
            <Bot className="w-6 h-6 text-indigo-400" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-300 font-sans">No Agent Selected</h3>
            <p className="text-xs text-slate-500 max-w-xs font-sans">
              Select any agent from the swarm canvas to inspect its reasoning trace, state diffs, and execution controls.
            </p>
          </div>
        </div>
      </aside>
    );
  }

  const activeAgent = agent;

  const handleCopyId = () => {
    navigator.clipboard?.writeText(activeAgent.id)?.catch?.(() => {});
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1800);
  };

  const handleCopySession = (sessionId: string) => {
    navigator.clipboard?.writeText(sessionId)?.catch?.(() => {});
    setCopiedSession(true);
    setTimeout(() => setCopiedSession(false), 1800);
  };

  const handleApprove = () => {
    if (isHistoryMode) return;
    setApprovalFeedback('approving');
    const actionId = activeAgent.actionRequired?.actionId || 'default-action';
    if (onApprove) {
      onApprove(activeAgent.id, actionId);
    }
    setTimeout(() => {
      setApprovalFeedback('approved');
      setTimeout(() => setApprovalFeedback('idle'), 2200);
    }, 450);
  };

  const handleReject = () => {
    if (isHistoryMode) return;
    setRejectFeedback('rejecting');
    const actionId = activeAgent.actionRequired?.actionId || 'default-action';
    if (onReject) {
      onReject(activeAgent.id, actionId);
    }
    setTimeout(() => {
      setRejectFeedback('rejected');
      setTimeout(() => setRejectFeedback('idle'), 2200);
    }, 450);
  };

  const handleDispatchPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (isHistoryMode || !customPrompt.trim()) return;
    if (onSendPrompt) {
      onSendPrompt(activeAgent.id, customPrompt);
    } else if (onApprove) {
      onApprove(activeAgent.id, customPrompt);
    }
    setCustomPrompt('');
    setShowPromptInput(false);
  };

  const formatTokens = (num?: number) => {
    if (!num) return '0';
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
    return num.toString();
  };

  // CLI subagents are observational sessions. Keep their inspector visual and
  // status-focused instead of exposing raw transcript, tool, or terminal text.
  if (activeAgent.isSubagent) {
    const isActive = ['working', 'active', 'thinking'].includes(activeAgent.status);
    const isComplete = activeAgent.status === 'completed';
    const childCount = allAgents.filter((candidate) => candidate.parentSessionId === activeAgent.sessionId).length;
    const statusTone = isComplete
      ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
      : isActive
        ? 'text-cyan-200 border-cyan-400/40 bg-cyan-500/10'
        : 'text-slate-300 border-slate-600/40 bg-slate-700/20';

    return (
      <aside className={`w-full h-full flex flex-col bg-[#0B0F19] border-l border-[#1A2234] text-slate-200 overflow-hidden ${className}`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1A2234] bg-[#0E1322]/80 shrink-0">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-300" />
            <h2 className="text-sm font-semibold text-slate-100">Agent visual</h2>
          </div>
          {onClose && (
            <button type="button" onClick={onClose} className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/60" title="Close inspector">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          <div className="relative overflow-hidden rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-950/50 via-[#101725] to-indigo-950/40 p-5">
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-cyan-400/10 blur-2xl" />
            <div className="relative flex flex-col items-center text-center">
              <div className={`relative mb-4 flex h-20 w-20 items-center justify-center rounded-3xl border ${statusTone}`}>
                <Bot className={`h-9 w-9 ${isActive ? 'text-cyan-200' : isComplete ? 'text-emerald-300' : 'text-slate-300'}`} />
                <span className={`absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-[#111827] ${isComplete ? 'bg-emerald-400' : isActive ? 'bg-cyan-300' : 'bg-slate-500'}`} />
              </div>
              <h3 className="max-w-full break-words text-lg font-semibold text-white">
                {activeAgent.role || activeAgent.name || 'Agent'}
              </h3>
              <span className={`mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium capitalize ${statusTone}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${isComplete ? 'bg-emerald-400' : isActive ? 'bg-cyan-300' : 'bg-slate-400'}`} />
                {activeAgent.status}
              </span>

              <div className="mt-6 flex w-full items-center justify-center gap-3">
                <div className="min-w-0 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                  <div className="text-[9px] uppercase tracking-wider text-slate-500">Parent</div>
                  <div className="mt-1 max-w-24 truncate font-mono text-[10px] text-slate-300" title={activeAgent.parentSessionId || ''}>
                    {activeAgent.parentSessionId?.slice(0, 8) || 'Root'}
                  </div>
                </div>
                <div className="h-px w-8 bg-gradient-to-r from-indigo-400/40 to-cyan-300/80" />
                <div className="min-w-0 rounded-lg border border-cyan-400/20 bg-cyan-400/[0.06] px-3 py-2">
                  <div className="text-[9px] uppercase tracking-wider text-cyan-200/60">Agent</div>
                  <div className="mt-1 max-w-24 truncate font-mono text-[10px] text-cyan-100" title={activeAgent.sessionId || activeAgent.id}>
                    {activeAgent.sessionId?.slice(0, 8) || activeAgent.id}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {activeAgent.depth !== undefined && (
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
                <div className="flex items-center gap-2 text-slate-400"><GitBranch className="h-3.5 w-3.5 text-indigo-300" /><span className="text-[10px] uppercase tracking-wider">Depth</span></div>
                <div className="mt-2 font-mono text-lg text-white">{activeAgent.depth}</div>
              </div>
            )}
            {(activeAgent.totalTurns ?? 0) > 0 && (
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
                <div className="flex items-center gap-2 text-slate-400"><Activity className="h-3.5 w-3.5 text-cyan-300" /><span className="text-[10px] uppercase tracking-wider">Turns</span></div>
                <div className="mt-2 font-mono text-lg text-white">{activeAgent.totalTurns}</div>
              </div>
            )}
            {activeAgent.totalTokens > 0 && (
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
                <div className="flex items-center gap-2 text-slate-400"><Cpu className="h-3.5 w-3.5 text-violet-300" /><span className="text-[10px] uppercase tracking-wider">Tokens</span></div>
                <div className="mt-2 font-mono text-lg text-white">{formatTokens(activeAgent.totalTokens)}</div>
              </div>
            )}
            {childCount > 0 && (
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
                <div className="flex items-center gap-2 text-slate-400"><GitBranch className="h-3.5 w-3.5 text-teal-300" /><span className="text-[10px] uppercase tracking-wider">Child agents</span></div>
                <div className="mt-2 font-mono text-lg text-white">{childCount}</div>
              </div>
            )}
          </div>

          {activeAgent.workspaceName && (
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.025] px-3 py-2">
              <div className="text-[9px] uppercase tracking-wider text-slate-500">Workspace</div>
              <div className="mt-1 truncate text-xs text-slate-300">{activeAgent.workspaceName}</div>
            </div>
          )}

          <div className="rounded-xl border border-white/[0.06] bg-black/15 p-3 text-center text-[11px] text-slate-500">
            Select another node on the canvas to view its status.
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={`w-full h-full flex flex-col bg-[#0B0F19] border-l border-[#1A2234] text-slate-200 select-none overflow-hidden relative ${className}`}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1A2234] bg-[#0E1322]/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-100 tracking-wide font-sans">Inspector</h2>
          {isHistoryMode ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-800 text-slate-400 border border-slate-700">
              <Archive className="w-2.5 h-2.5 text-slate-400" />
              ARCHIVE
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE
            </span>
          )}
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors focus:outline-none"
            title="Close Inspector"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 custom-scrollbar">
        {/* Agent ID & Status Block */}
        <div className="space-y-2">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            AGENT ID:
          </span>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xl font-medium text-white tracking-tight">
                {activeAgent.id}
              </span>
              {activeAgent.status === 'awaiting_approval' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse">
                  Approval Required
                </span>
              )}
              {activeAgent.status === 'retrying' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/15 text-red-400 border border-red-500/30">
                  Retrying
                </span>
              )}
              {activeAgent.status === 'working' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Active
                </span>
              )}
              {activeAgent.status === 'completed' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                  Completed
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleCopyId}
              className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1"
              title="Copy Agent ID"
            >
              {copiedId ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[10px] text-emerald-400 font-sans">Copied</span>
                </>
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>

          {activeAgent.sessionId && (
            <div className="flex items-center justify-between px-2 py-1 bg-slate-900/60 border border-slate-800 rounded text-[10px] font-mono text-slate-400">
              <span className="truncate">Session: {activeAgent.sessionId}</span>
              <button
                type="button"
                onClick={() => handleCopySession(activeAgent.sessionId!)}
                className="hover:text-white p-0.5 ml-1 shrink-0"
                title="Copy Session ID"
              >
                {copiedSession ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          )}

          {/* Real Agent Metadata Grid */}
          <div className="grid grid-cols-2 gap-2 bg-[#0D111A] border border-[#1E2638] rounded-lg p-2.5 text-[11px] font-sans">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase tracking-wider">Cluster</span>
              <span className="text-slate-200 font-medium truncate block">{activeAgent.clusterName}</span>
            </div>

            <div>
              <span className="text-slate-400 block text-[10px] uppercase tracking-wider">Role</span>
              <div className="flex items-center gap-1 text-slate-200 font-medium truncate">
                <Cpu className="w-3 h-3 text-cyan-400 shrink-0" />
                <span className="truncate">{activeAgent.role || activeAgent.model || 'Subagent'}</span>
              </div>
            </div>

            <div>
              <span className="text-slate-400 block text-[10px] uppercase tracking-wider">Tokens</span>
              <div className="flex items-center gap-1 text-slate-200 font-medium">
                <Zap className="w-3 h-3 text-amber-400 shrink-0" />
                <span>{activeAgent.totalTokens > 0 ? `${formatTokens(activeAgent.totalTokens)} tok` : 'Not reported'}</span>
                {activeAgent.tokensPerSec > 0 && (
                  <span className="text-slate-400 text-[10px]">({formatTokens(activeAgent.tokensPerSec)}/s)</span>
                )}
              </div>
            </div>

            <div>
              <span className="text-slate-400 block text-[10px] uppercase tracking-wider">Progress</span>
              {activeAgent.progress === undefined ? (
                <span className="text-slate-500 text-xs">Not reported by this agent</span>
              ) : (
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-teal-400 h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(0, activeAgent.progress))}%` }}
                    />
                  </div>
                  <span className="text-slate-300 font-mono text-[10px]">{activeAgent.progress}%</span>
                </div>
              )}
            </div>
          </div>

          {/* Associated Task Block */}
          {(activeAgent.taskSummary || activeAgent.task) && (
            <div className="bg-[#0D111A] border border-[#1E2638] rounded-lg p-3 text-xs space-y-1">
              <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-semibold">
                Associated Task
              </span>
              <p className="text-slate-200 font-sans leading-relaxed whitespace-pre-wrap select-text">
                {activeAgent.taskSummary || activeAgent.task}
              </p>
            </div>
          )}
        </div>

        {/* Collapsible Section 1: Reasoning Steps */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIsReasoningOpen(!isReasoningOpen)}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 hover:text-white transition-colors focus:outline-none"
            >
              <span>Reasoning Steps</span>
            </button>

            <div className="flex items-center gap-2">
              {!isHistoryMode && activeAgent.status === 'working' ? (
                <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-800/40">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  <span>Live</span>
                </div>
              ) : (
                <span className="text-[10px] font-mono text-slate-500">
                  {activeAgent.reasoningSteps?.length || 0} steps
                </span>
              )}

              <button
                type="button"
                onClick={() => setIsReasoningOpen(!isReasoningOpen)}
                className="text-slate-400 hover:text-slate-200 p-0.5"
              >
                {isReasoningOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {isReasoningOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <ReasoningStepsViewer steps={activeAgent.reasoningSteps} isLive={!isHistoryMode} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Collapsible Section 2: State Diff */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIsDiffOpen(!isDiffOpen)}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 hover:text-white transition-colors focus:outline-none"
            >
              <span>State Diff</span>
            </button>

            <button
              type="button"
              onClick={() => setIsDiffOpen(!isDiffOpen)}
              className="text-slate-400 hover:text-slate-200 p-0.5"
            >
              {isDiffOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          <AnimatePresence initial={false}>
            {isDiffOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <StateDiffViewer diff={activeAgent.stateDiff} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Action Controls Section at Bottom */}
      <div className="p-4 border-t border-[#1A2234] bg-[#0E1322]/95 backdrop-blur-md space-y-3 shrink-0">
        <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
          <span>Action button</span>
          <div className="flex items-center gap-2">
            {!isHistoryMode ? (
              <button
                type="button"
                onClick={() => setShowPromptInput(!showPromptInput)}
                className="text-[11px] text-slate-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                title="Send custom instruction/prompt"
              >
                <MessageSquare className="w-3 h-3" />
                <span>Prompt Agent</span>
              </button>
            ) : (
              <span className="text-[10px] text-slate-500 font-mono">Archived (Read-Only)</span>
            )}
            {activeAgent.actionRequired && (
              <span className="text-[10px] text-indigo-400 font-mono">
                {activeAgent.actionRequired.toolName}
              </span>
            )}
          </div>
        </div>

        {/* Custom Prompt Input drawer if toggled (Live mode only) */}
        {!isHistoryMode && showPromptInput && (
          <form onSubmit={handleDispatchPrompt} className="flex gap-2 items-center">
            <input
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder={`Send instructions to ${activeAgent.id}...`}
              className="flex-1 bg-[#0D111A] border border-[#1E2638] focus:border-indigo-500 rounded px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!customPrompt.trim()}
              className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded text-xs flex items-center gap-1"
            >
              <Send className="w-3 h-3" />
            </button>
          </form>
        )}

        {/* Dropdown Selector for Agent Action */}
        <div ref={actionDropdownRef} className="relative">
          <button
            type="button"
            onClick={() => setIsActionDropdownOpen(!isActionDropdownOpen)}
            className="w-full bg-[#0D111A] border border-[#1E2638] hover:border-slate-600 rounded-lg px-3 py-2 text-xs flex items-center justify-between text-slate-200 font-mono transition-colors shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <span className="truncate">{activeAgent.role || activeAgent.name || activeAgent.id}</span>
            <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-2" />
          </button>

          {/* Action selection dropdown list */}
          <AnimatePresence>
            {isActionDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.15 }}
                className="absolute z-30 bottom-full mb-1 left-0 right-0 bg-[#0D111A] border border-[#252F48] rounded-lg shadow-2xl overflow-hidden max-h-48 overflow-y-auto"
              >
                <div className="p-1.5 space-y-0.5">
                  <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Select Target Agent
                  </div>
                  {allAgents.length > 0 ? (
                    allAgents.map((ag) => {
                      const isAwaiting = ag.status === 'awaiting_approval' || Boolean(ag.actionRequired);
                      const isSelected = ag.id === activeAgent.id;
                      return (
                        <button
                          key={ag.id}
                          type="button"
                          onClick={() => {
                            if (onSelectAgent) onSelectAgent(ag.id);
                            setIsActionDropdownOpen(false);
                          }}
                          className={`w-full text-left px-2 py-1.5 rounded-md text-xs font-mono flex items-center justify-between transition-colors ${
                            isSelected
                              ? 'bg-indigo-600/20 text-indigo-300 font-semibold'
                              : 'text-slate-300 hover:bg-slate-800/60'
                          }`}
                        >
                          <span className="truncate max-w-[160px]">{ag.role || ag.name || ag.id}</span>
                          {isAwaiting ? (
                            <span className="text-[10px] text-amber-400 bg-amber-950/40 px-1.5 py-0.5 rounded font-sans">
                              Pending Approval
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-sans capitalize">
                              {ag.status}
                            </span>
                          )}
                        </button>
                      );
                    })
                  ) : (
                    <div className="px-2 py-1 text-xs text-slate-500">
                      Current: {activeAgent.role || activeAgent.name || activeAgent.id}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Primary Action Button */}
        {isHistoryMode ? (
          /* History mode: marked as Archived (Completed) and disabled */
          <div className="w-full py-2.5 px-4 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-400 text-xs font-mono flex items-center justify-center gap-2">
            <Archive className="w-3.5 h-3.5 text-slate-500" />
            <span>Archived (Completed)</span>
          </div>
        ) : (
          /* Live mode: Active approval action */
          <div className="relative group">
            {/* Subtle Ambient Diamond Star Icon in Top Right */}
            <div className="absolute -top-3 -right-2 pointer-events-none z-10">
              <svg
                className="w-10 h-10 text-white/90 drop-shadow-[0_0_12px_rgba(255,255,255,0.95)] animate-pulse"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
              </svg>
            </div>

            <button
              type="button"
              onClick={handleApprove}
              disabled={approvalFeedback !== 'idle' || (activeAgent.status !== 'awaiting_approval' && !activeAgent.actionRequired)}
              className="w-full relative overflow-hidden rounded-lg py-2.5 px-4 font-medium text-xs text-white tracking-wide transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 shadow-[0_0_24px_rgba(79,98,248,0.55)] hover:shadow-[0_0_32px_rgba(99,102,241,0.85)] active:scale-[0.99] disabled:opacity-75 disabled:shadow-none"
              style={{
                background:
                  approvalFeedback === 'approved'
                    ? 'linear-gradient(135deg, #059669 0%, #10B981 100%)'
                    : (activeAgent.status === 'awaiting_approval' || Boolean(activeAgent.actionRequired))
                    ? 'linear-gradient(135deg, #4F62F8 0%, #5B6BF5 50%, #6366F1 100%)'
                    : '#1E2433',
              }}
            >
              {/* Gloss sheen overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/20 pointer-events-none" />

              <div className="relative flex items-center justify-center gap-2">
                {approvalFeedback === 'approved' ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-white animate-bounce" />
                    <span className="font-semibold">Tool Execution Approved!</span>
                  </>
                ) : approvalFeedback === 'approving' ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Approving Execution...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
                    <span>
                      {activeAgent.actionRequired?.label || (activeAgent.status === 'awaiting_approval' ? 'Approve Tool Execution' : 'Agent Ready')}
                    </span>
                  </>
                )}
              </div>
            </button>
          </div>
        )}

        {/* Secondary Actions: Reject / Terminate / Retry (Live mode only) */}
        {!isHistoryMode && (
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleReject}
              disabled={rejectFeedback !== 'idle' || (activeAgent.status !== 'awaiting_approval' && !activeAgent.actionRequired)}
              className="flex-1 py-1.5 px-2.5 rounded-md border border-slate-700/80 hover:border-red-500/60 hover:bg-red-500/10 text-slate-300 hover:text-red-300 text-[11px] font-medium transition-colors flex items-center justify-center gap-1.5 focus:outline-none disabled:opacity-40"
            >
              {rejectFeedback === 'rejected' ? (
                <span className="text-red-400 font-semibold">Rejected</span>
              ) : (
                <>
                  <Ban className="w-3 h-3 text-red-400" />
                  <span>Reject</span>
                </>
              )}
            </button>

            {(activeAgent.status === 'retrying' || activeAgent.status === 'idle' || (activeAgent.status as string) === 'failed') && onRetry && (
              <button
                type="button"
                onClick={() => onRetry(activeAgent.id)}
                className="flex-1 py-1.5 px-2.5 rounded-md border border-amber-500/50 hover:bg-amber-500/10 text-amber-300 text-[11px] font-medium transition-colors flex items-center justify-center gap-1.5 focus:outline-none"
              >
                <RotateCcw className="w-3 h-3 text-amber-400" />
                <span>Retry Step</span>
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
