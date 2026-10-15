import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, Check, Zap } from 'lucide-react';
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
  AgentActivityStatus,
} from '../../types/index.ts';

interface DynamicIslandProps {
  onOpenSettings: (tab?: string) => void;
}

const formatTokens = (tokens?: number): string => {
  if (!tokens || tokens <= 0) return '0 tokens';
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M tokens`;
  if (tokens >= 10000) return `${(tokens / 1000).toFixed(1)}k tokens`;
  return `${tokens.toLocaleString()} tokens`;
};

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
  const [agentStatus, setAgentStatus] = useState<AgentActivityStatus | null>(() =>
    connectionService.getAgentActivity()
  );

  // Completed Agent task notice state (holds message & highlighted tokens)
  const [completedTaskNotice, setCompletedTaskNotice] = useState<{
    message: string;
    tokensUsed?: number;
    agent?: string | null;
    name?: string | null;
    timestamp: number;
  } | null>(null);
  const completedTaskTimerRef = useRef<any>(null);

  const [isBotClicked, setIsBotClicked] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isIdleMascotOnly, setIsIdleMascotOnly] = useState(false);
  const idleTimerRef = useRef<any>(null);
  const islandRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [measuredNotificationHeight, setMeasuredNotificationHeight] = useState<number | null>(null);

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

  const wakeToNormalMode = (gracePeriodMs?: number) => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    setIsIdleMascotOnly(false);
    const timeoutMs = getIdleTimeoutMs();
    if (timeoutMs > 0 && mode === 'compact' && !isConnectionPopoverOpen && !isHovered) {
      const delay = Math.max(timeoutMs, gracePeriodMs || 0);
      idleTimerRef.current = setTimeout(() => {
        setIsIdleMascotOnly(true);
      }, delay);
    }
  };

  const resetIdleTimer = () => {
    wakeToNormalMode();
  };

  // Subscribe to live CLI Agent watcher status
  useEffect(() => {
    const unsubAgent = connectionService.subscribeAgentActivity((status) => {
      setAgentStatus(status);
      if (!status) return;

      if (status.status === 'completed') {
        // Agent task is done! If in idle mode, wake Soko to normal mode immediately
        wakeToNormalMode(25000);
        setMood('happy');
        setTimeout(() => {
          setMood((prev) => (prev === 'happy' ? 'idle' : prev));
        }, 4000);

        const taskMessage = status.message || status.detail || `${status.name || 'Agent'}: Task completed`;
        setCompletedTaskNotice({
          message: taskMessage,
          tokensUsed: status.tokensUsed,
          agent: status.agent,
          name: status.name,
          timestamp: Date.now(),
        });

        if (completedTaskTimerRef.current) {
          clearTimeout(completedTaskTimerRef.current);
        }
        completedTaskTimerRef.current = setTimeout(() => {
          setCompletedTaskNotice(null);
        }, 20000);
      } else if (status.status === 'working' || status.status === 'thinking') {
        // Active agent running: wake Soko to normal mode
        wakeToNormalMode(10000);
        setMood(status.status === 'working' ? 'working' : 'thinking');
        setCompletedTaskNotice(null);
      }
    });
    return unsubAgent;
  }, [mode, isConnectionPopoverOpen, isHovered]);

  // Dynamic status text: strictly event-driven, only changes when something is happening
  const dynamicStatusText = useMemo(() => {
    // 1. User dragging a file over the Island
    if (isDragOver) {
      return 'Drop to send to phone';
    }

    // 2. File transfer in progress
    if (activeTransfer && activeTransfer.status === 'active') {
      return `Transferring ${activeTransfer.filename} (${activeTransfer.percentage}%)`;
    }

    // 3. CLI execution in progress
    if (activeCli && activeCli.status === 'running') {
      return `Running: ${activeCli.title}`;
    }

    // 3b. Active CLI Agent execution (Google Antigravity, OpenAI Codex, Anthropic Claude)
    if (agentStatus && agentStatus.agent && (agentStatus.status === 'working' || agentStatus.status === 'thinking')) {
      const prefix = agentStatus.agent === 'antigravity'
        ? '⚡ Antigravity'
        : agentStatus.agent === 'codex'
        ? '⚡ Codex'
        : '⚡ Claude';
      return `${prefix}: ${agentStatus.detail || 'Thinking...'}`;
    }
    if (agentStatus && agentStatus.agent && agentStatus.status === 'completed') {
      return `${agentStatus.name || 'Agent'}: Done ✓`;
    }

    // 4. Audio streaming to phone
    if (audioStatus.isStreamingToMobile) {
      return audioStatus.isPlaying ? 'Streaming music to phone' : 'Streaming audio to phone';
    }

    // 5. Connection states
    if (connectionStatus === 'scanning') {
      return 'Scanning for devices...';
    }
    if (connectionStatus === 'connecting') {
      return 'Connecting...';
    }
    if (connectionStatus === 'disconnected') {
      return 'Not Connected';
    }

    // 6. Connected & idle: simple small connected text
    return 'Connected';
  }, [
    isDragOver,
    activeTransfer,
    activeCli,
    agentStatus,
    audioStatus.isStreamingToMobile,
    connectionStatus,
    pairedDevice,
  ]);

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
      wakeToNormalMode();
      setActiveNotification(notif);
      setMood('alert');
      setMode('notification');
      setIsConnectionPopoverOpen(false);
    });

    const unsubCli = connectionService.onCli((cli) => {
      wakeToNormalMode();
      setActiveCli(cli);
      setMood(cli.status === 'running' ? 'working' : 'happy');
      setMode('cli');
      setIsConnectionPopoverOpen(false);
    });

    const unsubTransfer = connectionService.onTransfer((transfer) => {
      wakeToNormalMode();
      setActiveTransfer(transfer);
      setMood(transfer.status === 'active' ? 'working' : 'happy');
      setMode('transfer');
      setIsConnectionPopoverOpen(false);
    });

    const unsubPair = connectionService.onPendingPair((pairReq) => {
      wakeToNormalMode();
      setPendingPair(pairReq);
      setMood('alert');
      setMode('pairing');
      setIsConnectionPopoverOpen(false);
    });

    const unsubAudio = connectionService.onAudioStatus((status) => {
      setAudioStatus(status);
    });

    const handleWakeEvent = () => {
      wakeToNormalMode();
    };
    window.addEventListener('soko:wake-to-normal-mode', handleWakeEvent);

    return () => {
      unsubStatus();
      unsubNotif();
      unsubCli();
      unsubTransfer();
      unsubPair();
      unsubAudio();
      window.removeEventListener('soko:wake-to-normal-mode', handleWakeEvent);
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

  // Auto-collapse completed, cancelled, or failed file transfer and clear activeTransfer
  useEffect(() => {
    if (!activeTransfer) return;
    if (activeTransfer.status === 'completed' || activeTransfer.status === 'cancelled' || activeTransfer.status === 'failed') {
      if (isHovered && mode === 'transfer') return;
      const delay = activeTransfer.status === 'completed' ? 6000 : 2500;
      const timer = setTimeout(() => {
        setActiveTransfer(null);
        if (mode === 'transfer') {
          setMode('compact');
          setMood('idle');
        }
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [mode, activeTransfer, isHovered]);

  // Safety watchdog: clear stale active transfer if no updates arrive within 6 seconds
  useEffect(() => {
    if (activeTransfer && activeTransfer.status === 'active') {
      const watchdog = setTimeout(() => {
        setActiveTransfer(null);
        if (mode === 'transfer') {
          setMode('compact');
          setMood('idle');
        }
      }, 6000);
      return () => clearTimeout(watchdog);
    }
  }, [activeTransfer, mode]);

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

  // Arm, disarm, or reset idle timer based on mode, popover, hover state, completedTaskNotice, and active agent
  useEffect(() => {
    if (
      mode !== 'compact' ||
      isConnectionPopoverOpen ||
      isHovered ||
      completedTaskNotice !== null ||
      (agentStatus && agentStatus.agent && agentStatus.status !== 'idle')
    ) {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      if (
        mode !== 'compact' ||
        isConnectionPopoverOpen ||
        completedTaskNotice !== null ||
        (agentStatus && agentStatus.agent && agentStatus.status !== 'idle')
      ) {
        setIsIdleMascotOnly(false);
      }
    } else {
      wakeToNormalMode();
    }

    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };
  }, [mode, isConnectionPopoverOpen, isHovered, completedTaskNotice, agentStatus?.status, agentStatus?.agent]);

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

  // Dynamically measure rendered notification height directly from the DOM
  useEffect(() => {
    if (mode !== 'notification') {
      setMeasuredNotificationHeight(null);
      return;
    }

    const updateHeight = () => {
      if (islandRef.current) {
        const rect = islandRef.current.getBoundingClientRect();
        const scrollH = islandRef.current.scrollHeight;
        const pillH = Math.max(rect.height, scrollH);
        if (pillH > 0) {
          // Window has pt-1 (4px). Add 20px transparent clearance so pill shadow & corners never touch window boundary.
          const neededWindowH = Math.ceil(pillH + 20);
          setMeasuredNotificationHeight((prev) => (prev !== neededWindowH ? neededWindowH : prev));
        }
      }
    };

    updateHeight();
    const frame = requestAnimationFrame(updateHeight);
    const ro = new ResizeObserver(() => {
      updateHeight();
    });

    if (islandRef.current) {
      ro.observe(islandRef.current);
    }

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [mode, activeNotification]);

  useEffect(() => {
    let timer: any = null;

    let targetH = 68;

    if (isConnectionPopoverOpen) {
      targetH = 520;
    } else if (isIdleMascotOnly) {
      targetH = 76;
    } else if (mode === 'notification') {
      const rawBody = (activeNotification?.body || '').trim();
      const paragraphs = rawBody ? rawBody.split('\n') : [''];
      let totalLines = 0;
      for (const p of paragraphs) {
        if (p.length === 0) {
          totalLines += 0.5;
        } else {
          totalLines += Math.max(1, Math.ceil(p.length / 36));
        }
      }
      // Base overhead:
      // Window pt-1 (4px) + pill pt-2.5 pb-3.5 (24px) + border (2px) + header (~26px) + gap (6px) + bottom clearance buffer (18px) = 80px
      // Plus 21px per line of text
      const calculatedH = Math.max(110, 80 + Math.ceil(totalLines * 21) + (isBotClicked ? 24 : 0));
      const measuredH = measuredNotificationHeight || 0;
      targetH = Math.min(320, Math.max(calculatedH, measuredH));
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
  }, [mode, isConnectionPopoverOpen, activeNotification, isIdleMascotOnly, measuredNotificationHeight, isBotClicked]);

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
      case 'compact': {
        if (completedTaskNotice) {
          const msgLen = completedTaskNotice.message?.length || 0;
          const hasTokens = Boolean(completedTaskNotice.tokensUsed && completedTaskNotice.tokensUsed > 0);
          let width = hasTokens ? 370 : 310;
          if (msgLen > 30) {
            width = 420;
          } else if (msgLen > 18) {
            width = 395;
          }
          if (isBotClicked) width = Math.min(430, width + 20);
          return { width: Math.min(420, width), height: isBotClicked ? 62 : 54 };
        }

        const textLen = dynamicStatusText?.length || 0;
        let baseWidth = 270;
        if (dynamicStatusText === 'Connected') {
          baseWidth = 230;
        } else if (dynamicStatusText === 'Not Connected') {
          baseWidth = 250;
        } else if (textLen > 24) {
          baseWidth = 320;
        } else if (textLen > 16) {
          baseWidth = 295;
        }
        if (isBotClicked) baseWidth += 30;
        return { width: Math.min(350, baseWidth), height: isBotClicked ? 62 : 54 };
      }
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
        className={`group relative bg-[#0B0D14]/90 border flex flex-col overflow-hidden backdrop-blur-3xl font-sans transition-colors duration-200 select-none ${
          isIdleMascotOnly
            ? 'px-1 items-center justify-center rounded-full border-white/20'
            : mode === 'notification'
            ? 'px-4 pt-2.5 pb-3.5 rounded-[24px] border-white/15'
            : 'px-3.5 py-2 rounded-[30px] border-white/15'
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
            ? 'min-h-[72px] max-h-[min(75vh,520px)] justify-start cursor-default'
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

        <div className={`flex ${isIdleMascotOnly ? 'items-center justify-center w-full h-full' : mode === 'notification' ? 'items-start w-full' : 'items-center w-full my-auto'}`}>
          {/* Left Anchor: Mascot Character Avatar */}
          <div
            data-no-drag="true"
            className={`shrink-0 cursor-pointer flex items-center justify-center ${
              isIdleMascotOnly
                ? 'p-0 m-0'
                : mode === 'notification'
                ? 'pr-2.5 self-start pt-1'
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
            isMusicPlaying={audioStatus.isPlaying}
            isIdleMascotOnly={isIdleMascotOnly}
            connectionStatus={connectionStatus}
            activeAgent={agentStatus?.agent}
            agentStatus={agentStatus}
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
              className={`flex-1 min-w-0 flex overflow-hidden ${mode === 'notification' ? 'items-start w-full' : 'items-center my-auto'}`}
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
                className="flex items-center justify-center w-full select-none min-w-0 pr-1"
              >
                {completedTaskNotice ? (
                  <motion.div
                    key={`completed-${completedTaskNotice.timestamp}`}
                    initial={{ opacity: 0, y: 3, filter: 'blur(2px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -3, filter: 'blur(2px)' }}
                    transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                    className="w-full flex items-center justify-between min-w-0 gap-2 pr-0.5"
                  >
                    {/* Left: Message with completion checkmark (strictly truncated, never overlaps right badge) */}
                    <div
                      className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden cursor-pointer group/msg"
                      title={`${completedTaskNotice.message} (Click to manage)`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsConnectionPopoverOpen((prev) => !prev);
                      }}
                    >
                      <div className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                        <Check size={10} className="text-emerald-400 stroke-[2.5]" />
                      </div>
                      <span className="text-[12px] text-white font-medium tracking-tight truncate min-w-0 flex-1 group-hover/msg:text-emerald-200 transition-colors">
                        {completedTaskNotice.message}
                      </span>
                    </div>

                    {/* Right: Highlighted Tokens Used Badge (strictly shrink-0, perfectly positioned on right) */}
                    {completedTaskNotice.tokensUsed !== undefined && completedTaskNotice.tokensUsed > 0 && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.22, delay: 0.05 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenSettings('tokens');
                        }}
                        className="shrink-0 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-emerald-500/20 via-teal-500/25 to-emerald-500/20 hover:from-emerald-500/30 hover:to-teal-500/35 border border-emerald-400/50 hover:border-emerald-300 text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.35)] font-mono text-[11px] font-semibold tracking-tight whitespace-nowrap ml-auto cursor-pointer active:scale-95 transition-all"
                        title={`Tokens used in this agent task: ${completedTaskNotice.tokensUsed.toLocaleString()} • Click to view Token Telemetry`}
                      >
                        <Zap size={10} className="text-emerald-300 fill-emerald-300 shrink-0 animate-pulse" />
                        <span>{formatTokens(completedTaskNotice.tokensUsed)}</span>
                      </motion.div>
                    )}
                  </motion.div>
                ) : (
                  /* Centered Status and Music Indicator */
                  <div className="flex-1 flex items-center justify-center gap-2 min-w-0 px-1">
                    <div
                      className="flex items-center text-xs text-linear-text-primary font-medium tracking-tight whitespace-nowrap cursor-pointer hover:text-white transition-colors min-w-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsConnectionPopoverOpen((prev) => !prev);
                      }}
                      title={
                        connectionStatus === 'connected'
                          ? `Connected to ${pairedDevice?.name || 'Phone'} • Click to manage`
                          : 'Click to connect a device'
                      }
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.span
                          key={dynamicStatusText}
                          initial={{ opacity: 0, y: 3, filter: 'blur(2px)' }}
                          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                          exit={{ opacity: 0, y: -3, filter: 'blur(2px)' }}
                          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                          className="text-[12px] text-linear-text-primary font-medium tracking-tight whitespace-nowrap truncate max-w-[260px] flex items-center gap-1.5"
                        >
                          {connectionStatus === 'connected' && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
                          )}
                          <span>{dynamicStatusText}</span>
                        </motion.span>
                      </AnimatePresence>
                    </div>

                    {/* Animated Dynamic Island Music Sign */}
                    {audioStatus.isPlaying && (
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
                )}
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
                  setTimeout(() => {
                    setActiveTransfer(null);
                    setMode('compact');
                    setMood('idle');
                  }, 2500);
                }}
                onRetry={() => {
                  connectionService.retryTransfer(activeTransfer.id, activeTransfer.filename);
                  setMood('working');
                }}
                onDismiss={() => {
                  setActiveTransfer(null);
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
            onDisconnect={() => connectionService.disconnectDevice()}
            onRegeneratePin={() => setSasPin(connectionService.regeneratePin())}
            onOpenSettings={(tab) => {
              setIsConnectionPopoverOpen(false);
              onOpenSettings(tab);
            }}
            onClose={() => setIsConnectionPopoverOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
