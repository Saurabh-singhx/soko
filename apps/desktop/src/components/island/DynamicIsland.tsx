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
  const [isHovered, setIsHovered] = useState(false);
  const [isNotificationExpanded, setIsNotificationExpanded] = useState(false);

  // Auto-collapse notification after delay if not actively hovered or expanded
  useEffect(() => {
    if (mode === 'notification') {
      if (isHovered || isNotificationExpanded) {
        return; // Pause auto-collapse so user can comfortably read large messages!
      }
      const bodyLen = activeNotification?.body?.length || 0;
      // Generous reading duration: 7.5s for short, 11s for medium, 15s for long messages
      const readDelay = bodyLen > 180 ? 15000 : bodyLen > 90 ? 11000 : 7500;
      const timer = setTimeout(() => {
        setMode('compact');
        setMood('idle');
        setIsBotClicked(false);
        setIsNotificationExpanded(false);
      }, readDelay);
      return () => clearTimeout(timer);
    }
  }, [mode, isHovered, isNotificationExpanded, activeNotification]);

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

  // Dimensions based on mode & bot enlargement & notification message scale
  const getIslandDimensions = () => {
    switch (mode) {
      case 'compact':
        return { width: isBotClicked ? 212 : 196, height: isBotClicked ? 46 : 42 };
      case 'notification': {
        const bodyLen = activeNotification?.body?.length || 0;
        const isLong = bodyLen > 100;
        const isVeryLong = bodyLen > 200;

        if (isNotificationExpanded) {
          return {
            width: 530,
            height: isVeryLong ? 168 : 148,
          };
        }

        if (isVeryLong) {
          return {
            width: isBotClicked ? 520 : 490,
            height: isBotClicked ? 134 : 122,
          };
        }

        if (isLong) {
          return {
            width: isBotClicked ? 476 : 450,
            height: isBotClicked ? 116 : 106,
          };
        }

        return {
          width: isBotClicked ? 440 : 410,
          height: isBotClicked ? 100 : 90,
        };
      }
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
      body: 'Hey Saurabh, I tested the new APK build on Pixel 8 Pro and Galaxy S24. The Bluetooth LE sync latency is under 18ms and notification mirroring handles long messages without any clipping. Great job on the ocular tracking!',
      timestamp: Date.now(),
    },
    {
      id: 'demo-2',
      appName: 'GitHub',
      packageName: 'com.github',
      title: 'Pull Request #42 Merged',
      body: 'feat(dynamic-island): Responsive multi-line layout engine for reading large notifications, authentic app brand icons, and 360° mascot spin animations.',
      timestamp: Date.now(),
    },
    {
      id: 'demo-3',
      appName: 'Slack',
      packageName: 'com.slack',
      title: 'Sarah Chen (#engineering)',
      body: '@channel Heads up: The new Dynamic Island full notification reader is live. You can now click anywhere on the compact pill to open notifications and read multi-line messages without clipping.',
      timestamp: Date.now(),
    },
    {
      id: 'demo-4',
      appName: 'Telegram',
      packageName: 'org.telegram.messenger',
      title: 'Soko Dev Community',
      body: 'Release v1.2.0 is out! Highlights: Full clickable Dynamic Island pill, enhanced ocular kinetic tracking, and responsive multi-line card layout for reading extensive notifications comfortably.',
      timestamp: Date.now(),
    },
    {
      id: 'demo-5',
      appName: 'Gmail',
      packageName: 'com.google.android.gm',
      title: 'Google Deepmind Dev Digest',
      body: 'Your weekly telemetry summary is ready: 99.8% BLE sync reliability across all devices, zero dropped frames in OLED mascot animations, and full cross-platform notification mirroring support.',
      timestamp: Date.now(),
    },
    {
      id: 'demo-6',
      appName: 'Discord',
      packageName: 'com.discord',
      title: '#announcements',
      body: 'Grok Bot face expressions are now fully live with 360° spin barrel rolls, left/right eye scanning, and OLED contrast styling!',
      timestamp: Date.now(),
    },
    {
      id: 'demo-7',
      appName: 'Linear',
      packageName: 'app.linear',
      title: 'SOKO-110 Completed',
      body: 'Dynamic Island interaction update: Click anywhere on compact pill to open full notification with adaptive height scaling and expansion controls.',
      timestamp: Date.now(),
    },
    {
      id: 'demo-8',
      appName: 'Antigravity',
      packageName: 'ai.antigravity.cli',
      title: 'agy Agent Finished',
      body: 'Workspace analysis completed with 0 warnings. Build artifacts generated and ready for deployment.',
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

  const handlePillClick = () => {
    if (mode === 'compact') {
      setIsBotClicked(true);
      simulateNotification();
    }
  };

  return (
    <div className="flex flex-col items-center justify-start w-full h-full pt-1">
      {/* Morphing Dynamic Island Pill */}
      <motion.div
        layout
        transition={springTransition}
        style={{ width: dims.width, height: dims.height }}
        onClick={handlePillClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`relative bg-[#08090A] border rounded-[26px] shadow-linear-island flex items-center px-2.5 overflow-hidden backdrop-blur-3xl font-sans transition-all ${
          mode === 'compact'
            ? 'cursor-pointer border-white/10 hover:border-white/20 active:scale-[0.99]'
            : 'border-white/10'
        }`}
        title={mode === 'compact' ? 'Click anywhere to view notification' : undefined}
      >
        {/* Left Anchor: Mascot Character Avatar */}
        <div
          className="shrink-0 cursor-pointer pr-1.5 flex items-center justify-center transition-all self-center"
          onClick={(e) => {
            if (mode === 'compact') {
              // Click anywhere on pill or mascot triggers notification
              setIsBotClicked(true);
              simulateNotification();
            } else if (mode === 'notification') {
              e.stopPropagation();
              // Clicked on bot while notification is visible: toggles enlarged bot size!
              setIsBotClicked((prev) => !prev);
            } else {
              e.stopPropagation();
              setMode('compact');
              setMood('idle');
              setIsBotClicked(false);
              setIsNotificationExpanded(false);
            }
          }}
          title={
            mode === 'notification'
              ? (isBotClicked ? 'Click to normal size' : 'Click to enlarge bot')
              : 'Click to open notification'
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
                className="flex items-center justify-between w-full select-none"
              >
                <div className="flex items-center gap-1.5 text-xs text-linear-text-primary font-medium tracking-tight">
                  <span className="w-1.5 h-1.5 rounded-full bg-linear-green" />
                  <span className="text-[11px] text-linear-text-primary">Soko Ready</span>
                </div>

                <div
                  className="flex items-center gap-2 text-linear-text-tertiary"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Bluetooth size={13} className={isConnected ? 'text-linear-brand' : 'text-linear-text-tertiary'} />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenSettings();
                    }}
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
                isExpanded={isNotificationExpanded}
                onToggleExpand={() => setIsNotificationExpanded((prev) => !prev)}
                onDismiss={() => {
                  setMode('compact');
                  setMood('idle');
                  setIsBotClicked(false);
                  setIsNotificationExpanded(false);
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
