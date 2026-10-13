import React from 'react';
import { motion } from 'framer-motion';
import { X, Copy, Check } from 'lucide-react';
import { MirroredNotification } from '../../types/index.ts';

interface NotificationBannerProps {
  notification: MirroredNotification;
  onDismiss: () => void;
}

/**
 * Linear-styled Notification Card inside the Dynamic Island.
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
      transition={{ duration: 0.18 }}
      className="flex items-center justify-between w-full gap-3 px-1 font-sans"
    >
      {/* App Badge & Content */}
      <div className="flex flex-col min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-medium text-linear-brand tracking-wider uppercase font-mono">
            {notification.appName}
          </span>
          <span className="text-[10px] text-linear-text-tertiary">•</span>
          <span className="text-xs font-medium text-linear-text-primary tracking-tight truncate">
            {notification.title}
          </span>
        </div>
        <p className="text-xs text-linear-text-secondary truncate mt-0.5 max-w-[240px] tracking-normal">
          {notification.body}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={handleCopy}
          title="Copy message text"
          className="p-1.5 rounded-md hover:bg-white/5 active:scale-95 text-linear-text-secondary hover:text-linear-text-primary border border-transparent hover:border-white/10 transition-colors"
        >
          {copied ? <Check size={13} className="text-linear-green" /> : <Copy size={13} />}
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          title="Dismiss"
          className="p-1.5 rounded-md hover:bg-white/5 active:scale-95 text-linear-text-secondary hover:text-linear-text-primary border border-transparent hover:border-white/10 transition-colors"
        >
          <X size={13} />
        </button>
      </div>
    </motion.div>
  );
};
