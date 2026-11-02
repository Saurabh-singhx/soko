import React from 'react';
import { Zap, Cpu, Layers, Database } from 'lucide-react';
import { Card } from '../../../../ui/primitives/Card.tsx';
import { Badge } from '../../../../ui/primitives/Badge.tsx';
import { AiTokenSummary } from '../../../../types/index.ts';

interface TokensTabProps {
  tokenStats?: AiTokenSummary | null;
}

export const TokensTab: React.FC<TokensTabProps> = ({ tokenStats }) => {
  const formatTokens = (n?: number) => {
    if (!n || n <= 0) return '0';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return n.toLocaleString();
  };

  return (
    <div className="space-y-4">
      {/* Overview Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card glow>
          <div className="flex items-center gap-2 mb-1">
            <Zap size={14} className="text-emerald-400" />
            <span className="text-[11px] text-neutral-400 font-medium">TOTAL TOKENS</span>
          </div>
          <span className="text-2xl font-bold font-mono text-emerald-300">
            {formatTokens(tokenStats?.totalTokens)}
          </span>
          <span className="text-[10px] text-neutral-500 font-mono block mt-1">
            Across all active AI agents
          </span>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-1">
            <Cpu size={14} className="text-[#8A95FF]" />
            <span className="text-[11px] text-neutral-400 font-medium">TODAY'S TOKENS</span>
          </div>
          <span className="text-2xl font-bold font-mono text-white">
            {formatTokens(tokenStats?.todayTokens)}
          </span>
          <span className="text-[10px] text-neutral-500 font-mono block mt-1">
            Consumed in current 24h window
          </span>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-1">
            <Layers size={14} className="text-[#56B6F7]" />
            <span className="text-[11px] text-neutral-400 font-medium">FRESH TOKENS</span>
          </div>
          <span className="text-2xl font-bold font-mono text-white">
            {formatTokens(tokenStats?.freshTokens)}
          </span>
          <span className="text-[10px] text-neutral-500 font-mono block mt-1">
            Non-cached computation
          </span>
        </Card>
      </div>

      {/* Cache & Efficiency */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Database size={14} className="text-amber-400" />
            <h4 className="text-xs font-semibold text-white">Prompt Caching & Efficiency</h4>
          </div>
          <Badge variant="warning" size="xs">
            {tokenStats?.cacheHitRate !== undefined ? `${tokenStats.cacheHitRate}% Hit Rate` : 'Telemetry Live'}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs font-mono text-neutral-300">
          <div className="bg-black/30 p-2.5 rounded-lg border border-white/[0.05]">
            <span className="text-[10px] text-neutral-500 block">CACHED PROMPT TOKENS</span>
            <span className="text-white font-medium text-sm">
              {formatTokens(tokenStats?.cachedTokens)}
            </span>
          </div>
          <div className="bg-black/30 p-2.5 rounded-lg border border-white/[0.05]">
            <span className="text-[10px] text-neutral-500 block">TOTAL RECORDED SESSIONS</span>
            <span className="text-emerald-400 font-medium text-sm">
              {tokenStats?.totalSessions ?? 0} sessions
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
};
