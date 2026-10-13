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
      className="flex items-start justify-between w-full gap-2 px-1 py-0.5 font-sans select-none"
    >
      {/* Brand Icon Badge + Details Block */}
      <div className="flex items-start gap-2.5 min-w-0 flex-1">
        {/* Authentic Brand Icon Container with Theme Integration */}
        <motion.div
          initial={{ scale: 0.84, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.24, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          className="shrink-0 w-7 h-7 rounded-[7px] flex items-center justify-center border shadow-sm relative overflow-hidden mt-0.5"
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
        </motion.div>

        {/* Interactive Text Block - Click to Copy */}
        <div
          onClick={handleCopyText}
          className="flex flex-col min-w-0 flex-1 cursor-pointer group/text"
          title="Click to copy message"
        >
          <motion.div
            initial={{ opacity: 0, x: -3 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.24, delay: 0.07, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-1.5 min-w-0"
          >
            <span
              className="text-[10px] font-semibold tracking-wider uppercase font-mono shrink-0"
              style={{ color: brand.color }}
            >
              {notification.appName}
            </span>
            <span className="text-[10px] text-linear-text-tertiary shrink-0">•</span>
            <span
              className="text-xs font-medium text-linear-text-primary tracking-tight truncate group-hover/text:text-white transition-colors"
              title={notification.title}
            >
              {notification.title}
            </span>

            {/* Instant Copied Feedback Pill */}
            <AnimatePresence>
              {copied && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.85, x: -3 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ duration: 0.14 }}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-linear-green/15 text-linear-green border border-linear-green/25 shrink-0 ml-1"
                >
                  <Check size={10} /> Copied
                </motion.span>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Full Readable Body Text:
              Stretches vertically without scroll.
              Scroll activates ONLY if content reaches screen limit (min(65vh, 440px)). */}
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.26, delay: 0.09, ease: [0.16, 1, 0.3, 1] }}
            className={`text-xs mt-1 tracking-normal leading-relaxed break-words whitespace-pre-wrap select-text max-h-[min(65vh,440px)] overflow-y-auto pr-1 transition-colors ${
              copied
                ? 'text-linear-green/90'
                : 'text-linear-text-secondary group-hover/text:text-linear-text-primary'
            }`}
          >
            {notification.body}
          </motion.div>
        </div>
      </div>

      {/* Action Buttons: Only Dismiss (X) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.22, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-center gap-1 shrink-0 self-start mt-0.5"
      >
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
      </motion.div>
    </motion.div>
  );
};
