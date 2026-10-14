import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { MirroredNotification } from '../../types/index.ts';
import { AppIcon, getAppBrandInfo } from './AppIcon.tsx';

interface NotificationBannerProps {
  notification: MirroredNotification;
  onDismiss: () => void;
}

/**
 * Linear-styled Notification Card inside the Dynamic Island.
 * Features authentic app icons in their original brand colors.
 * Choreographed entry with silky Apple-style spring and staggered reveals.
 * Clicking on the notification text copies message text to clipboard with instant feedback.
 * Action buttons retain only the dismiss action.
 */
export const NotificationBanner: React.FC<NotificationBannerProps> = ({
  notification,
  onDismiss,
}) => {
  const [copied, setCopied] = React.useState(false);
  const brand = getAppBrandInfo(notification.appName, notification.packageName);

  const handleCopyText = (e: React.MouseEvent) => {
    e.stopPropagation();
    const selection = window.getSelection()?.toString().trim();
    const textToCopy = selection && selection.length > 0
      ? selection
      : `${notification.title}: ${notification.body}`;

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, y: 4, filter: 'blur(4px)' }}
      animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
      exit={{
        opacity: 0,
        scale: 0.96,
        filter: 'blur(3px)',
        transition: { duration: 0.16, ease: [0.32, 0, 0.67, 0] },
      }}
      transition={{
        duration: 0.28,
        delay: 0.03,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="flex flex-col w-full min-w-0 font-sans select-none"
    >
      {/* Row 1: Header (Brand Icon + App Name + Dot + Title + Important + Dismiss Button) */}
      <div className="flex items-center justify-between w-full min-w-0 gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
          {/* Authentic Brand Icon Container with Theme Integration */}
          <motion.div
            initial={{ scale: 0.84, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.24, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
            className="shrink-0 w-[22px] h-[22px] rounded-[6px] flex items-center justify-center border shadow-xs relative overflow-hidden"
            style={{
              backgroundColor: brand.badgeBg,
              borderColor: 'rgba(255, 255, 255, 0.12)',
            }}
            title={notification.appName}
          >
            <AppIcon
              appName={notification.appName}
              packageName={notification.packageName}
              size={13}
            />
          </motion.div>

          {/* App Name */}
          <span
            className="text-[10px] font-bold tracking-wider uppercase font-mono shrink-0"
            style={{ color: brand.color }}
          >
            {notification.appName}
          </span>

          <span className="text-[10px] text-white/30 shrink-0">•</span>

          {/* Title */}
          <span
            className="text-[12px] font-semibold text-white tracking-tight truncate min-w-0"
            title={notification.title}
          >
            {notification.title}
          </span>

          {/* Important Pill */}
          {notification.isImportant && (
            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 uppercase tracking-wider shrink-0 font-mono">
              Important
            </span>
          )}

          {/* Instant Copied Feedback Pill */}
          <AnimatePresence>
            {copied && (
              <motion.span
                initial={{ opacity: 0, scale: 0.85, x: -3 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.14 }}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0 ml-1"
              >
                <Check size={10} /> Copied
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Action Button: Top-right Dismiss (X) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.22, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="shrink-0 flex items-center"
        >
          <button
            data-no-drag="true"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            title="Dismiss notification"
            className="p-1 rounded-md text-white/40 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
          >
            <X size={13} />
          </button>
        </motion.div>
      </div>

      {/* Row 2: Full Readable Body Text indented flush beneath Title */}
      <motion.div
        initial={{ opacity: 0, y: 3 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26, delay: 0.09, ease: [0.16, 1, 0.3, 1] }}
        onClick={handleCopyText}
        className="w-full mt-1.5 pl-[30px] pr-1 pb-1 cursor-pointer group/text"
        title="Click to copy message"
      >
        <div
          className={`text-[12px] leading-relaxed break-words whitespace-pre-wrap select-text max-h-[220px] overflow-y-auto pr-1 pb-0.5 transition-colors ${
            copied
              ? 'text-emerald-300 font-medium'
              : 'text-neutral-300 group-hover/text:text-white'
          }`}
        >
          {notification.body}
        </div>
      </motion.div>
    </motion.div>
  );
};
