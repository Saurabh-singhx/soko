import React from 'react';
import { motion } from 'framer-motion';
import { FileDown, CheckCircle2 } from 'lucide-react';
import { FileTransferStatus } from '../../types/index.ts';

interface TransferProgressProps {
  transfer: FileTransferStatus;
}

/**
 * High-Speed APK / File Download Progress Widget in the Dynamic Island.
 */
export const TransferProgress: React.FC<TransferProgressProps> = ({ transfer }) => {
  const speedMb = (transfer.speedBytesPerSec / 1_048_576).toFixed(1);
  const transferredMb = (transfer.bytesDownloaded / 1_048_576).toFixed(1);
  const totalMb = (transfer.totalBytes / 1_048_576).toFixed(1);

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="flex flex-col w-full gap-1.5 px-1"
    >
      <div className="flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1.5 min-w-0">
          <FileDown size={13} className="text-cyan-400 shrink-0" />
          <span className="font-semibold text-zinc-200 truncate max-w-[170px]">
            {transfer.filename}
          </span>
        </div>

        {transfer.status === 'completed' ? (
          <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
            <CheckCircle2 size={12} /> Saved
          </span>
        ) : (
          <span className="text-[10px] text-cyan-400 font-mono">
            {speedMb} MB/s
          </span>
        )}
      </div>

      {/* Progress Track */}
      <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
        <motion.div
          className="bg-gradient-to-r from-cyan-400 to-emerald-400 h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, transfer.percentage)}%` }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
        />
      </div>

      <div className="flex justify-between text-[9px] text-zinc-500 font-mono">
        <span>{transferredMb} / {totalMb} MB</span>
        <span>{Math.round(transfer.percentage)}%</span>
      </div>
    </motion.div>
  );
};
