import React from 'react';
import {
  Code2,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Clock,
  Cpu,
  Eye,
  Terminal,
  Database,
  Search,
  Workflow,
  Server,
  Palette,
  Globe,
  LucideIcon,
  Bot,
} from 'lucide-react';
import { motion } from 'framer-motion';
import type { SwarmAgent } from '../types';

export interface AgentCardProps {
  agent: SwarmAgent;
  isSelected?: boolean;
  onSelect?: (agentId: string) => void;
  className?: string;
}

/**
 * Returns the appropriate icon for the agent's role or cluster.
 */
export function getAgentIcon(agent: SwarmAgent): LucideIcon {
  const text = `${agent.name || ''} ${agent.id || ''} ${agent.role || ''} ${agent.roleCategory || ''} ${agent.roleIcon || ''} ${agent.clusterId || ''}`.toLowerCase();

  if (text.includes('security') || text.includes('audit') || text.includes('policy')) {
    return ShieldCheck;
  }
  if (text.includes('qa') || text.includes('test') || text.includes('verify') || text.includes('verifier')) {
    return CheckCircle2;
  }
  if (text.includes('monitor') || text.includes('watch') || text.includes('stall')) {
    return Eye;
  }
  if (text.includes('ui') || text.includes('frontend') || text.includes('visual') || text.includes('design') || text.includes('canvas')) {
    return Palette;
  }
  if (text.includes('database') || text.includes('db') || text.includes('sql') || text.includes('migration')) {
    return Database;
  }
  if (text.includes('engine') || text.includes('infra') || text.includes('core')) {
    return Cpu;
  }
  if (text.includes('search') || text.includes('investigat')) {
    return Search;
  }
  if (text.includes('workflow') || text.includes('pipeline') || text.includes('orchestrat')) {
    return Workflow;
  }
  if (text.includes('server') || text.includes('backend') || text.includes('api')) {
    return Server;
  }
  if (text.includes('terminal') || text.includes('cli') || text.includes('cmd')) {
    return Terminal;
  }
  if (text.includes('web') || text.includes('remote') || text.includes('network')) {
    return Globe;
  }
  if (text.includes('bot') || text.includes('subagent')) {
    return Bot;
  }
  return Code2;
}

/**
 * Resolves role color palette (Cyan, Amber, Purple, Emerald, Indigo, Rose, Orange, Sky)
 */
function getRolePalette(agent: SwarmAgent): 'cyan' | 'amber' | 'purple' | 'emerald' | 'indigo' | 'rose' | 'orange' | 'sky' {
  const explicit = (agent.roleColor || '').toLowerCase();
  if (explicit.includes('cyan')) return 'cyan';
  if (explicit.includes('amber')) return 'amber';
  if (explicit.includes('purple')) return 'purple';
  if (explicit.includes('emerald')) return 'emerald';
  if (explicit.includes('indigo')) return 'indigo';
  if (explicit.includes('rose')) return 'rose';
  if (explicit.includes('orange')) return 'orange';
  if (explicit.includes('sky')) return 'sky';

  const text = `${agent.name || ''} ${agent.id || ''} ${agent.role || ''} ${agent.roleCategory || ''} ${agent.clusterId || ''}`.toLowerCase();
  if (text.includes('security') || text.includes('alert')) return 'rose';
  if (text.includes('audit') || text.includes('warn')) return 'amber';
  if (text.includes('qa') || text.includes('test') || text.includes('verify')) return 'emerald';
  if (text.includes('infra') || text.includes('engine') || text.includes('core')) return 'purple';
  if (text.includes('ui') || text.includes('frontend') || text.includes('visual')) return 'cyan';
  if (text.includes('database') || text.includes('db') || text.includes('sql')) return 'orange';
  if (text.includes('monitor') || text.includes('search') || text.includes('web')) return 'sky';
  return 'indigo';
}

/**
 * Visual styling configuration per status
 */
interface StatusStyle {
  border: string;
  bg: string;
  text: string;
  iconColor: string;
  glow: string;
  progressBarColor: string;
}

