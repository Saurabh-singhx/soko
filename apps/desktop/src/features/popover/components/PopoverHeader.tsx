import React from 'react';
import { Radio, X } from 'lucide-react';

interface PopoverHeaderProps {
  onClose: () => void;
  workspaceName?: string;
  workspacePath?: string;
  hasActiveAgent?: boolean;
}

export const PopoverHeader: React.FC<PopoverHeaderProps> = ({
  onClose,
  workspaceName,
  workspacePath,
  hasActiveAgent,
}) => {
  return (
    <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/[0.08] shrink-0 select-none">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg bg-[#5E6AD2]/20 border border-[#5E6AD2]/40 flex items-center justify-center text-[#5E6AD2] shadow-[0_0_12px_rgba(94,106,210,0.3)]">
          <Radio size={13} />
        </div>
        <span className="text-xs font-semibold tracking-tight text-white">Connection Hub</span>
        <span className="text-[10px] font-mono font-medium text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded-md border border-emerald-500/30">
          :8766
        </span>
        {hasActiveAgent && (
          <span
            className="text-[9.5px] font-mono font-medium px-1.5 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 shrink-0 truncate max-w-[110px]"
            title={`Active Agent Working Directory: ${workspaceName || 'soko'}\nPath: ${workspacePath || '/home/saurabh/coding/soko'}`}
          >
            📁 {workspaceName || 'soko'}
          </span>
        )}
      </div>

      <button
        onClick={onClose}
        aria-label="Close connection hub"
        className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 active:scale-90 transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#5E6AD2]"
        title="Close connection hub"
      >
        <X size={14} />
      </button>
    </div>
  );
};
