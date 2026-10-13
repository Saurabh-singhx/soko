import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bluetooth, Settings } from 'lucide-react';
import { CharacterAvatar } from './CharacterAvatar.tsx';
import { NotificationBanner } from './NotificationBanner.tsx';
import { CliStatusWidget } from './CliStatusWidget.tsx';
import { TransferProgress } from './TransferProgress.tsx';
import {
  IslandMode,
  MascotMood,
  MirroredNotification,
  CliProcessStatus,
  FileTransferStatus,
} from '../../types/index.ts';

interface DynamicIslandProps {
  onOpenSettings: () => void;
}

/**
 * Apple-inspired Dynamic Island Container Component.
 *
 * Sits top-center of the screen and smoothly morphs between
 * compact pill and expanded interactive cards using Apple-style spring physics.
 */
export const DynamicIsland: React.FC<DynamicIslandProps> = ({ onOpenSettings }) => {
  const [mode, setMode] = useState<IslandMode>('compact');
  const [mood, setMood] = useState<MascotMood>('idle');
  const [isConnected] = useState(true);

  // Active state payloads
  const [activeNotification, setActiveNotification] = useState<MirroredNotification | null>(null);
  const [activeCli, setActiveCli] = useState<CliProcessStatus | null>(null);
  const [activeTransfer, setActiveTransfer] = useState<FileTransferStatus | null>(null);

  const [isBotClicked, setIsBotClicked] = useState(false);

  // Auto-collapse notification after 6 seconds if not interacted with
  useEffect(() => {
    if (mode === 'notification') {
      const timer = setTimeout(() => {
        setMode('compact');
        setMood('idle');
        setIsBotClicked(false);
      }, 6500);
      return () => clearTimeout(timer);
    }
  }, [mode]);

  // Spring physics transition config
  const springTransition = {
    type: 'spring',
    stiffness: 450,
    damping: 32,
    mass: 0.85,
  };

  // Dynamic avatar size: significantly increased when notification is visible & when clicked
  const getAvatarSize = () => {
    if (mode === 'notification') {
      // 48px when notification is visible, 64px when clicked on bot!
      return isBotClicked ? 64 : 48;
    }
    if (isBotClicked) {
      return 42;
    }
    return 32;
  };

  const avatarSize = getAvatarSize();

  // Dimensions based on mode & bot enlargement
  const getIslandDimensions = () => {
    switch (mode) {
      case 'compact':
        return { width: isBotClicked ? 212 : 196, height: isBotClicked ? 46 : 42 };
      case 'notification':
        return { width: isBotClicked ? 446 : 400, height: isBotClicked ? 98 : 86 };
      case 'cli':
        return { width: 428, height: 102 };
      case 'transfer':
        return { width: 348, height: 80 };
    }
  };

  const dims = getIslandDimensions();

const DEMO_NOTIFICATIONS: MirroredNotification[] = [
  {
    id: 'demo-1',
    appName: 'WhatsApp',
    packageName: 'com.whatsapp',
    title: 'Alex Developer',
    body: 'Hey, I pushed the new changes to main. Check agy!',
    timestamp: Date.now(),
  },
  {
    id: 'demo-2',
    appName: 'GitHub',
    packageName: 'com.github',
    title: 'Pull Request #42 Merged',
    body: 'fix(avatar): 360 spin effect and watch left/right tracking',
    timestamp: Date.now(),
  },
  {
    id: 'demo-3',
    appName: 'Telegram',
    packageName: 'org.telegram.messenger',
    title: 'Soko Dev Community',
    body: 'New release APK build is now available for download.',
    timestamp: Date.now(),
  },
  {
    id: 'demo-4',
    appName: 'Slack',
    packageName: 'com.slack',
    title: 'Sarah Chen (#dev)',
    body: 'Bot ocular kinetics look incredible! Ready for launch.',
    timestamp: Date.now(),
  },
  {
    id: 'demo-5',
    appName: 'Discord',
    packageName: 'com.discord',
    title: '#announcements',
    body: 'Grok Bot face expressions are now fully live!',
    timestamp: Date.now(),
  },
  {
    id: 'demo-6',
    appName: 'Antigravity',
    packageName: 'ai.antigravity.cli',
    title: 'agy Agent Finished',
    body: 'Workspace analysis completed with 0 warnings.',
    timestamp: Date.now(),
  },
  {
    id: 'demo-7',
    appName: 'Linear',
    packageName: 'app.linear',
    title: 'SOKO-109 Done',
    body: 'Dynamic Island mascot and brand icons deployed.',
    timestamp: Date.now(),
  },
  {
    id: 'demo-8',
    appName: 'Gmail',
    packageName: 'com.google.android.gm',
    title: 'Dev Digest',
    body: 'Weekly release summary: Soko cross-platform companion.',
    timestamp: Date.now(),
  },
];

  const [demoIndex, setDemoIndex] = useState(0);

  // Test simulation trigger helpers for demo / local inspection
  const simulateNotification = () => {
    const nextIndex = (demoIndex + 1) % DEMO_NOTIFICATIONS.length;
    setDemoIndex(nextIndex);
    const notif = {
      ...DEMO_NOTIFICATIONS[nextIndex],
      id: `demo-${nextIndex}-${Date.now()}`,
      timestamp: Date.now(),
    };
    setActiveNotification(notif);
    setMood('alert');
    setMode('notification');
  };

  const simulateCli = () => {
    setActiveCli({
      commandId: 'agy-run',
      title: 'Antigravity CLI Agent',
      status: 'running',
      startedAt: Date.now(),
      lastOutputLine: 'Analyzing workspace dependencies and compiling...',
    });
    setMood('working');
    setMode('cli');

    setTimeout(() => {
      setActiveCli((prev) =>
        prev
          ? {
              ...prev,
              status: 'completed',
              lastOutputLine: 'Completed successfully with 0 errors.',
              exitCode: 0,
            }
          : null
      );
      setMood('happy');

      setTimeout(() => {
        setMode('compact');
        setMood('idle');
      }, 3500);
    }, 4500);
  };

  const simulateTransfer = () => {
    setActiveTransfer({
      filename: 'soko-v1.0.0-release.apk',
      bytesDownloaded: 14_000_000,
      totalBytes: 52_000_000,
      speedBytesPerSec: 42_000_000,
      percentage: 27,
      status: 'active',
    });
    setMood('working');
    setMode('transfer');

    let current = 14_000_000;
    const interval = setInterval(() => {
      current += 15_000_000;
      if (current >= 52_000_000) {
        clearInterval(interval);
        setActiveTransfer({
          filename: 'soko-v1.0.0-release.apk',
          bytesDownloaded: 52_000_000,
          totalBytes: 52_000_000,
          speedBytesPerSec: 0,
          percentage: 100,
          status: 'completed',
        });
        setMood('happy');
        setTimeout(() => {
          setMode('compact');
          setMood('idle');
        }, 3000);
      } else {
        setActiveTransfer((prev) =>
          prev
            ? {
                ...prev,
                bytesDownloaded: current,
                percentage: (current / 52_000_000) * 100,
              }
            : null
        );
      }
    }, 300);
  };

  return (
    <div className="flex flex-col items-center justify-start w-full h-full pt-1">
      {/* Morphing Dynamic Island Pill */}
      <motion.div
        layout
        transition={springTransition}
        style={{ width: dims.width, height: dims.height }}
        className="relative bg-[#08090A] border border-white/10 rounded-island shadow-linear-island flex items-center px-2.5 overflow-hidden backdrop-blur-3xl font-sans"
      >
        {/* Left Anchor: Mascot Character Avatar */}
        <div
          className="shrink-0 cursor-pointer pr-1.5 flex items-center justify-center transition-all"
          onClick={() => {
            if (mode === 'compact') {
              setIsBotClicked(true);
              simulateNotification();
            } else if (mode === 'notification') {
              // Clicked on bot while notification is visible: toggles enlarged bot size!
              setIsBotClicked((prev) => !prev);
            } else {
              setMode('compact');
              setMood('idle');
              setIsBotClicked(false);
            }
          }}
          title={
            mode === 'notification'
              ? (isBotClicked ? 'Click to normal size' : 'Click to enlarge bot')
              : 'Click to expand'
          }
        >
          <CharacterAvatar
            mood={mood}
            size={avatarSize}
            notificationKey={activeNotification?.id}
          />
        </div>

        {/* Center / Body Section */}
        <div className="flex-1 flex items-center min-w-0 h-full overflow-hidden">
          <AnimatePresence mode="wait">
            {mode === 'compact' && (
              <motion.div
                key="compact"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="flex items-center justify-between w-full"
              >
                <div className="flex items-center gap-1.5 text-xs text-linear-text-primary font-medium tracking-tight">
                  <span className="w-1.5 h-1.5 rounded-full bg-linear-green" />
                  <span className="text-[11px] text-linear-text-primary">Soko Ready</span>
                </div>

                <div className="flex items-center gap-2 text-linear-text-tertiary">
                  <Bluetooth size={13} className={isConnected ? 'text-linear-brand' : 'text-linear-text-tertiary'} />
                  <button
                    onClick={onOpenSettings}
                    title="Open Settings"
                    className="p-1 rounded-md hover:bg-white/5 text-linear-text-secondary hover:text-linear-text-primary transition-colors"
                  >
                    <Settings size={13} />
                  </button>
                </div>
              </motion.div>
            )}

            {mode === 'notification' && activeNotification && (
              <NotificationBanner
                key="notification"
                notification={activeNotification}
                onDismiss={() => {
                  setMode('compact');
                  setMood('idle');
                  setIsBotClicked(false);
                }}
              />
            )}

            {mode === 'cli' && activeCli && (
              <CliStatusWidget
                key="cli"
                status={activeCli}
                onCancel={() => {
                  setMode('compact');
                  setMood('idle');
                }}
              />
            )}

            {mode === 'transfer' && activeTransfer && (
              <TransferProgress
                key="transfer"
                transfer={activeTransfer}
              />
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Floating Demo Toolbar (Linear minimalist badge) */}
      <div className="flex items-center gap-2 mt-2 opacity-35 hover:opacity-100 transition-opacity text-[11px] font-sans text-linear-text-secondary bg-[#08090A]/90 px-2.5 py-1 rounded-full border border-white/10 shadow-lg">
        <button onClick={simulateNotification} className="hover:text-linear-text-primary px-1 transition-colors">
          + Notif
        </button>
        <span className="text-white/20">•</span>
        <button onClick={simulateCli} className="hover:text-linear-brand px-1 transition-colors">
          + agy CLI
        </button>
        <span className="text-white/20">•</span>
        <button onClick={simulateTransfer} className="hover:text-linear-green px-1 transition-colors">
          + Send APK
        </button>
      </div>
    </div>
  );
};