function getStatusStyle(agent: SwarmAgent, isSelected: boolean): StatusStyle {
  if (isSelected) {
    return {
      border: 'border-2 border-dashed border-amber-400 ring-2 ring-amber-400/40',
      bg: 'bg-amber-950/25',
      text: 'text-amber-200',
      iconColor: 'text-amber-400',
      glow: 'shadow-[0_0_20px_rgba(245,158,11,0.35)]',
      progressBarColor: 'bg-gradient-to-r from-amber-500 to-amber-300',
    };
  }

  const status = agent.status;

  if (status === 'awaiting_approval' || (status as string) === 'waiting') {
    return {
      border: 'border border-amber-500/80 hover:border-amber-400',
      bg: 'bg-[#181512]/90 hover:bg-[#1E1914]',
      text: 'text-amber-300',
      iconColor: 'text-amber-400',
      glow: 'shadow-[0_0_15px_rgba(245,158,11,0.22)]',
      progressBarColor: 'bg-gradient-to-r from-amber-500 to-amber-400 animate-pulse',
    };
  }

  if (status === 'retrying') {
    return {
      border: 'border border-red-500/80 hover:border-red-400',
      bg: 'bg-[#1B1114]/90 hover:bg-[#241318]',
      text: 'text-red-300',
      iconColor: 'text-red-400',
      glow: 'shadow-[0_0_15px_rgba(239,68,68,0.22)]',
      progressBarColor: 'bg-gradient-to-r from-red-600 to-red-400',
    };
  }

  if (status === 'completed') {
    return {
      border: 'border border-emerald-500/30 hover:border-emerald-400/50',
      bg: 'bg-[#0E1515]/80 hover:bg-[#111A1A]',
      text: 'text-emerald-300',
      iconColor: 'text-emerald-400',
      glow: 'shadow-[0_0_10px_rgba(16,185,129,0.1)]',
      progressBarColor: 'bg-emerald-400',
    };
  }

  if (status === 'working' || status === 'thinking') {
    const palette = getRolePalette(agent);
    const paletteStyles = {
      cyan: {
        border: 'border border-cyan-500/40 hover:border-cyan-400/70',
        bg: 'bg-[#0B151A]/90 hover:bg-[#0E1A22]',
        text: 'text-cyan-200',
        iconColor: 'text-cyan-400',
        glow: 'shadow-[0_0_12px_rgba(6,182,212,0.18)]',
        progressBarColor: 'bg-gradient-to-r from-cyan-500 to-sky-400',
      },
      amber: {
        border: 'border border-amber-500/40 hover:border-amber-400/70',
        bg: 'bg-[#16120C]/90 hover:bg-[#1D170E]',
        text: 'text-amber-200',
        iconColor: 'text-amber-400',
        glow: 'shadow-[0_0_12px_rgba(245,158,11,0.18)]',
        progressBarColor: 'bg-gradient-to-r from-amber-500 to-yellow-400',
      },
      purple: {
        border: 'border border-purple-500/40 hover:border-purple-400/70',
        bg: 'bg-[#140E1B]/90 hover:bg-[#191124]',
        text: 'text-purple-200',
        iconColor: 'text-purple-400',
        glow: 'shadow-[0_0_12px_rgba(168,85,247,0.18)]',
        progressBarColor: 'bg-gradient-to-r from-purple-500 to-pink-400',
      },
      emerald: {
        border: 'border border-emerald-500/40 hover:border-emerald-400/70',
        bg: 'bg-[#0C1613]/90 hover:bg-[#101D19]',
        text: 'text-emerald-200',
        iconColor: 'text-emerald-400',
        glow: 'shadow-[0_0_12px_rgba(16,185,129,0.18)]',
        progressBarColor: 'bg-gradient-to-r from-emerald-500 to-teal-400',
      },
      indigo: {
        border: 'border border-indigo-500/40 hover:border-indigo-400/70',
        bg: 'bg-[#0E111F]/90 hover:bg-[#12162B]',
        text: 'text-indigo-200',
        iconColor: 'text-indigo-400',
        glow: 'shadow-[0_0_12px_rgba(99,102,241,0.18)]',
        progressBarColor: 'bg-gradient-to-r from-indigo-500 to-blue-400',
      },
      rose: {
        border: 'border border-rose-500/40 hover:border-rose-400/70',
        bg: 'bg-[#180F13]/90 hover:bg-[#201318]',
        text: 'text-rose-200',
        iconColor: 'text-rose-400',
        glow: 'shadow-[0_0_12px_rgba(244,63,94,0.18)]',
        progressBarColor: 'bg-gradient-to-r from-rose-500 to-pink-500',
      },
      orange: {
        border: 'border border-orange-500/40 hover:border-orange-400/70',
        bg: 'bg-[#18110B]/90 hover:bg-[#20160E]',
        text: 'text-orange-200',
        iconColor: 'text-orange-400',
        glow: 'shadow-[0_0_12px_rgba(249,115,22,0.18)]',
        progressBarColor: 'bg-gradient-to-r from-orange-500 to-amber-500',
      },
      sky: {
        border: 'border border-sky-500/40 hover:border-sky-400/70',
        bg: 'bg-[#0B131C]/90 hover:bg-[#0E1A26]',
        text: 'text-sky-200',
        iconColor: 'text-sky-400',
        glow: 'shadow-[0_0_12px_rgba(14,165,233,0.18)]',
        progressBarColor: 'bg-gradient-to-r from-sky-500 to-cyan-400',
      },
    }[palette];

    return paletteStyles;
  }

  // Idle / default
  return {
    border: 'border border-slate-800 hover:border-slate-700',
    bg: 'bg-[#0E121B]/80 hover:bg-[#131824]',
    text: 'text-slate-400',
    iconColor: 'text-slate-500',
    glow: '',
    progressBarColor: 'bg-slate-700',
  };
}

