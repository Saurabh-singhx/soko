import React from 'react';
import { motion } from 'framer-motion';
import { X, Copy, Check } from 'lucide-react';
import { MirroredNotification } from '../../types/index.ts';

interface NotificationBannerProps {
  notification: MirroredNotification;
  onDismiss: () => void;
}

/**
 * Expanded Notification Card inside the Dynamic Island.
 */
export const NotificationBanner: React.FC<NotificationBannerProps> = ({
  notification,
  onDismiss,
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`${notification.title}: ${notification.body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
      className="flex items-center justify-between w-full gap-3 px-1"
    >
      {/* App Badge & Content */}
      <div className="flex flex-col min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider">
            {notification.appName}
          </span>
          <span className="text-[10px] text-zinc-500">•</span>
          <span className="text-xs font-semibold text-zinc-200 truncate">
            {notification.title}
          </span>
        </div>
        <p className="text-xs text-zinc-400 truncate mt-0.5 max-w-[240px]">
          {notification.body}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={handleCopy}
          title="Copy message text"
          className="p-1.5 rounded-full hover:bg-white/10 active:scale-95 text-zinc-400 hover:text-white transition-colors"
        >
          {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          title="Dismiss"
          className="p-1.5 rounded-full hover:bg-white/10 active:scale-95 text-zinc-400 hover:text-white transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </motion.div>
  );
};
