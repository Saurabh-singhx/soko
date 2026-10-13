import React from 'react';
import { motion } from 'framer-motion';
import { Terminal, Square, CheckCircle, AlertTriangle } from 'lucide-react';
import { CliProcessStatus } from '../../types/index.ts';

interface CliStatusWidgetProps {
  status: CliProcessStatus;
  onCancel?: () => void;
}

/**
 * Linear-styled Live Terminal / CLI Agent Status Widget.
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
      className="flex flex-col w-full gap-1.5 px-1 font-sans"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Terminal size={12} className="text-linear-brand" />
          <span className="text-[11px] font-medium text-linear-text-primary tracking-tight">
            {status.title}
          </span>
        </div>

        {status.status === 'running' && onCancel && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-linear-red/10 hover:bg-linear-red/20 text-linear-red text-[10px] font-medium border border-linear-red/20 transition-colors"
          >
            <Square size={9} fill="currentColor" /> Stop
          </button>
        )}

        {status.status === 'completed' && (
          <span className="flex items-center gap-1 text-[10px] text-linear-green font-medium">
            <CheckCircle size={11} /> Completed
          </span>
        )}

        {status.status === 'failed' && (
          <span className="flex items-center gap-1 text-[10px] text-linear-red font-medium">
            <AlertTriangle size={11} /> Exit {status.exitCode ?? 1}
          </span>
        )}
      </div>

      {/* Terminal Monospace Stream Tail */}
      <div className="bg-[#050607] rounded-md px-2 py-1.5 font-mono text-[10px] text-linear-text-secondary border border-white/5 flex flex-col justify-center min-h-[26px] max-h-[58px] overflow-y-auto leading-relaxed select-text">
        <div className="flex items-center min-w-0">
          <span className="text-linear-brand select-none mr-1.5 font-medium shrink-0">$</span>
          <span className="text-linear-text-primary/95 truncate font-medium">
            {status.lastOutputLine || 'Running task...'}
          </span>
        </div>
        {status.output && status.output.includes('\n') && (
          <div className="text-linear-text-secondary whitespace-pre-wrap pl-3.5 mt-0.5 text-[9.5px]">
            {status.output.split('\n').slice(1).join('\n')}
          </div>
        )}
      </div>
    </motion.div>
  );
};