/**
 * Format token count into clean human readable string
 */
function formatTokenCount(totalTokens?: number, tokensPerSec?: number): string | null {
  if (tokensPerSec && tokensPerSec > 0) {
    return `${tokensPerSec.toFixed(0)} t/s`;
  }
  if (totalTokens && totalTokens > 0) {
    if (totalTokens >= 1000) {
      return `${(totalTokens / 1000).toFixed(1)}k tok`;
    }
    return `${totalTokens} tok`;
  }
  return null;
}

export const AgentCard: React.FC<AgentCardProps> = ({
  agent,
  isSelected = false,
  onSelect,
  className = '',
}) => {
  const IconComponent = getAgentIcon(agent);
  const styles = getStatusStyle(agent, isSelected);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect?.(agent.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect?.(agent.id);
    }
  };

  const isAwaitingApproval =
    agent.status === 'awaiting_approval' || (agent.status as string) === 'waiting';
  const isRetrying = agent.status === 'retrying';

  // Format progress for bottom activity bar
  const progressPercent = Math.min(100, Math.max(0, agent.progress ?? 50));
  const tokenMetric = formatTokenCount(agent.totalTokens, agent.tokensPerSec);

  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={`group relative flex flex-col justify-between overflow-hidden rounded-lg p-2.5 sm:p-3 cursor-pointer select-none transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${styles.border} ${styles.bg} ${styles.glow} ${className}`}
      data-agent-id={agent.id}
      data-status={agent.status}
    >
      {/* Top Header Row: Role Icon + Role Title + Short ID Badge */}
      <div className="flex items-center justify-between gap-1.5 w-full">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <IconComponent
            className={`w-3.5 h-3.5 shrink-0 ${styles.iconColor} ${
              agent.status === 'working' ? 'animate-pulse' : ''
            }`}
          />
          <span
            className={`font-mono text-xs font-semibold tracking-tight truncate ${styles.text}`}
            title={`${agent.role || agent.name || agent.id} (${agent.id})`}
          >
            {agent.role || agent.name || agent.id}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] font-mono text-slate-500">#{agent.id.slice(0, 6)}</span>
          {isAwaitingApproval && (
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500 shadow-[0_0_6px_#F59E0B]" />
            </span>
          )}
          {isRetrying && (
            <span className="relative flex h-2 w-2 shrink-0">
              <RotateCw className="w-2.5 h-2.5 text-red-400 animate-spin" />
            </span>
          )}
        </div>
      </div>

      {/* Associated Task Description */}
      {(agent.taskSummary || agent.task) && (
        <div
          className="mt-1.5 text-[11px] text-slate-300 font-sans line-clamp-2 leading-tight"
          title={agent.taskSummary || agent.task}
        >
          {agent.taskSummary || agent.task}
        </div>
      )}

      {/* Status & Metrics Row */}
      <div className="mt-1.5 mb-1 flex items-center justify-between text-[10px] font-mono gap-1">
        <div className="flex items-center gap-1 min-w-0">
          {isAwaitingApproval ? (
            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <Clock className="w-2.5 h-2.5 text-amber-400" />
              <span>Awaiting Approval</span>
            </div>
          ) : isRetrying ? (
            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/20 text-red-300 border border-red-500/30">
              <AlertTriangle className="w-2.5 h-2.5 text-red-400" />
              <span>Retrying</span>
            </div>
          ) : (
            <span className="truncate text-slate-400 capitalize">
              {agent.status}
            </span>
          )}
        </div>

        {tokenMetric && (
          <span className="text-teal-400/80 font-medium shrink-0">
            {tokenMetric}
          </span>
        )}
      </div>

      {/* Bottom Progress Bar / Activity Indicator Line */}
      <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mt-1">
        <div
          className={`h-full rounded-full transition-all duration-300 ${styles.progressBarColor}`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </motion.div>
  );
};
