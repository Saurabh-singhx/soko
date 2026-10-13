import React from 'react';
import { motion } from 'framer-motion';
import { X, Copy, Check } from 'lucide-react';
import { MirroredNotification } from '../../types/index.ts';
import { AppIcon, getAppBrandInfo } from './AppIcon.tsx';

interface NotificationBannerProps {
  notification: MirroredNotification;
  onDismiss: () => void;
}

/**
 * Linear-styled Notification Card inside the Dynamic Island.
 * Features authentic app icons in their original brand colors,
 * set inside subtle glassmorphic squircle badges fitting the Linear dark canvas.
 * Stretches vertically to display full content naturally; scrolls only if screen limit is reached.
 */
export const NotificationBanner: React.FC<NotificationBannerProps> = ({
  notification,
  onDismiss,
}) => {
  const [copied, setCopied] = React.useState(false);
  const brand = getAppBrandInfo(notification.appName, notification.packageName);

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
      className="flex items-start justify-between w-full gap-2 px-1 py-0.5 font-sans"
    >
      {/* Brand Icon Badge + Details Block */}
      <div className="flex items-start gap-2.5 min-w-0 flex-1">
        {/* Authentic Brand Icon Container with Theme Integration */}
        <div
          className="shrink-0 w-7 h-7 rounded-[7px] flex items-center justify-center border shadow-sm relative overflow-hidden transition-all mt-0.5"
          style={{
            backgroundColor: brand.badgeBg,
            borderColor: 'rgba(255, 255, 255, 0.12)',
          }}
          title={notification.appName}
        >
          <AppIcon
            appName={notification.appName}
            packageName={notification.packageName}
            size={16}
          />
        </div>

        {/* Text Content Block */}
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className="text-[10px] font-semibold tracking-wider uppercase font-mono shrink-0"
              style={{ color: brand.color }}
            >
              {notification.appName}
            </span>
            <span className="text-[10px] text-linear-text-tertiary shrink-0">•</span>
            <span
              className="text-xs font-medium text-linear-text-primary tracking-tight truncate"
              title={notification.title}
            >
              {notification.title}
            </span>
          </div>

          {/* Full Readable Body Text:
              Stretches vertically without scroll.
              Scroll activates ONLY if content reaches screen limit (min(65vh, 440px)). */}
          <div className="text-xs text-linear-text-secondary mt-1 tracking-normal leading-relaxed break-words whitespace-pre-wrap select-text max-h-[min(65vh,440px)] overflow-y-auto pr-1">
            {notification.body}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1 shrink-0 self-start mt-0.5">
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
