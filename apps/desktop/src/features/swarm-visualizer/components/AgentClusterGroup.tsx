import React, { useState } from 'react';
import {
  Terminal,
  ShieldCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Clock,
  Cpu,
  Layers,
  Database,
  Eye,
  Server,
  Code2,
  Zap,
  Search,
  Workflow,
  Palette,
  Globe,
  LucideIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AgentCluster } from '../types';
import { AgentCard } from './AgentCard';

export interface AgentClusterGroupProps {
  cluster: AgentCluster;
  selectedAgentId?: string | null;
  onSelectAgent?: (agentId: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: (clusterId: string) => void;
  pinRef?: React.Ref<HTMLDivElement>;
  onPinMount?: (clusterId: string, el: HTMLDivElement | null) => void;
  className?: string;
}

export interface ClusterVisuals {
  Icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  badgeColor: string;
  pinColor: string;
  paletteName: 'cyan' | 'amber' | 'purple' | 'emerald' | 'indigo' | 'rose' | 'orange' | 'sky';
}

/**
 * Dynamic visuals resolver supporting arbitrary roles with diverse Lucide icons
 * and vibrant color palettes (Cyan, Amber, Purple, Emerald, Indigo, Rose, Orange, Sky)
 */
export function getClusterVisuals(cluster: AgentCluster): ClusterVisuals {
  const text = `${cluster.id || ''} ${cluster.name || ''} ${cluster.role || ''} ${cluster.roleCategory || ''} ${cluster.iconType || ''}`.toLowerCase();
  const theme = (cluster.themeColor || '').toLowerCase();

  // 1. Resolve Icon
  let Icon: LucideIcon = Code2;
  if (text.includes('security') || text.includes('audit') || text.includes('policy')) {
    Icon = ShieldCheck;
  } else if (text.includes('qa') || text.includes('test') || text.includes('verify') || text.includes('verifier')) {
    Icon = CheckCircle2;
  } else if (text.includes('monitor') || text.includes('watch') || text.includes('stall')) {
    Icon = Eye;
  } else if (text.includes('ui') || text.includes('frontend') || text.includes('visual') || text.includes('design') || text.includes('canvas')) {
    Icon = Palette;
  } else if (text.includes('database') || text.includes('db') || text.includes('sql') || text.includes('migration')) {
    Icon = Database;
  } else if (text.includes('engine') || text.includes('infra') || text.includes('core')) {
    Icon = Cpu;
  } else if (text.includes('search') || text.includes('investigat')) {
    Icon = Search;
  } else if (text.includes('workflow') || text.includes('pipeline') || text.includes('orchestrat')) {
    Icon = Workflow;
  } else if (text.includes('server') || text.includes('backend') || text.includes('api')) {
    Icon = Server;
  } else if (text.includes('terminal') || text.includes('cli') || text.includes('cmd')) {
    Icon = Terminal;
  } else if (text.includes('web') || text.includes('remote') || text.includes('network')) {
    Icon = Globe;
  } else if (text.includes('zap') || text.includes('perf')) {
    Icon = Zap;
  } else {
    Icon = Layers;
  }

  // 2. Resolve Color Palette (Cyan, Amber, Purple, Emerald, Indigo, Rose, Orange, Sky)
  if (theme.includes('rose') || text.includes('security') || text.includes('alert')) {
    return {
      Icon,
      iconColor: 'text-rose-400',
      iconBg: 'bg-rose-500/15 border-rose-500/30',
      badgeColor: 'text-rose-300 bg-rose-500/10 border-rose-500/30',
      pinColor: 'border-rose-400 shadow-[0_0_8px_#F43F5E] bg-rose-400',
      paletteName: 'rose',
    };
  }

  if (theme.includes('amber') || text.includes('audit') || text.includes('warn')) {
    return {
      Icon,
      iconColor: 'text-amber-400',
      iconBg: 'bg-amber-500/15 border-amber-500/30',
      badgeColor: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
      pinColor: 'border-amber-400 shadow-[0_0_8px_#F59E0B] bg-amber-400',
      paletteName: 'amber',
    };
  }

  if (theme.includes('emerald') || text.includes('qa') || text.includes('test') || text.includes('verify')) {
    return {
      Icon,
      iconColor: 'text-emerald-400',
      iconBg: 'bg-emerald-500/15 border-emerald-500/30',
      badgeColor: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
      pinColor: 'border-emerald-400 shadow-[0_0_8px_#10B981] bg-emerald-400',
      paletteName: 'emerald',
    };
  }

  if (theme.includes('purple') || text.includes('infra') || text.includes('engine') || text.includes('core')) {
    return {
      Icon,
      iconColor: 'text-purple-400',
      iconBg: 'bg-purple-500/15 border-purple-500/30',
      badgeColor: 'text-purple-300 bg-purple-500/10 border-purple-500/30',
      pinColor: 'border-purple-400 shadow-[0_0_8px_#A855F7] bg-purple-400',
      paletteName: 'purple',
    };
  }

  if (theme.includes('cyan') || text.includes('ui') || text.includes('frontend') || text.includes('visual')) {
    return {
      Icon,
      iconColor: 'text-cyan-400',
      iconBg: 'bg-cyan-500/15 border-cyan-500/30',
      badgeColor: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30',
      pinColor: 'border-cyan-400 shadow-[0_0_8px_#06B6D4] bg-cyan-400',
      paletteName: 'cyan',
    };
  }

  if (theme.includes('orange') || text.includes('database') || text.includes('db') || text.includes('sql')) {
    return {
      Icon,
      iconColor: 'text-orange-400',
      iconBg: 'bg-orange-500/15 border-orange-500/30',
      badgeColor: 'text-orange-300 bg-orange-500/10 border-orange-500/30',
      pinColor: 'border-orange-400 shadow-[0_0_8px_#F97316] bg-orange-400',
      paletteName: 'orange',
    };
  }

  if (theme.includes('sky') || text.includes('monitor') || text.includes('search') || text.includes('web')) {
    return {
      Icon,
      iconColor: 'text-sky-400',
      iconBg: 'bg-sky-500/15 border-sky-500/30',
      badgeColor: 'text-sky-300 bg-sky-500/10 border-sky-500/30',
      pinColor: 'border-sky-400 shadow-[0_0_8px_#0EA5E9] bg-sky-400',
      paletteName: 'sky',
    };
  }

  // Default Indigo
  return {
    Icon,
    iconColor: 'text-indigo-400',
    iconBg: 'bg-indigo-500/15 border-indigo-500/30',
    badgeColor: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/30',
    pinColor: 'border-indigo-400 shadow-[0_0_8px_#818CF8] bg-indigo-400',
    paletteName: 'indigo',
  };
}

export const AgentClusterGroup: React.FC<AgentClusterGroupProps> = ({
  cluster,
  selectedAgentId,
  onSelectAgent,
  isCollapsed: controlledCollapsed,
  onToggleCollapse,
  pinRef,
  onPinMount,
  className = '',
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isCollapsed =
    controlledCollapsed !== undefined
      ? controlledCollapsed
      : cluster.isCollapsed ?? internalCollapsed;

  const visuals = getClusterVisuals(cluster);
  const agents = cluster.agents || [];

  // Metrics summary
  const activeCount =
    cluster.activeCount ??
    agents.filter((a) => a.status === 'working' || a.status === 'thinking').length;
  const awaitingApprovalCount = agents.filter(
    (a) => a.status === 'awaiting_approval' || (a.status as string) === 'waiting'
  ).length;
  const retryingCount = agents.filter((a) => a.status === 'retrying').length;

  const handleToggle = () => {
    if (onToggleCollapse) {
      onToggleCollapse(cluster.id);
    } else {
      setInternalCollapsed(!internalCollapsed);
    }
  };

  const setPinElement = (el: HTMLDivElement | null) => {
    if (typeof pinRef === 'function') {
      pinRef(el);
    } else if (pinRef && 'current' in pinRef) {
      (pinRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    }
    onPinMount?.(cluster.id, el);
  };

  return (
    <div
      className={`relative rounded-xl bg-[#0E121B]/95 border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.4)] backdrop-blur-sm transition-all duration-200 ${className}`}
      data-cluster-id={cluster.id}
    >
      {/* SVG Input Connection Pin (Left-side anchor) */}
      <div
        ref={setPinElement}
        id={`cluster-pin-${cluster.id}`}
        data-pin={`cluster-in-${cluster.id}`}
        className="absolute -left-2 top-6 -translate-y-1/2 flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[#0E121B] border-2 border-slate-400 shadow-sm z-20 cursor-crosshair transition-transform hover:scale-125"
        title={`${cluster.name} Input Link Pin`}
      >
        <div className={`w-1.5 h-1.5 rounded-full ${visuals.pinColor}`} />
      </div>

      {/* Cluster Header */}
      <div
        onClick={handleToggle}
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none border-b border-white/5 hover:bg-white/[0.02] transition-colors rounded-t-xl"
      >
        {/* Left: Icon + Cluster Name + Active Pill */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`flex items-center justify-center w-7 h-7 rounded-lg border ${visuals.iconBg} ${visuals.iconColor}`}
          >
            <visuals.Icon className="w-4 h-4" />
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-white text-sm font-semibold tracking-tight truncate font-sans">
              {cluster.name}
            </h3>

            {/* Active count badge */}
            <span className="font-mono text-xs text-teal-400 font-medium shrink-0">
              [{activeCount} Active]
            </span>
          </div>
        </div>

        {/* Right: Status Badges (Awaiting Approval / Retrying) + Chevron */}
        <div className="flex items-center gap-2">
          {awaitingApprovalCount > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (isCollapsed) handleToggle();
                const target = agents.find((a) => a.status === 'awaiting_approval' || (a.status as string) === 'waiting');
                if (target && onSelectAgent) onSelectAgent(target.id);
              }}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-colors animate-pulse cursor-pointer"
              title="Click to inspect agent awaiting approval"
            >
              <Clock className="w-3 h-3 text-amber-400" />
              <span>{awaitingApprovalCount} Awaiting Approval</span>
            </button>
          )}

          {retryingCount > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (isCollapsed) handleToggle();
                const target = agents.find((a) => a.status === 'retrying');
                if (target && onSelectAgent) onSelectAgent(target.id);
              }}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30 transition-colors cursor-pointer"
              title="Click to inspect retrying agent"
            >
              <AlertCircle className="w-3 h-3 text-red-400" />
              <span>{retryingCount} Retrying</span>
            </button>
          )}

          {/* Chevron Collapse Toggle */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggle();
            }}
            aria-label={isCollapsed ? 'Expand cluster' : 'Collapse cluster'}
            className="flex items-center justify-center w-6 h-6 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            {isCollapsed ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Collapsible Agent Cards Grid */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="p-3 sm:p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                {agents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    isSelected={agent.id === selectedAgentId}
                    onSelect={onSelectAgent}
                  />
                ))}
              </div>

              {agents.length === 0 && (
                <div className="text-center py-6 text-slate-500 text-xs font-mono">
                  No agents in this cluster group.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
