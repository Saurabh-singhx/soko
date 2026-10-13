import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bluetooth, Settings, Music } from 'lucide-react';
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
  PairRequestPending,
  AudioStreamStatus,
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
  const [pendingPair, setPendingPair] = useState<PairRequestPending | null>(null);
  const [audioStatus, setAudioStatus] = useState<AudioStreamStatus>(
    connectionService.getAudioStatus()
  );

  const [isBotClicked, setIsBotClicked] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isIdleMascotOnly, setIsIdleMascotOnly] = useState(false);
  const idleTimerRef = useRef<any>(null);
  const islandRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-close Connection Popover when desktop window loses focus
  useEffect(() => {
    const cleanup = window.electronAPI?.onWindowBlur?.(() => {
      setIsConnectionPopoverOpen(false);
    });
    return () => {
      cleanup?.();
    };
  }, []);

  // Subscribe to live connection manager events
  useEffect(() => {
    const unsubStatus = connectionService.subscribeStatus((status, dev) => {
      setConnectionStatus(status);
      setPairedDevice(dev);
      setSasPin(connectionService.getSasPin());
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

    const unsubPair = connectionService.onPendingPair((pairReq) => {
      setPendingPair(pairReq);
      setMood('alert');
      setMode('pairing');
      setIsConnectionPopoverOpen(false);
    });

    const unsubAudio = connectionService.onAudioStatus((status) => {
      setAudioStatus(status);
    });

    return () => {
      unsubStatus();
      unsubNotif();
      unsubCli();
      unsubTransfer();
      unsubPair();
      unsubAudio();
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

  // Idle Mascot Mode Configuration & Timers
  const getIdleTimeoutMs = () => {
    try {
      const stored = localStorage.getItem('soko_idle_timeout');
      if (stored !== null) {
        const val = parseInt(stored, 10);
        if (!isNaN(val)) return val;
      }
    } catch {}
    return 60000; // Default: 60 seconds (1 minute) of inactivity
  };

  const resetIdleTimer = () => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }

    if (isIdleMascotOnly) {
      setIsIdleMascotOnly(false);
    }

    const timeoutMs = getIdleTimeoutMs();
    if (timeoutMs > 0 && mode === 'compact' && !isConnectionPopoverOpen && !isHovered) {
      idleTimerRef.current = setTimeout(() => {
        setIsIdleMascotOnly(true);
      }, timeoutMs);
    }
  };

  // Arm, disarm, or reset idle timer based on mode, popover, and hover state
  useEffect(() => {
    if (mode !== 'compact' || isConnectionPopoverOpen || isHovered) {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      if (mode !== 'compact' || isConnectionPopoverOpen) {
        setIsIdleMascotOnly(false);
      }
    } else {
      resetIdleTimer();
    }

    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };
  }, [mode, isConnectionPopoverOpen, isHovered]);

  // Synchronize with settings updates or instant preview triggers
  useEffect(() => {
    const handleSettingsChange = () => {
      resetIdleTimer();
    };

    const handlePreview = () => {
      setIsConnectionPopoverOpen(false);
      setIsIdleMascotOnly(true);
    };

    window.addEventListener('soko:idle-settings-changed', handleSettingsChange);
    window.addEventListener('soko:preview-mascot-mode', handlePreview);
    window.addEventListener('storage', handleSettingsChange);

    return () => {
      window.removeEventListener('soko:idle-settings-changed', handleSettingsChange);
      window.removeEventListener('soko:preview-mascot-mode', handlePreview);
      window.removeEventListener('storage', handleSettingsChange);
    };
  }, [mode, isConnectionPopoverOpen, isHovered]);

  // Window vertical sizing: Expand IMMEDIATELY (0ms) so popover/card has full height,
  // Shrink AFTER exit animation settles (300ms) so content is unmounted before clipping.
  // Window width stays rock-solid at 440px so horizontal center (islandX) NEVER moves.
  const currentWindowHeightRef = useRef(68);

  useEffect(() => {
    let timer: any = null;

    let targetH = 68;

    if (isConnectionPopoverOpen) {
      targetH = 520;
    } else if (isIdleMascotOnly) {
      targetH = 76;
    } else if (mode === 'notification') {
      const bodyLen = activeNotification?.body?.length || 0;
      const contentH = bodyLen > 160 ? 170 : bodyLen > 70 ? 120 : 76;
      targetH = contentH + 12;
    } else if (mode === 'cli') {
      targetH = 152;
    } else if (mode === 'transfer') {
      targetH = 110;
    } else if (mode === 'pairing') {
      targetH = 96;
    } else {
      targetH = 68;
    }

    const currentH = currentWindowHeightRef.current;

    if (targetH === currentH) {
      return;
    }

    if (targetH > currentH) {
      // Expanding vertically: immediately grant canvas height for expanding content
      window.electronAPI?.setWindowSize?.(440, targetH);
      currentWindowHeightRef.current = targetH;
    } else {
      // Shrinking vertically: keep window large while exit spring settles (300ms)
      timer = setTimeout(() => {
        window.electronAPI?.setWindowSize?.(440, targetH);
        currentWindowHeightRef.current = targetH;
      }, 300);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [mode, isConnectionPopoverOpen, activeNotification, isIdleMascotOnly]);

  // Critically damped Apple spring physics (Zero bounce, zero overshoot, zero shaking)
  const springTransition = {
    type: 'spring',
    stiffness: 260,
    damping: 32,
    mass: 0.8,
  };

  // Dynamic avatar size: significantly increased when idle or notification is visible & when clicked
  const getAvatarSize = () => {
    if (isIdleMascotOnly) {
      return 56;
    }
    if (mode === 'notification') {
      return isBotClicked ? 68 : 50;
    }
    if (mode === 'pairing') {
      return 46;
    }
    if (isBotClicked) {
      return 52;
    }
    return 42;
  };

  const avatarSize = getAvatarSize();

  // Dimensions based on mode (scaled up for enhanced visibility and touch/drag comfort, bounded by 420px max width)
  const getIslandDimensions = (): { width: number; height?: number } => {
    if (isIdleMascotOnly) {
      return { width: 68, height: 64 };
    }
    switch (mode) {
      case 'compact':
        return { width: isBotClicked ? 320 : 290, height: isBotClicked ? 62 : 54 };
      case 'pairing':
        return { width: 420, height: 80 };
      case 'notification': {
        // Comfortably sized pill, stretches vertically to fit content naturally
        return { width: isBotClicked ? 430 : 410, height: undefined };
      }
      case 'cli': {
        const hasMultiline = Boolean(activeCli?.output && activeCli.output.includes('\n'));
        return { width: 420, height: hasMultiline ? 136 : 96 };
      }
      case 'transfer':
        return { width: 420, height: 92 };
    }
  };

  const dims = getIslandDimensions();

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

  // Window dragging handlers (Electron OS window movement)
  const isDraggingRef = useRef(false);

  const handleDragStart = (e: React.MouseEvent) => {
    // Only drag on primary mouse button
    if (e.button !== 0) return;
    // Do not trigger window drag if clicking on buttons, avatar, inputs, or popovers
    if ((e.target as HTMLElement).closest('button, input, a, [data-no-drag]')) return;

    // Prevent native browser element/text drag ghost
    e.preventDefault();

    let lastX = e.screenX;
    let lastY = e.screenY;
    isDraggingRef.current = false;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      // If mouse button was released outside the window
      if (moveEvent.buttons !== 1) {
        handleMouseUp();
        return;
      }

      const deltaX = moveEvent.screenX - lastX;
      const deltaY = moveEvent.screenY - lastY;
      lastX = moveEvent.screenX;
      lastY = moveEvent.screenY;

      if (Math.abs(deltaX) > 0 || Math.abs(deltaY) > 0) {
        isDraggingRef.current = true;
        (window as any).electronAPI?.moveWindow?.(deltaX, deltaY);
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (isDraggingRef.current) {
        setTimeout(() => {
          isDraggingRef.current = false;
        }, 120);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input, a, [data-no-drag]')) return;
    (window as any).electronAPI?.resetPosition?.();
  };

  const handlePillClick = () => {
    if (isDraggingRef.current) return;
    if (isIdleMascotOnly) {
      resetIdleTimer();
      setMood('happy');
      setTimeout(() => {
        setMood('idle');
      }, 2500);
      return;
    }
    if (mode === 'compact') {
      setIsConnectionPopoverOpen((prev) => !prev);
    }
  };

  return (
    <div className="flex flex-col items-center justify-start w-full h-full pt-1 select-none">
      {/* Hidden Native File Input for Real Desktop File Selection */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Morphing Dynamic Island Pill */}
      <motion.div
        ref={islandRef}
        initial={false}
        animate={{
          width: dims.width,
          height: dims.height ?? 'auto',
        }}
        transition={springTransition}
        onMouseDown={handleDragStart}
        onDoubleClick={handleDoubleClick}
        onClick={handlePillClick}
        onMouseEnter={() => {
          setIsHovered(true);
          resetIdleTimer();
        }}
        onMouseMove={() => {
          if (isIdleMascotOnly) {
            resetIdleTimer();
          }
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          resetIdleTimer();
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`group relative bg-[#0B0D14]/90 border flex flex-col justify-center overflow-hidden backdrop-blur-3xl font-sans transition-colors duration-200 select-none ${
          isIdleMascotOnly
            ? 'px-1 items-center rounded-full border-white/20'
            : 'px-3.5 rounded-[30px] border-white/15'
        } ${
          isDragOver
            ? 'border-emerald-400 ring-2 ring-emerald-400/30 scale-[1.02]'
            : isHovered
            ? 'border-white/30'
            : ''
        } ${
          mode === 'compact'
            ? 'cursor-grab active:cursor-grabbing hover:scale-[1.01] items-center justify-center'
            : mode === 'notification'
            ? 'min-h-[68px] max-h-[min(75vh,520px)] justify-center py-2 cursor-default'
            : 'items-center py-2.5 cursor-default'
        }`}
        title={
          isDragOver
            ? 'Drop file here to transmit to phone!'
            : isIdleMascotOnly
            ? 'Soko Mascot — Hover or click to wake'
            : mode === 'compact'
            ? 'Soko Island — Drag to move • Double-click to center • Click to open Hub'
            : undefined
        }
      >
        {/* Subtle Top Grip Indicator - Absolute to avoid displacing vertical center */}
        {mode === 'compact' && !isIdleMascotOnly && (
          <div
            className="absolute top-1 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-white/20 group-hover:bg-white/40 transition-colors pointer-events-none"
            title="Drag to move • Double-click to center"
          />
        )}

        <div className={`flex items-center ${isIdleMascotOnly ? 'justify-center w-full h-full' : 'w-full my-auto'}`}>
          {/* Left Anchor: Mascot Character Avatar */}
          <div
            data-no-drag="true"
            className={`shrink-0 cursor-pointer flex items-center justify-center ${
              isIdleMascotOnly
                ? 'p-0 m-0'
                : 'pr-2.5 self-center my-auto'
            }`}
          onClick={(e) => {
            if (isIdleMascotOnly) {
              e.stopPropagation();
              resetIdleTimer();
              setMood('happy');
              setTimeout(() => {
                setMood('idle');
              }, 2500);
              return;
            }
            if (mode === 'compact') {
              e.stopPropagation();
              setIsConnectionPopoverOpen((prev) => !prev);
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
            isIdleMascotOnly
              ? 'Click to wake Soko'
              : mode === 'notification'
              ? (isBotClicked ? 'Click to normal size' : 'Click to enlarge bot')
              : 'Click to manage connection'
          }
        >
          <CharacterAvatar
            mood={mood}
            size={avatarSize}
            notificationKey={activeNotification?.id}
            isMusicPlaying={audioStatus.isPlaying || audioStatus.isStreamingToMobile}
            isIdleMascotOnly={isIdleMascotOnly}
          />
        </div>

        {/* Center / Body Section */}
        <AnimatePresence>
          {!isIdleMascotOnly && (
            <motion.div
              key="island-body-content"
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{
                opacity: 0,
                width: 0,
                transition: { duration: 0.16, ease: 'easeOut' },
              }}
              className="flex-1 min-w-0 flex items-center my-auto overflow-hidden"
            >
              <AnimatePresence mode="wait" initial={false}>
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
                {/* Centered Status and Music Indicator */}
                <div className="flex-1 flex items-center justify-center gap-2 min-w-0 px-1">
                  <div className="flex items-center gap-2 text-xs text-linear-text-primary font-medium tracking-tight whitespace-nowrap">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        connectionStatus === 'connected'
                          ? 'bg-linear-green'
                          : connectionStatus === 'scanning' || connectionStatus === 'connecting'
                          ? 'bg-linear-amber animate-ping'
                          : 'bg-linear-red'
                      }`}
                    />
                    <span className="text-[12px] text-linear-text-primary font-medium tracking-tight whitespace-nowrap">
                      {connectionStatus === 'connected'
                        ? 'Soko Ready'
                        : connectionStatus === 'scanning' || connectionStatus === 'connecting'
                        ? 'Connecting...'
                        : 'No Device'}
                    </span>
                  </div>

                  {/* Animated Dynamic Island Music Sign */}
                  {(audioStatus.isPlaying || audioStatus.isStreamingToMobile) && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono tracking-tight mx-1 shrink-0"
                      title={
                        audioStatus.isStreamingToMobile
                          ? `Streaming Desktop Audio to Mobile (${audioStatus.activeListeners || 1} connected)`
                          : 'Desktop Music / Audio Active'
                      }
                    >
                      <Music size={10} className="text-emerald-400 animate-pulse shrink-0" />
                      <div className="flex items-end gap-[2px] h-2.5 pb-[0.5px]">
                        <motion.span
                          className="w-[2px] bg-emerald-400 rounded-full"
                          animate={{ height: ['3px', '10px', '4px', '9px', '3px'] }}
                          transition={{ duration: 0.65, repeat: Infinity, ease: 'easeInOut' }}
                        />
                        <motion.span
                          className="w-[2px] bg-emerald-400 rounded-full"
                          animate={{ height: ['8px', '3px', '10px', '5px', '8px'] }}
                          transition={{ duration: 0.52, repeat: Infinity, ease: 'easeInOut' }}
                        />
                        <motion.span
                          className="w-[2px] bg-emerald-400 rounded-full"
                          animate={{ height: ['4px', '10px', '3px', '8px', '4px'] }}
                          transition={{ duration: 0.72, repeat: Infinity, ease: 'easeInOut' }}
                        />
                        <motion.span
                          className="w-[2px] bg-emerald-400 rounded-full"
                          animate={{ height: ['9px', '4px', '9px', '2px', '9px'] }}
                          transition={{ duration: 0.48, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      </div>
                    </motion.div>
                  )}
                </div>

                <div
                  className="flex items-center gap-1.5 text-linear-text-tertiary shrink-0 ml-auto"
                  data-no-drag="true"
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
                    className={`p-1.5 rounded-lg hover:bg-white/10 active:scale-90 transition-all duration-150 ${
                      connectionStatus === 'connected'
                        ? 'text-[#5E6AD2] hover:shadow-[0_0_10px_rgba(94,106,210,0.4)]'
                        : connectionStatus === 'scanning' || connectionStatus === 'connecting'
                        ? 'text-amber-400 animate-pulse'
                        : 'text-linear-text-tertiary opacity-70'
                    }`}
                  >
                    <Bluetooth size={15} />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenSettings();
                    }}
                    title="Open Settings"
                    className="p-1.5 rounded-lg hover:bg-white/10 active:scale-90 text-linear-text-secondary hover:text-white transition-all duration-150 hover:shadow-[0_0_10px_rgba(255,255,255,0.2)]"
                  >
                    <Settings size={15} />
                  </button>
                </div>
              </motion.div>
            )}

            {mode === 'notification' && activeNotification && (
              <NotificationBanner
                key="notification"
                notification={activeNotification}
                onDismiss={() => {
                  setActiveNotification(null);
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

            {mode === 'pairing' && pendingPair && (
              <motion.div
                key="pairing"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="flex items-center justify-between w-full select-none"
              >
                <div className="flex flex-col min-w-0 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 font-mono">
                      Link Request
                    </span>
                    <span className="text-white/30">•</span>
                    <span className="text-xs font-semibold text-white truncate max-w-[150px]">
                      {pendingPair.deviceName}
                    </span>
                  </div>
                  <div className="text-[11px] text-linear-text-secondary font-mono flex items-center gap-1.5 mt-0.5">
                    <span>PIN:</span>
                    <span className="text-emerald-400 font-bold bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.2 rounded">
                      {pendingPair.pin}
                    </span>
                    <span className="text-white/40 truncate text-[10px]">({pendingPair.model})</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0" data-no-drag="true">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      connectionService.approvePairing(pendingPair.deviceId, false);
                      setPendingPair(null);
                      setMode('compact');
                      setMood('idle');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 text-xs font-medium active:scale-95 transition-all"
                    title="Reject device connection"
                  >
                    Deny
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      connectionService.approvePairing(pendingPair.deviceId, true);
                      setPendingPair(null);
                      setMode('compact');
                      setMood('happy');
                    }}
                    className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold shadow-[0_0_12px_rgba(52,211,153,0.4)] active:scale-95 transition-all"
                    title="Approve device connection"
                  >
                    Approve
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
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
    </div>
  );
};
