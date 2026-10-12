import React from 'react';
import { motion } from 'framer-motion';
import { Terminal, Square, CheckCircle, AlertTriangle } from 'lucide-react';
import { CliProcessStatus } from '../../types/index.ts';

interface CliStatusWidgetProps {
  status: CliProcessStatus;
  onCancel?: () => void;
}

/**
 * Live Terminal / CLI Agent Status Widget inside the Dynamic Island.
 */
export const CliStatusWidget: React.FC<CliStatusWidgetProps> = ({
  status,
  onCancel,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="flex flex-col w-full gap-1.5 px-1"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Terminal size={13} className="text-amber-400" />
          <span className="text-[11px] font-bold text-zinc-200">
            {status.title}
          </span>
        </div>

        {status.status === 'running' && onCancel && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 text-[10px] font-medium transition-colors"
          >
            <Square size={10} fill="currentColor" /> Stop
          </button>
        )}

        {status.status === 'completed' && (
          <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
            <CheckCircle size={11} /> Done
          </span>
        )}

        {status.status === 'failed' && (
          <span className="flex items-center gap-1 text-[10px] text-red-400 font-medium">
            <AlertTriangle size={11} /> Exit {status.exitCode ?? 1}
          </span>
        )}
      </div>

      {/* Terminal Monospace Stream Tail */}
      <div className="bg-black/60 rounded px-2 py-1 font-mono text-[10px] text-zinc-300 truncate border border-white/5">
        <span className="text-cyan-400 select-none mr-1">$</span>
        {status.lastOutputLine || 'Running task...'}
      </div>
    </motion.div>
  );
};
