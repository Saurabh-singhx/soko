import React from 'react';
import { motion } from 'framer-motion';
import { FileDown, CheckCircle2, X, RotateCcw, AlertCircle, Ban, ExternalLink, Folder } from 'lucide-react';
import { FileTransferStatus } from '../../types/index.ts';
import { connectionService } from '../../services/connection.ts';

interface TransferProgressProps {
  transfer: FileTransferStatus;
  onCancel?: () => void;
  onRetry?: () => void;
  onDismiss?: () => void;
}

/**
 * Linear-styled High-Speed File Download Progress Widget.
 *
 * Supports live transfer telemetry, real-time cancellation,
 * failure handling with cleanup notice, and instant retry.
 */
export const TransferProgress: React.FC<TransferProgressProps> = ({
  transfer,
  onCancel,
  onRetry,
  onDismiss,
}) => {
  const speedMb = (transfer.speedBytesPerSec / 1_048_576).toFixed(1);
  const transferredMb = (transfer.bytesDownloaded / 1_048_576).toFixed(1);
  const totalMb = (transfer.totalBytes / 1_048_576).toFixed(1);

  const isActive = transfer.status === 'active';
  const isCompleted = transfer.status === 'completed';
  const isCancelled = transfer.status === 'cancelled';
  const isFailed = transfer.status === 'failed';

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="flex flex-col w-full gap-1.5 px-1 font-sans select-none"
    >
      <div className="flex items-center justify-between text-[11px]">
        {/* Left: File Icon & Filename */}
        <div className="flex items-center gap-1.5 min-w-0">
          <FileDown
            size={12}
            className={`shrink-0 ${
              isCompleted
                ? 'text-linear-green'
                : isCancelled
                ? 'text-linear-amber'
                : isFailed
                ? 'text-linear-red'
                : 'text-linear-brand'
            }`}
          />
          <span className="font-medium text-linear-text-primary tracking-tight truncate max-w-[140px]">
            {transfer.filename}
          </span>
        </div>

        {/* Right: State / Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isCompleted && (
            <div className="flex items-center gap-1.5" data-no-drag="true">
              <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                <CheckCircle2 size={11} /> Saved
              </span>
              <button
                data-no-drag="true"
                onClick={(e) => {
                  e.stopPropagation();
                  connectionService.openTransferredFile(transfer.filename);
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#5E6AD2]/20 hover:bg-[#5E6AD2]/35 text-[#7C88E8] hover:text-white text-[9.5px] font-medium border border-[#5E6AD2]/30 active:scale-95 transition-all duration-150"
                title="Open transferred file in default app"
              >
                <ExternalLink size={9} /> Open
              </button>
              <button
                data-no-drag="true"
                onClick={(e) => {
                  e.stopPropagation();
                  connectionService.openTransfersFolder();
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[9.5px] font-medium border border-white/10 active:scale-95 transition-all duration-150"
                title="Show transfers folder"
              >
                <Folder size={9} /> Folder
              </button>
            </div>
          )}

          {isActive && (
            <>
              <span className="text-[10px] text-linear-text-secondary font-mono mr-1">
                {speedMb} MB/s
              </span>
              {onCancel && (
                <button
                  data-no-drag="true"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancel();
                  }}
                  title="Cancel file transfer"
                  className="p-1 rounded-lg hover:bg-white/10 text-linear-text-tertiary hover:text-rose-400 active:scale-90 transition-all duration-150"
                >
                  <X size={11} />
                </button>
              )}
            </>
          )}

          {(isCancelled || isFailed) && (
            <div className="flex items-center gap-1" data-no-drag="true">
              <span
                className={`flex items-center gap-1 text-[10px] font-medium font-mono px-1.5 py-0.5 rounded-md ${
                  isCancelled
                    ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                    : 'text-rose-400 bg-rose-500/10 border border-rose-500/20'
                }`}
              >
                {isCancelled ? <Ban size={10} /> : <AlertCircle size={10} />}
                {isCancelled ? 'Cancelled' : 'Failed'}
              </span>

              {onRetry && (
                <button
                  data-no-drag="true"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRetry();
                  }}
                  title="Retry file transfer"
                  className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] text-white font-medium border border-white/10 active:scale-95 transition-all duration-150"
                >
                  <RotateCcw size={10} /> Retry
                </button>
              )}

              {onDismiss && (
                <button
                  data-no-drag="true"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDismiss();
                  }}
                  title="Dismiss"
                  className="p-1 rounded-lg hover:bg-white/10 text-linear-text-tertiary hover:text-white active:scale-90 transition-all duration-150"
                >
                  <X size={11} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Progress Track */}
      <div className="w-full bg-white/10 rounded-full h-1 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${
            isCompleted
              ? 'bg-linear-green'
              : isCancelled
              ? 'bg-linear-amber'
              : isFailed
              ? 'bg-linear-red'
              : 'bg-linear-brand'
          }`}
          initial={{ width: 0 }}
          animate={{
            width: isCancelled || isFailed ? '100%' : `${Math.min(100, transfer.percentage)}%`,
          }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
        />
      </div>

      {/* Stats Bottom Bar */}
      <div className="flex justify-between text-[9px] text-linear-text-tertiary font-mono">
        <span>
          {isCancelled
            ? 'Partial buffer deleted • Cleaned up'
            : isFailed
            ? (transfer.error || 'Connection interrupted')
            : `${transferredMb} / ${totalMb} MB`}
        </span>
        <span>
          {isCancelled ? 'Aborted' : isFailed ? 'Error' : `${Math.round(transfer.percentage)}%`}
        </span>
      </div>
    </motion.div>
  );
};
