import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bluetooth, Settings } from 'lucide-react';
import { CharacterAvatar } from './CharacterAvatar.tsx';
import { NotificationBanner } from './NotificationBanner.tsx';
import { CliStatusWidget } from './CliStatusWidget.tsx';
import { TransferProgress } from './TransferProgress.tsx';
import { ConnectionPopover } from './ConnectionPopover.tsx';
import { connectionService } from '../../services/connection.ts';
import {
  IslandMode,
  MascotMood,
  MirroredNotification,
  CliProcessStatus,
  FileTransferStatus,
  ConnectionStatus,
  PairedDevice,
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

  // Live connection state
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    connectionService.getStatus()
  );
  const [pairedDevice, setPairedDevice] = useState<PairedDevice | null>(
    connectionService.getActiveDevice()
  );
  const [sasPin, setSasPin] = useState(connectionService.getSasPin());
  const [isConnectionPopoverOpen, setIsConnectionPopoverOpen] = useState(false);

  // Active state payloads
  const [activeNotification, setActiveNotification] = useState<MirroredNotification | null>(null);
  const [activeCli, setActiveCli] = useState<CliProcessStatus | null>(null);
  const [activeTransfer, setActiveTransfer] = useState<FileTransferStatus | null>(null);

  const [isBotClicked, setIsBotClicked] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const islandRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Subscribe to live connection manager events
  useEffect(() => {
    const unsubStatus = connectionService.subscribeStatus((status, dev) => {
      setConnectionStatus(status);
      setPairedDevice(dev);
      if (status === 'disconnected') {
        setMood('searching');
      } else if (status === 'connected' && mode === 'compact') {
        setMood('idle');
      }
    });

    const unsubNotif = connectionService.onNotification((notif) => {
      setActiveNotification(notif);
      setMood('alert');
      setMode('notification');
      setIsConnectionPopoverOpen(false);
    });

    const unsubCli = connectionService.onCli((cli) => {
      setActiveCli(cli);
      setMood(cli.status === 'running' ? 'working' : 'happy');
      setMode('cli');
      setIsConnectionPopoverOpen(false);
    });

    const unsubTransfer = connectionService.onTransfer((transfer) => {
      setActiveTransfer(transfer);
      setMood(transfer.status === 'active' ? 'working' : 'happy');
      setMode('transfer');
      setIsConnectionPopoverOpen(false);
    });

    return () => {
      unsubStatus();
      unsubNotif();
      unsubCli();
      unsubTransfer();
    };
  }, [mode]);

  // Auto-collapse notification after delay if not actively hovered
  useEffect(() => {
    if (mode === 'notification') {
      if (isHovered) {
        return; // Pause auto-collapse so user can comfortably read large messages!
      }
      const bodyLen = activeNotification?.body?.length || 0;
      // Generous reading duration: 8s for short, 12s for medium, 18s for long messages
      const readDelay = bodyLen > 180 ? 18000 : bodyLen > 80 ? 12000 : 8000;
      const timer = setTimeout(() => {
        setMode('compact');
        setMood('idle');
        setIsBotClicked(false);
      }, readDelay);
      return () => clearTimeout(timer);
    }
  }, [mode, isHovered, activeNotification]);

  // Auto-collapse completed file transfer after 8s (paused when hovered so user can click Open / Folder)
  useEffect(() => {
    if (mode === 'transfer' && activeTransfer?.status === 'completed') {
      if (isHovered) return;
      const timer = setTimeout(() => {
        setMode('compact');
        setMood('idle');
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [mode, activeTransfer?.status, isHovered]);

  // Auto-collapse completed or failed CLI command after 6s (paused when hovered)
  useEffect(() => {
    if (mode === 'cli' && (activeCli?.status === 'completed' || activeCli?.status === 'failed')) {
      if (isHovered) return;
      const timer = setTimeout(() => {
        setMode('compact');
        setMood('idle');
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [mode, activeCli?.status, isHovered]);

  // Close notification / connection popover when clicking anywhere outside on screen or pressing Escape
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (islandRef.current && !islandRef.current.contains(e.target as Node)) {
        if (mode === 'notification') {
          setMode('compact');
          setMood('idle');
          setIsBotClicked(false);
        }
        setIsConnectionPopoverOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (mode === 'notification') {
          setMode('compact');
          setMood('idle');
          setIsBotClicked(false);
        }
        setIsConnectionPopoverOpen(false);
      }
    };

    const timer = setTimeout(() => {
      window.addEventListener('click', handleGlobalClick);
      window.addEventListener('keydown', handleKeyDown);
    }, 50);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mode]);

  // Fluid spring physics transition config (calibrated for silky Apple-style motion without stretching)
  const springTransition = {
    type: 'spring',
    stiffness: 280,
    damping: 26,
    mass: 0.7,
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

  // Dimensions based on mode:
  // Compact has fixed 42px height.
  // In notification mode, width stretches a bit for bigger notifications,
  // and height is dynamic/auto (undefined) to stretch vertically to fit message content naturally.
  const getIslandDimensions = (): { width: number; height?: number } => {
    switch (mode) {
      case 'compact':
        return { width: isBotClicked ? 212 : 196, height: isBotClicked ? 46 : 42 };
      case 'notification': {
        const bodyLen = activeNotification?.body?.length || 0;
        const isBig = bodyLen > 160;
        const isMedium = bodyLen > 70;

        // Stretches a little horizontally when notification is big (420px -> 470px -> 530px)
        const width = isBig
          ? (isBotClicked ? 560 : 530)
          : isMedium
          ? (isBotClicked ? 490 : 470)
          : (isBotClicked ? 440 : 420);

        // Height is undefined so container stretches vertically to fit content naturally,
        // up to screen limit max-h-[min(75vh,520px)] where scroll takes over.
        return { width, height: undefined };
      }
      case 'cli': {
        const hasMultiline = Boolean(activeCli?.output && activeCli.output.includes('\n'));
        return { width: 440, height: hasMultiline ? 116 : 82 };
      }
      case 'transfer':
        return { width: 360, height: 78 };
    }
  };

  const dims = getIslandDimensions();

  const DEMO_NOTIFICATIONS: MirroredNotification[] = [
    {
      id: 'demo-1',
      appName: 'WhatsApp',
      packageName: 'com.whatsapp',
      title: 'Alex Developer',
      body: 'Hey Saurabh! I tested the new APK build on Pixel 8 Pro and Galaxy S24 Ultra. The Bluetooth LE sync latency is under 18ms and notification mirroring handles long messages without any clipping. Great job on the ocular tracking!',
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
      appName: 'Linear',
      packageName: 'app.linear',
      title: 'SOKO-112: Comprehensive System Audit',
      body: `Full sprint changelog and release notes:
• Dynamic Island: Automatically stretches vertically to fit message content without scrolling.
• Horizontal scaling: Stretches smoothly from 420px to 530px for rich notifications.
• Kinetic Tracking: Mascot eye coordination responds realistically to notification events with zero jitter.
• Screen Limit Boundary: If a notification exceeds the screen limit, smooth vertical scrolling activates seamlessly.
• Bluetooth LE: Sub-18ms transmission latency verified across Pixel 8 Pro and Galaxy S24 Ultra.
• APK Deployment: Production signed APKs available in root apks/ directory.`,
      timestamp: Date.now(),
    },
    {
      id: 'demo-6',
      appName: 'Gmail',
      packageName: 'com.google.android.gm',
      title: 'Google Deepmind Dev Digest',
      body: 'Your weekly telemetry summary is ready: 99.8% BLE sync reliability across all devices, zero dropped frames in OLED mascot animations, and full cross-platform notification mirroring support.',
      timestamp: Date.now(),
    },
    {
      id: 'demo-7',
      appName: 'Discord',
      packageName: 'com.discord',
      title: '#announcements',
      body: 'Grok Bot face expressions are now fully live with 360° spin barrel rolls, left/right eye scanning, and OLED contrast styling!',
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

  const CLI_QUICK_COMMANDS = ['sysinfo', 'mem', 'disk', 'top-procs', 'git-status'];
  const [cliCmdIndex, setCliCmdIndex] = useState(0);

  const simulateCli = () => {
    const cmd = CLI_QUICK_COMMANDS[cliCmdIndex % CLI_QUICK_COMMANDS.length];
    setCliCmdIndex((prev) => prev + 1);
    setMood('working');
    setMode('cli');
    connectionService.executeCliCommand(cmd);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMood('working');
      setMode('transfer');
      connectionService.sendRealFile(file);
      e.target.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setMood('working');
      setMode('transfer');
      connectionService.sendRealFile(file);
    }
  };

  const simulateTransfer = () => {
    setMood('working');
    setMode('transfer');
    connectionService.sendTestTransfer('soko-v1.0.0-release.apk');
  };

  const handlePillClick = () => {
    if (mode === 'compact') {
      setIsBotClicked(true);
      simulateNotification();
    }
  };

  return (
    <div className="flex flex-col items-center justify-start w-full h-full pt-1">
      {/* Hidden Native File Input for Real Desktop APK / File Selection */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".apk,application/vnd.android.package-archive,*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Morphing Dynamic Island Pill */}
      <motion.div
        ref={islandRef}
        layout
        transition={springTransition}
        style={{
          width: dims.width,
          ...(dims.height !== undefined ? { height: dims.height } : {}),
        }}
        onClick={handlePillClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative bg-[#08090A] border rounded-[26px] shadow-linear-island flex px-2.5 overflow-hidden backdrop-blur-3xl font-sans transition-colors duration-200 ${
          isDragOver
            ? 'border-linear-green ring-2 ring-linear-green/30 scale-[1.02]'
            : ''
        } ${
          mode === 'compact'
            ? 'cursor-pointer border-white/10 hover:border-white/20 active:scale-[0.99] items-center'
            : mode === 'notification'
            ? 'border-white/10 min-h-[88px] max-h-[min(75vh,520px)] items-start py-2.5'
            : 'border-white/10 items-center py-2'
        }`}
        title={
          isDragOver
            ? 'Drop APK or file here to send instantly!'
            : mode === 'compact'
            ? 'Click anywhere to view notification (Drag & drop file to send)'
            : undefined
        }
      >
        {/* Left Anchor: Mascot Character Avatar */}
        <motion.div
          layout="position"
          transition={springTransition}
          className={`shrink-0 cursor-pointer pr-2 flex items-center justify-center ${
            mode === 'notification' ? 'self-start mt-1' : 'self-center my-auto'
          }`}
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
        </motion.div>

        {/* Center / Body Section */}
        <div
          className={`flex-1 min-w-0 ${
            mode === 'notification'
              ? 'pt-0.5'
              : 'flex items-center h-full overflow-hidden'
          }`}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {mode === 'compact' && (
              <motion.div
                key="compact"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{
                  opacity: 0,
                  scale: 0.94,
                  filter: 'blur(2px)',
                  transition: { duration: 0.12, ease: 'easeOut' },
                }}
                transition={{
                  duration: 0.22,
                  delay: 0.05,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="flex items-center justify-between w-full select-none"
              >
                <div className="flex items-center gap-1.5 text-xs text-linear-text-primary font-medium tracking-tight">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      connectionStatus === 'connected'
                        ? 'bg-linear-green'
                        : connectionStatus === 'scanning' || connectionStatus === 'connecting'
                        ? 'bg-linear-amber animate-ping'
                        : 'bg-linear-red'
                    }`}
                  />
                  <span className="text-[11px] text-linear-text-primary">
                    {connectionStatus === 'connected'
                      ? 'Soko Ready'
                      : connectionStatus === 'scanning' || connectionStatus === 'connecting'
                      ? 'Connecting...'
                      : 'No Device'}
                  </span>
                </div>

                <div
                  className="flex items-center gap-1 text-linear-text-tertiary"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsConnectionPopoverOpen((prev) => !prev);
                    }}
                    title={
                      connectionStatus === 'connected'
                        ? `Connected to ${pairedDevice?.name || 'Mobile Phone'}`
                        : connectionStatus === 'scanning' || connectionStatus === 'connecting'
                        ? 'Scanning for companion link...'
                        : 'Disconnected (Click to manage connection)'
                    }
                    className={`p-1 rounded-md hover:bg-white/5 transition-colors ${
                      connectionStatus === 'connected'
                        ? 'text-linear-brand'
                        : connectionStatus === 'scanning' || connectionStatus === 'connecting'
                        ? 'text-linear-amber animate-pulse'
                        : 'text-linear-text-tertiary opacity-70'
                    }`}
                  >
                    <Bluetooth size={13} />
                  </button>

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
                onCancel={() => {
                  connectionService.stopTransferSimulation();
                  connectionService.cancelTransfer(activeTransfer.id, activeTransfer.filename);
                  setActiveTransfer({
                    ...activeTransfer,
                    status: 'cancelled',
                  });
                  setMood('error');
                }}
                onRetry={() => {
                  connectionService.retryTransfer(activeTransfer.id, activeTransfer.filename);
                  setMood('working');
                }}
                onDismiss={() => {
                  setMode('compact');
                  setMood('idle');
                }}
              />
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Floating Connection Popover */}
      <AnimatePresence>
        {isConnectionPopoverOpen && (
          <ConnectionPopover
            status={connectionStatus}
            device={pairedDevice}
            sasPin={sasPin}
            onScanAndConnect={() => connectionService.scanAndConnect()}
            onDisconnect={() => connectionService.disconnectDevice()}
            onRegeneratePin={() => setSasPin(connectionService.regeneratePin())}
            onOpenSettings={() => {
              setIsConnectionPopoverOpen(false);
              onOpenSettings();
            }}
            onClose={() => setIsConnectionPopoverOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Floating Demo Toolbar (Linear minimalist badge) */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex items-center gap-2 mt-2 opacity-35 hover:opacity-100 transition-opacity text-[11px] font-sans text-linear-text-secondary bg-[#08090A]/90 px-2.5 py-1 rounded-full border border-white/10 shadow-lg"
      >
        <button onClick={simulateNotification} className="hover:text-linear-text-primary px-1 transition-colors">
          + Notif
        </button>
        <span className="text-white/20">•</span>
        <button onClick={simulateCli} className="hover:text-linear-brand px-1 transition-colors">
          + agy CLI
        </button>
        <span className="text-white/20">•</span>
        <button
          onClick={(e) => {
            if (e.altKey) {
              simulateTransfer();
            } else {
              fileInputRef.current?.click();
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            simulateTransfer();
          }}
          title="Click to select & send APK from desktop (Alt+Click or Right-Click for 52MB test)"
          className="hover:text-linear-green px-1 transition-colors"
        >
          + Send APK
        </button>
      </div>
    </div>
  );
};
