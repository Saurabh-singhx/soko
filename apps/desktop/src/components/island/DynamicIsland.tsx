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

  // Auto-collapse notification after 6 seconds if not interacted with
  useEffect(() => {
    if (mode === 'notification') {
      const timer = setTimeout(() => {
        setMode('compact');
        setMood('idle');
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

  // Dimensions based on mode
  const getIslandDimensions = () => {
    switch (mode) {
      case 'compact':
        return { width: 184, height: 38 };
      case 'notification':
        return { width: 380, height: 78 };
      case 'cli':
        return { width: 420, height: 96 };
      case 'transfer':
        return { width: 340, height: 76 };
    }
  };

  const dims = getIslandDimensions();

  // Test simulation trigger helpers for demo / local inspection
  const simulateNotification = () => {
    setActiveNotification({
      id: 'demo-1',
      appName: 'WhatsApp',
      packageName: 'com.whatsapp',
      title: 'Alex Developer',
      body: 'Hey, I pushed the new changes to main. Check agy!',
      timestamp: Date.now(),
    });
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
        className="relative bg-[#0A0A0C] border border-white/10 rounded-island shadow-island-glow flex items-center px-2.5 overflow-hidden backdrop-blur-3xl"
      >
        {/* Left Anchor: Mascot Character Avatar */}
        <div
          className="shrink-0 cursor-pointer pr-1.5"
          onClick={() => {
            if (mode === 'compact') {
              simulateNotification();
            } else {
              setMode('compact');
              setMood('idle');
            }
          }}
          title="Click to toggle mascot mood / test demo"
        >
          <CharacterAvatar mood={mood} size={28} />
        </div>

        {/* Center / Body Section */}
        <div className="flex-1 flex items-center min-w-0 h-full overflow-hidden">
          <AnimatePresence mode="wait">
            {mode === 'compact' && (
              <motion.div
                key="compact"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="flex items-center justify-between w-full"
              >
                <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[11px] text-zinc-300">Soko Ready</span>
                </div>

                <div className="flex items-center gap-2 text-zinc-500">
                  <Bluetooth size={13} className={isConnected ? 'text-cyan-400' : 'text-zinc-600'} />
                  <button
                    onClick={onOpenSettings}
                    title="Open Settings"
                    className="p-1 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
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

      {/* Floating Demo Toolbar (visible when hovering near top for easy previewing) */}
      <div className="flex items-center gap-2 mt-2 opacity-30 hover:opacity-100 transition-opacity text-[10px] text-zinc-400 bg-black/70 px-2 py-0.5 rounded-full border border-white/5">
        <button onClick={simulateNotification} className="hover:text-cyan-300 px-1">
          + Test Notif
        </button>
        <span>•</span>
        <button onClick={simulateCli} className="hover:text-amber-300 px-1">
          + Run agy
        </button>
        <span>•</span>
        <button onClick={simulateTransfer} className="hover:text-emerald-300 px-1">
          + Send APK
        </button>
      </div>
    </div>
  );
};
