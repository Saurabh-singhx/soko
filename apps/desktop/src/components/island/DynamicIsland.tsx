import React, { useState, useEffect, useRef, useMemo, startTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Zap, Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { CharacterHost } from '../../characters/CharacterHost.tsx';
import { getActiveCharacter, getCharacterBackground, subscribeToCharacterChanges } from '../../characters/registry.ts';
import { CharacterDefinition } from '../../characters/types.ts';
import { NotificationBanner } from './NotificationBanner.tsx';
import { CliStatusWidget } from './CliStatusWidget.tsx';
import { TransferProgress } from './TransferProgress.tsx';
import { ConnectionPopover } from './ConnectionPopover.tsx';
import { connectionService } from '../../services/connection.ts';
import { getAgentProjectTheme } from '../../utils/agentTheme.ts';
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
  const [activeChar, setActiveChar] = useState<CharacterDefinition>(() => getActiveCharacter());

  // Listen to character updates across all windows in real time
  useEffect(() => {
    return subscribeToCharacterChanges((newId) => {
      setActiveChar(getActiveCharacter(newId));
    });
  }, []);

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
  const [activeSessionIndex, setActiveSessionIndex] = useState(0);

  // Completed Agent task notice state (holds message & highlighted tokens)
  const [completedTaskNotice, setCompletedTaskNotice] = useState<{
    message: string;
    tokensUsed?: number;
    agent?: string | null;
    name?: string | null;
    workspace?: string;
    workspaceName?: string;
    sessionId?: string;
    timestamp: number;
  } | null>(null);
  const completedTaskTimerRef = useRef<any>(null);

  const [isBotClicked, setIsBotClicked] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isCharging, setIsCharging] = useState(false);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [gitAction, setGitAction] = useState<'commit' | 'push' | null>(null);
  const gitTimerRef = useRef<any>(null);

  // Internet connectivity state listener
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setMood('happy');
      setTimeout(() => setMood('idle'), 4500);
    };
    const handleOffline = () => {
      setIsOnline(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Battery charging detection with hardware fallback
  useEffect(() => {
    let isMounted = true;
    let batteryObj: any = null;

    const updateChargingStatus = () => {
      if (!isMounted || !batteryObj) return;
      try {
        const charging = Boolean(batteryObj.charging);
        setIsCharging(charging);
      } catch {}
    };

    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        if (!isMounted) return;
        batteryObj = battery;
        updateChargingStatus();
        battery.addEventListener('chargingchange', updateChargingStatus);
        battery.addEventListener('levelchange', updateChargingStatus);
      }).catch(() => {
        // Battery API gracefully ignored on unsupported hardware
      });
    }

    return () => {
      isMounted = false;
      if (batteryObj) {
        try {
          batteryObj.removeEventListener('chargingchange', updateChargingStatus);
          batteryObj.removeEventListener('levelchange', updateChargingStatus);
        } catch {}
      }
    };
  }, []);

  // Git activity broadcast subscription
  useEffect(() => {
    return connectionService.subscribeGitActivity((event) => {
      if (gitTimerRef.current) {
        clearTimeout(gitTimerRef.current);
      }
      setGitAction(event.action);
      gitTimerRef.current = setTimeout(() => {
        setGitAction(null);
      }, 5000);
    });
  }, []);

  // Auto-detect git operations from agentStatus detail or activeCli
  useEffect(() => {
    const detail = (agentStatus?.detail || activeCli?.title || activeCli?.commandId || '').toLowerCase();
    if (detail.includes('git push') || detail.includes('pushing') || detail.includes('pushed')) {
      if (gitTimerRef.current) clearTimeout(gitTimerRef.current);
      setGitAction('push');
      gitTimerRef.current = setTimeout(() => setGitAction(null), 5000);
    } else if (detail.includes('git commit') || detail.includes('committing') || detail.includes('committed')) {
      if (gitTimerRef.current) clearTimeout(gitTimerRef.current);
      setGitAction('commit');
      gitTimerRef.current = setTimeout(() => setGitAction(null), 5000);
    }
  }, [agentStatus?.detail, activeCli?.title, activeCli?.commandId]);

  // Graceful player control persistence for 10s when playback is paused
  const [showRecentAudioControls, setShowRecentAudioControls] = useState(false);
  const recentAudioTimerRef = useRef<any>(null);

  useEffect(() => {
    if (audioStatus.isPlaying) {
      setShowRecentAudioControls(true);
      if (recentAudioTimerRef.current) {
        clearTimeout(recentAudioTimerRef.current);
        recentAudioTimerRef.current = null;
      }
    } else if (showRecentAudioControls) {
      recentAudioTimerRef.current = setTimeout(() => {
        setShowRecentAudioControls(false);
      }, 10000);
    }
    return () => {
      if (recentAudioTimerRef.current) {
        clearTimeout(recentAudioTimerRef.current);
      }
    };
  }, [audioStatus.isPlaying]);

  // Auto-carousel through concurrent active agent sessions when multiple are active
  useEffect(() => {
    if (!agentStatus?.activeSessions || agentStatus.activeSessions.length <= 1 || isHovered) {
      return;
    }
    const interval = setInterval(() => {
      setActiveSessionIndex((prev) => (prev + 1) % agentStatus.activeSessions!.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [agentStatus?.activeSessions, isHovered]);

  const currentSession = useMemo(() => {
    if (agentStatus?.activeSessions && agentStatus.activeSessions.length > 0) {
      const idx = activeSessionIndex % agentStatus.activeSessions.length;
      return agentStatus.activeSessions[idx] || agentStatus;
    }
    return agentStatus;
  }, [agentStatus, activeSessionIndex]);

  const isAgentRunning = Boolean(
    currentSession &&
    currentSession.agent &&
    (currentSession.status === 'working' || currentSession.status === 'thinking' || currentSession.status === 'waiting')
  );

  const currentSessionTheme = useMemo(() => {
    if (!currentSession) return null;
    return getAgentProjectTheme(
      currentSession.agent,
      currentSession.sessionId,
      currentSession.workspaceName,
      activeSessionIndex
    );
  }, [currentSession, activeSessionIndex]);

  const completedTaskTheme = useMemo(() => {
    if (!completedTaskNotice) return null;
    return getAgentProjectTheme(
      completedTaskNotice.agent || undefined,
      completedTaskNotice.sessionId,
      completedTaskNotice.workspaceName
    );
  }, [completedTaskNotice]);
  const [isIdleMascotOnly, setIsIdleMascotOnly] = useState(false);
  const idleTimerRef = useRef<any>(null);

  const isMultiSession = Boolean(
    (agentStatus && agentStatus.activeCount !== undefined && agentStatus.activeCount > 1) ||
    (agentStatus?.activeSessions && agentStatus.activeSessions.length > 1)
  );

  const effectiveDragging = isDragging || isDragOver;

  // Character-controlled atmospheric background for the active state
  const characterBg = useMemo(() => {
    return getCharacterBackground(activeChar, mood, {
      isMusicPlaying: audioStatus.isPlaying,
      isSleeping: isIdleMascotOnly,
      isDragging: effectiveDragging,
      isHovered,
      isCharging,
      isOnline,
      isMultiSession,
      gitAction,
    });
  }, [
    activeChar,
    mood,
    audioStatus.isPlaying,
    isIdleMascotOnly,
    effectiveDragging,
    isHovered,
    isCharging,
    isOnline,
    isMultiSession,
    gitAction,
  ]);

  // Dynamic eye and agent color for ambient backlight glow
  const activeEyeColor = useMemo(() => {
    if (isOnline === false || connectionStatus === 'disconnected' || mood === 'alert') {
      return '#EF4444'; // Red alert / disconnected / offline
    }
    if (effectiveDragging) {
      return '#FB923C'; // Dragging Neon Orange
    }
    if (gitAction === 'push') {
      return '#A855F7'; // Git Push Purple
    }
    if (gitAction === 'commit') {
      return '#2DD4BF'; // Git Commit Cyber Teal
    }
    if (agentStatus?.agent === 'antigravity' && (mood === 'working' || isAgentRunning)) {
      return '#38BDF8'; // Electric Sky Cyan for Google Antigravity
    }
    if (agentStatus?.agent === 'codex' && (mood === 'working' || isAgentRunning)) {
      return '#10A37F'; // Cyber Mint for OpenAI Codex
    }
    if (agentStatus?.agent === 'claude' && (mood === 'working' || isAgentRunning)) {
      return '#F59E0B'; // Sunset Amber for Anthropic Claude
    }
    if (mood === 'working') {
      return '#38BDF8'; // Active Working Sky Cyan
    }
    if (mood === 'thinking') {
      return '#818CF8'; // Cognitive Indigo
    }
    if (audioStatus.isPlaying) {
      return '#C084FC'; // Synthwave Violet for Music
    }
    if (mood === 'happy') {
      return '#34D399'; // Joyful Emerald
    }
    if (isCharging) {
      return '#FBBF24'; // Charging Amber / Lightning Gold
    }
    if (isMultiSession) {
      return '#6366F1'; // Multi-Session Neon Indigo
    }
    if (isHovered) {
      return '#7DD3FC'; // Soft Cyan Hover
    }
    return '#FFFFFF'; // OLED White
  }, [
    connectionStatus,
    mood,
    agentStatus?.agent,
    isAgentRunning,
    audioStatus.isPlaying,
    isOnline,
    gitAction,
    isCharging,
    effectiveDragging,
    isMultiSession,
    isHovered,
  ]);
  const islandRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isFileDialogOpenRef = useRef(false);
  const [measuredNotificationHeight, setMeasuredNotificationHeight] = useState<number | null>(null);

  // Stable refs to prevent unmount / teardown loops on hover or popover toggles
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const isConnectionPopoverOpenRef = useRef(isConnectionPopoverOpen);
  isConnectionPopoverOpenRef.current = isConnectionPopoverOpen;
  const isHoveredRef = useRef(isHovered);
  isHoveredRef.current = isHovered;

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
    if (timeoutMs > 0 && modeRef.current === 'compact' && !isConnectionPopoverOpenRef.current && !isHoveredRef.current) {
      const delay = Math.max(timeoutMs, gracePeriodMs || 0);
      idleTimerRef.current = setTimeout(() => {
        setIsIdleMascotOnly(true);
      }, delay);
    }
  };

  const resetIdleTimer = () => {
    wakeToNormalMode();
  };

  // Subscribe to live CLI Agent watcher status (Subscribed once on mount)
  useEffect(() => {
    const unsubAgent = connectionService.subscribeAgentActivity((status) => {
      startTransition(() => {
        setAgentStatus(status);
        if (!status) return;

        if (status.status === 'completed') {
          // Agent task is done! If in idle mode, wake Soko to normal mode immediately
          wakeToNormalMode(20000);
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
            workspace: status.workspace,
            workspaceName: status.workspaceName,
            sessionId: status.sessionId,
            timestamp: Date.now(),
          });

          if (completedTaskTimerRef.current) {
            clearTimeout(completedTaskTimerRef.current);
          }
          completedTaskTimerRef.current = setTimeout(() => {
            setCompletedTaskNotice(null);
          }, 20000);
        } else if (status.status === 'working' || status.status === 'thinking' || status.status === 'waiting') {
          // Active agent running or waiting: wake Soko to normal mode
          wakeToNormalMode(10000);
          setMood(status.status === 'working' ? 'working' : 'thinking');
          setCompletedTaskNotice(null);
        }
      });
    });
    return unsubAgent;
  }, []);

  // Dynamic status text: strictly event-driven, only changes when something is happening
  const dynamicStatusText = useMemo(() => {
    // 0. External file dragged over island (drop target)
    // Note: Moving the island window itself does NOT scramble the status text!
    if (isDragOver) {
      return 'Drop to send to phone';
    }

    // 0b. Git operations
    if (gitAction === 'push') {
      return '🚀 GitHub: Pushing changes...';
    }
    if (gitAction === 'commit') {
      return '📦 GitHub: Commit recorded';
    }

    // 0c. Offline state
    if (!isOnline) {
      return '⚠️ Internet Disconnected (Offline)';
    }

    // 1. File transfer in progress
    if (activeTransfer && activeTransfer.status === 'active') {
      return `Transferring ${activeTransfer.filename} (${activeTransfer.percentage}%)`;
    }

    // 2. CLI execution in progress
    if (activeCli && activeCli.status === 'running') {
      return `Running: ${activeCli.title}`;
    }

    // 3. Active CLI Agent execution (Google Antigravity, OpenAI Codex, Anthropic Claude)
    if (currentSession && currentSession.agent && (currentSession.status === 'working' || currentSession.status === 'thinking' || currentSession.status === 'waiting')) {
      const prefix = isMultiSession
        ? `⚡ [${(activeSessionIndex % (agentStatus?.activeSessions?.length || 1)) + 1}/${agentStatus?.activeSessions?.length || agentStatus?.activeCount}] ${currentSession.name || 'Agent'}`
        : currentSession.agent === 'antigravity'
        ? '⚡ Antigravity'
        : currentSession.agent === 'codex'
        ? '⚡ Codex'
        : '⚡ Claude';
      if (currentSession.status === 'waiting') {
        return `${prefix}: ${currentSession.detail || 'Waiting...'}`;
      }
      return `${prefix}: ${currentSession.detail || 'Thinking...'}`;
    }
    if (currentSession && currentSession.agent && currentSession.status === 'completed') {
      return `${currentSession.name || 'Agent'}: Done ✓`;
    }

    // 4. Audio playing / streaming (player controls rendered directly in HUD)
    if (audioStatus.isPlaying) {
      return audioStatus.title || (audioStatus.isStreamingToMobile ? 'Streaming to Phone' : `${audioStatus.activeApp || 'Audio'} Playing`);
    }
    if (audioStatus.isStreamingToMobile) {
      return 'Streaming audio to phone';
    }

    // 4b. Ambient battery charging connected
    if (isCharging) {
      return '⚡ Battery Charging Connected';
    }

    // 5. Connection states
    if (connectionStatus === 'scanning') {
      return 'Scanning for devices...';
    }
    if (connectionStatus === 'connecting') {
      return 'Connecting...';
    }
    if (connectionStatus === 'discovered') {
      return 'Wi-Fi Device Present • Pair';
    }
    if (connectionStatus === 'disconnected') {
      return 'Not Connected';
    }

    // 6. Connected & idle: simple small connected text
    return 'Connected';
  }, [
    effectiveDragging,
    isDragOver,
    gitAction,
    isOnline,
    isCharging,
    isMultiSession,
    activeSessionIndex,
    activeTransfer,
    activeCli,
    agentStatus,
    currentSession,
    audioStatus.isPlaying,
    audioStatus.isStreamingToMobile,
    audioStatus.title,
    connectionStatus,
    pairedDevice,
  ]);

  // Auto-close Connection Popover when desktop window loses focus,
  // but preserve popover while the native OS file picker is active
  useEffect(() => {
    const cleanup = window.electronAPI?.onWindowBlur?.(() => {
      if (isFileDialogOpenRef.current) {
        return;
      }
      setIsConnectionPopoverOpen(false);
    });

    const handleWindowFocus = () => {
      setTimeout(() => {
        isFileDialogOpenRef.current = false;
      }, 350);
    };

    window.addEventListener('focus', handleWindowFocus);

    return () => {
      cleanup?.();
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, []);

  // Proactively warm and synchronize AI token telemetry in background
  useEffect(() => {
    const unsubTokens = connectionService.subscribeTokenStats(() => {});
    return () => {
      unsubTokens();
    };
  }, []);

  // Subscribe to live connection manager events
  useEffect(() => {
    const unsubStatus = connectionService.subscribeStatus((status, dev) => {
      startTransition(() => {
        setConnectionStatus(status);
        setPairedDevice(dev);
        setSasPin(connectionService.getSasPin());
        if (status === 'disconnected') {
          setMood('searching');
        } else if (status === 'connected' && modeRef.current === 'compact') {
          setMood('idle');
        }
      });
    });

    const unsubNotif = connectionService.onNotification((notif) => {
      startTransition(() => {
        wakeToNormalMode();
        setActiveNotification(notif);
        setMood('alert');
        setMode('notification');
        setIsConnectionPopoverOpen(false);
      });
    });

    const unsubCli = connectionService.onCli((cli) => {
      startTransition(() => {
        wakeToNormalMode();
        setActiveCli(cli);
        setMood(cli.status === 'running' ? 'working' : 'happy');
        setMode('cli');
        setIsConnectionPopoverOpen(false);
      });
    });

    const unsubTransfer = connectionService.onTransfer((transfer) => {
      startTransition(() => {
        wakeToNormalMode();
        setActiveTransfer(transfer);
        setMood(transfer.status === 'active' ? 'working' : 'happy');
        setMode('transfer');
        setIsConnectionPopoverOpen(false);
      });
    });

    const unsubPair = connectionService.onPendingPair((pairReq) => {
      startTransition(() => {
        wakeToNormalMode();
        setPendingPair(pairReq);
        setMood('alert');
        setMode('pairing');
        setIsConnectionPopoverOpen(false);
      });
    });

    const unsubAudio = connectionService.onAudioStatus((status) => {
      startTransition(() => {
        setAudioStatus(status);
        if (status.isPlaying) {
          wakeToNormalMode();
        }
      });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        if (modeRef.current === 'notification') {
          setMode('compact');
          setMood('idle');
          setIsBotClicked(false);
        }
        setIsConnectionPopoverOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (modeRef.current === 'notification') {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Arm, disarm, or reset idle timer based on mode, popover, hover state, completedTaskNotice, music playback, and active agent
  useEffect(() => {
    if (
      mode !== 'compact' ||
      isConnectionPopoverOpen ||
      isHovered ||
      completedTaskNotice !== null ||
      audioStatus.isPlaying ||
      showRecentAudioControls ||
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
        audioStatus.isPlaying ||
        showRecentAudioControls ||
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
  }, [mode, isConnectionPopoverOpen, isHovered, completedTaskNotice, agentStatus?.status, agentStatus?.agent, audioStatus.isPlaying, showRecentAudioControls]);

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
  }, []);

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
          return { width: Math.min(420, width), height: isBotClicked ? 64 : 58 };
        }

        if (isAgentRunning && currentSession && currentSession.agent) {
          const detailLen = (currentSession.detail || currentSession.message || '').length;
          const hasWorkspace = Boolean(currentSession.workspaceName);
          let width = hasWorkspace ? 380 : 330;
          if (detailLen > 30) {
            width = 420;
          } else if (detailLen > 16) {
            width = 395;
          }
          if (isBotClicked) width = Math.min(430, width + 20);
          return { width: Math.min(420, width), height: isBotClicked ? 64 : 58 };
        }

        if (audioStatus.isPlaying || audioStatus.isStreamingToMobile || showRecentAudioControls) {
          const titleLen = (audioStatus.title || audioStatus.activeApp || '').length;
          let width = 380;
          if (titleLen > 25) {
            width = 420;
          } else if (titleLen > 15) {
            width = 400;
          } else if (audioStatus.isStreamingToMobile) {
            width = 390;
          }
          if (isBotClicked) width = Math.min(430, width + 20);
          return { width: Math.min(420, width), height: isBotClicked ? 64 : 58 };
        }

        if (currentSession && currentSession.agent && currentSession.status === 'completed') {
          const hasWorkspace = Boolean(currentSession.workspaceName);
          let width = hasWorkspace ? 370 : 320;
          if (isBotClicked) width = Math.min(430, width + 20);
          return { width: Math.min(420, width), height: isBotClicked ? 64 : 58 };
        }

        const textLen = dynamicStatusText?.length || 0;
        let baseWidth = textLen > 22 ? 320 : 260;
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

  // Critically damped Apple spring physics (Zero bounce, zero overshoot, zero shaking)
  const springTransition = {
    type: 'spring',
    stiffness: 260,
    damping: 32,
    mass: 0.8,
  };

  // Window sizing: Dynamically hugs visible island bounds (compact, sleep orb, notification, popover).
  // - Expand IMMEDIATELY (0ms) so popovers/cards have full canvas instantly.
  // - Shrink AFTER exit spring animation settles (240ms) so content finishes exit before window canvas shrinks.
  // - Eliminates any invisible click barriers on the left or right of the pill or sleep orb!
  const currentWindowWidthRef = useRef(0);
  const currentWindowHeightRef = useRef(0);

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
    let roTimer: ReturnType<typeof setTimeout> | null = null;
    const ro = new ResizeObserver(() => {
      // Debounce to break ResizeObserver → setState → resize → ResizeObserver feedback loop
      if (roTimer) clearTimeout(roTimer);
      roTimer = setTimeout(updateHeight, 60);
    });

    if (islandRef.current) {
      ro.observe(islandRef.current);
    }

    return () => {
      cancelAnimationFrame(frame);
      if (roTimer) clearTimeout(roTimer);
      ro.disconnect();
    };
  }, [mode, activeNotification]);

  useEffect(() => {
    let timer: any = null;

    // Stable window width for awake mode (380px) avoids X11 compositor repositioning/flicker
    // when toggling between compact pill and the 360px Connection Popover.
    // In sleep mode, window dynamically contracts to 74px to completely free up background clicks.
    let targetW = isIdleMascotOnly ? 74 : Math.max(380, dims.width + 4);
    let targetH = 68;

    if (isIdleMascotOnly) {
      targetW = 74;
      targetH = 72;
    } else if (isConnectionPopoverOpen) {
      targetW = Math.max(380, dims.width + 4);
      targetH = 580;
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
      targetW = Math.max(380, dims.width + 4);
    } else if (mode === 'cli') {
      targetH = 152;
      targetW = Math.max(380, dims.width + 4);
    } else if (mode === 'transfer') {
      targetH = 110;
      targetW = Math.max(380, dims.width + 4);
    } else if (mode === 'pairing') {
      targetH = 96;
      targetW = Math.max(380, dims.width + 4);
    } else {
      targetH = Math.max(54, (dims.height || 54) + 6);
      targetW = Math.max(380, dims.width + 4);
    }

    const currentW = currentWindowWidthRef.current;
    const currentH = currentWindowHeightRef.current;

    if (targetW === currentW && targetH === currentH) {
      return;
    }

    const isExpanding = targetW > currentW || targetH > currentH;

    if (isExpanding || currentW === 0) {
      // Expanding horizontally or vertically: immediately grant window canvas so content is never clipped
      window.electronAPI?.setWindowSize?.(targetW, targetH);
      currentWindowWidthRef.current = targetW;
      currentWindowHeightRef.current = targetH;
    } else {
      // Shrinking: wait for spring exit animation to settle before shrinking physical window canvas
      timer = setTimeout(() => {
        window.electronAPI?.setWindowSize?.(targetW, targetH);
        currentWindowWidthRef.current = targetW;
        currentWindowHeightRef.current = targetH;
      }, 240);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [
    mode,
    isConnectionPopoverOpen,
    activeNotification,
    isIdleMascotOnly,
    measuredNotificationHeight,
    isBotClicked,
    dims.width,
    dims.height,
  ]);

  const handleTriggerSendFile = () => {
    isFileDialogOpenRef.current = true;
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    isFileDialogOpenRef.current = false;
    const file = e.target.files?.[0];
    if (file) {
      setMood('working');
      setMode('transfer');
      setIsConnectionPopoverOpen(false);
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
        if (!isDraggingRef.current) {
          isDraggingRef.current = true;
          setIsDragging(true);
        }
        (window as any).electronAPI?.moveWindow?.(deltaX, deltaY);
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (isDraggingRef.current) {
        setTimeout(() => {
          isDraggingRef.current = false;
          setIsDragging(false);
        }, 120);
      } else {
        setIsDragging(false);
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
        onClick={(e) => {
          (e.target as HTMLInputElement).value = '';
        }}
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
        style={{
          background: characterBg || undefined,
          willChange: 'transform, opacity, width, height',
          backfaceVisibility: 'hidden',
        }}
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
            ? 'cursor-grab active:cursor-grabbing items-center justify-center'
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

        {/* Dynamic Eye-Color Ambient Backlight Aura behind Mascot */}
        {!isIdleMascotOnly && (
          <div
            className="absolute -left-6 top-1/2 -translate-y-1/2 w-32 h-32 rounded-full pointer-events-none transition-opacity duration-300 ease-out"
            style={{
              background: `radial-gradient(circle at center, ${activeEyeColor}2A 0%, transparent 70%)`,
            }}
          />
        )}

        <div className={`flex ${isIdleMascotOnly ? 'items-center justify-center w-full h-full' : mode === 'notification' ? 'items-start w-full' : 'items-center w-full my-auto'}`}>
          {/* Left Anchor: Mascot Character Avatar (Highest stacking layer to guarantee face is never overlapped) */}
          <div
            data-no-drag="true"
            className={`relative z-20 shrink-0 cursor-pointer flex items-center justify-center ${
              isIdleMascotOnly
                ? 'p-0 m-0'
                : mode === 'notification'
                ? 'pr-2.5 self-start pt-1'
                : 'pr-3 self-center my-auto'
            }`}
            style={{ minWidth: isIdleMascotOnly ? undefined : avatarSize }}
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
          <CharacterHost
            character={activeChar}
            mood={mood}
            size={avatarSize}
            notificationKey={activeNotification?.id}
            isMusicPlaying={audioStatus.isPlaying}
            isIdleMascotOnly={isIdleMascotOnly}
            connectionStatus={connectionStatus}
            activeAgent={agentStatus?.agent}
            agentStatus={agentStatus}
            isDragging={effectiveDragging}
            isHovered={isHovered}
            isCharging={isCharging}
            isOnline={isOnline}
            isMultiSession={isMultiSession}
            gitAction={gitAction}
          />
        </div>

        {/* Center / Body Section (Strictly bounds content to the right of avatar) */}
        <AnimatePresence>
          {!isIdleMascotOnly && (
            <motion.div
              key="island-body-content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{
                opacity: 0,
                transition: { duration: 0.15, ease: 'easeOut' },
              }}
              className={`relative z-10 flex-1 min-w-0 flex overflow-hidden ${mode === 'notification' ? 'items-start w-full' : 'items-center my-auto'}`}
            >
              <AnimatePresence mode="popLayout" initial={false}>
            {mode === 'compact' && (
              <motion.div
                key="compact"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{
                  opacity: 0,
                  scale: 0.98,
                  transition: { duration: 0.12, ease: 'easeOut' },
                }}
                transition={{
                  duration: 0.22,
                  delay: 0.05,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="flex items-center justify-start w-full select-none min-w-0 pr-1 overflow-hidden"
              >
                {completedTaskNotice ? (
                  <motion.div
                    key={`completed-${completedTaskNotice.sessionId || completedTaskNotice.agent || 'agent'}-${completedTaskNotice.workspaceName || ''}`}
                    initial={{ opacity: 0, y: 2 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -2 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="w-full flex flex-col justify-center min-w-0 pr-0.5 cursor-pointer group/msg"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsConnectionPopoverOpen((prev) => !prev);
                    }}
                    title={`${completedTaskNotice.message} • Click to manage`}
                  >
                    {/* Header Row: Done Check + Agent + Themed Project Badge + Tokens */}
                    <div className="flex items-center justify-between gap-1.5 w-full min-w-0 leading-none h-[18px]">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-3.5 h-3.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                          <Check size={9} className="text-emerald-400 stroke-[3]" />
                        </div>
                        <span className="text-[10px] font-semibold text-emerald-400 tracking-wide uppercase shrink-0">
                          {completedTaskNotice.name || completedTaskNotice.agent || 'Agent'}
                        </span>
                        {(() => {
                          const wsName = completedTaskNotice.workspaceName ||
                            (completedTaskNotice.workspace ? completedTaskNotice.workspace.split('/').filter(Boolean).pop() : '') ||
                            agentStatus?.workspaceName ||
                            'soko';
                          const wsPath = completedTaskNotice.workspace || agentStatus?.workspace || wsName;
                          return wsName && completedTaskTheme ? (
                            <span
                              className={`text-[9px] font-mono font-medium px-1.5 py-[1px] rounded border shrink-0 truncate max-w-[120px] transition-colors ${completedTaskTheme.bg} ${completedTaskTheme.text} ${completedTaskTheme.border}`}
                              title={`Project: ${wsName}\nPath: ${wsPath}`}
                            >
                              📁 {wsName}
                            </span>
                          ) : null;
                        })()}
                      </div>

                      {/* Right: Highlighted Tokens Used Badge */}
                      {completedTaskNotice.tokensUsed !== undefined && completedTaskNotice.tokensUsed > 0 && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenSettings('tokens');
                          }}
                          className="shrink-0 flex items-center gap-1 px-1.5 py-[1px] rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 font-mono text-[9.5px] font-semibold tracking-tight whitespace-nowrap ml-auto cursor-pointer active:scale-95 transition-all"
                          title={`Tokens used in this agent task: ${completedTaskNotice.tokensUsed.toLocaleString()} • Click to view Token Telemetry`}
                        >
                          <Zap size={9} className="text-emerald-300 fill-emerald-300 shrink-0" />
                          <span>{formatTokens(completedTaskNotice.tokensUsed)}</span>
                        </div>
                      )}
                    </div>

                    {/* Message Row: Full Width Clear Text */}
                    <div className="flex items-center gap-1.5 w-full min-w-0 mt-0.5 h-[18px] overflow-hidden">
                      <span
                        className="text-[12px] text-white/95 font-medium tracking-tight truncate min-w-0 flex-1 group-hover/msg:text-emerald-200 transition-colors"
                      >
                        {completedTaskNotice.message}
                      </span>
                    </div>
                  </motion.div>
                ) : (
                  /* Two-Tier Dynamic Island Status or Centered Connection */
                  <div
                    className="flex-1 flex flex-col justify-center min-w-0 px-1 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsConnectionPopoverOpen((prev) => !prev);
                    }}
                    title={
                      isAgentRunning && currentSession
                        ? `${currentSession.name || currentSession.agent}: ${currentSession.detail || 'In progress'} (${currentSession.workspaceName || agentStatus?.workspaceName || 'soko'}) • Click to manage`
                        : connectionStatus === 'connected'
                        ? `Connected to ${pairedDevice?.name || 'Phone'} • Click to manage`
                        : connectionStatus === 'discovered'
                        ? 'Wi-Fi Device Available • Click to Start Pairing'
                        : 'Click to connect a device'
                    }
                  >
                    <AnimatePresence mode="popLayout" initial={false}>
                      {isAgentRunning && currentSession && currentSession.agent ? (
                        <motion.div
                          key={`agent-${currentSession.sessionId || currentSession.agent}-${currentSession.workspaceName || agentStatus?.workspaceName || ''}`}
                          initial={{ opacity: 0, y: 2 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -2 }}
                          transition={{ duration: 0.18, ease: 'easeOut' }}
                          className="w-full flex flex-col justify-center min-w-0"
                        >
                          {/* Header Row: Agent Title + Project Badge + Multi-Agent Pill */}
                          <div className="flex items-center justify-between gap-1.5 w-full min-w-0 leading-none h-[18px]">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className={`text-[10px] font-semibold tracking-wide uppercase shrink-0 flex items-center gap-1 ${currentSessionTheme?.agentText || 'text-indigo-400'}`}>
                                <span>{currentSession.agent === 'antigravity' ? '⚡ Antigravity' : currentSession.agent === 'codex' ? '⚡ Codex' : '⚡ Claude'}</span>
                              </span>

                              {(() => {
                                const wsName = currentSession.workspaceName ||
                                  (currentSession.workspace ? currentSession.workspace.split('/').filter(Boolean).pop() : '') ||
                                  agentStatus?.workspaceName ||
                                  'soko';
                                const wsPath = currentSession.workspace || agentStatus?.workspace || wsName;
                                return wsName && currentSessionTheme ? (
                                  <span
                                    className={`text-[9px] font-mono font-medium px-1.5 py-[1px] rounded border shrink-0 truncate max-w-[120px] transition-colors ${currentSessionTheme.bg} ${currentSessionTheme.text} ${currentSessionTheme.border}`}
                                    title={`Project: ${wsName}\nPath: ${wsPath}`}
                                  >
                                    📁 {wsName}
                                  </span>
                                ) : null;
                              })()}
                            </div>

                            {/* Multi-Agent Concurrent Session Switcher Pill */}
                            {agentStatus && agentStatus.activeCount !== undefined && agentStatus.activeCount > 1 && (
                              <motion.button
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                whileTap={{ scale: 0.94 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (agentStatus.activeSessions && agentStatus.activeSessions.length > 0) {
                                    setActiveSessionIndex((prev) => (prev + 1) % agentStatus.activeSessions!.length);
                                  }
                                }}
                                className="flex items-center gap-1 px-1.5 py-[1px] rounded-full bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/35 text-cyan-300 text-[9px] font-mono tracking-tight shrink-0 transition-all cursor-pointer active:scale-95"
                                title={`${agentStatus.activeCount} CLI Agents Active • Click to switch displayed session`}
                              >
                                <span className="w-1 h-1 rounded-full bg-cyan-400 shrink-0" />
                                <span>{agentStatus.activeCount} agents</span>
                                <span className="text-cyan-400/60 text-[8.5px]">
                                  {(activeSessionIndex % (agentStatus.activeSessions?.length || 1)) + 1}/{(agentStatus.activeSessions?.length || agentStatus.activeCount)}
                                </span>
                              </motion.button>
                            )}
                          </div>

                          {/* Message Row: Full Width Clear Agent Action / Detail */}
                          <div className="flex items-center gap-1.5 w-full min-w-0 mt-0.5 h-[18px] overflow-hidden">
                            <span
                              className="text-[12px] text-white/95 font-medium tracking-tight truncate min-w-0 flex-1 hover:text-white transition-colors"
                              title={currentSession.detail || currentSession.message || (currentSession.status === 'waiting' ? 'Waiting for background task...' : 'Working on task...')}
                            >
                              {currentSession.detail || currentSession.message || (currentSession.status === 'waiting' ? 'Waiting for background task...' : 'Working on task...')}
                            </span>
                          </div>
                        </motion.div>
                      ) : (audioStatus.isPlaying || audioStatus.isStreamingToMobile || showRecentAudioControls) ? (
                        <motion.div
                          key="audio-player-controls"
                          initial={{ opacity: 0, y: 2 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -2 }}
                          transition={{ duration: 0.18, ease: 'easeOut' }}
                          className="w-full flex items-center justify-between gap-1.5 min-w-0 pr-0.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Left: Waveform Visualizer & Source Info */}
                          <div
                            className="flex items-center gap-1.5 min-w-0 overflow-hidden cursor-pointer group/audio flex-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsConnectionPopoverOpen((prev) => !prev);
                            }}
                            title={`${audioStatus.title ? `${audioStatus.title} • ` : ''}${audioStatus.activeApp || 'Desktop Audio'}${audioStatus.isStreamingToMobile ? ' • Streaming to Phone' : ''} • Click to manage`}
                          >
                            {/* Animated Equalizer Waveform Bars */}
                            <div className="flex items-end gap-[2px] h-3 pb-[1px] shrink-0">
                              <motion.span
                                className="w-[2px] rounded-full bg-emerald-400"
                                animate={audioStatus.isPlaying ? { height: ['3px', '11px', '4px', '10px', '3px'] } : { height: '3px' }}
                                transition={{ duration: 0.65, repeat: Infinity, ease: 'easeInOut' }}
                              />
                              <motion.span
                                className="w-[2px] rounded-full bg-emerald-400"
                                animate={audioStatus.isPlaying ? { height: ['8px', '3px', '12px', '5px', '8px'] } : { height: '5px' }}
                                transition={{ duration: 0.52, repeat: Infinity, ease: 'easeInOut' }}
                              />
                              <motion.span
                                className="w-[2px] rounded-full bg-emerald-400"
                                animate={audioStatus.isPlaying ? { height: ['4px', '12px', '3px', '9px', '4px'] } : { height: '3px' }}
                                transition={{ duration: 0.72, repeat: Infinity, ease: 'easeInOut' }}
                              />
                              <motion.span
                                className="w-[2px] rounded-full bg-emerald-400"
                                animate={audioStatus.isPlaying ? { height: ['10px', '4px', '11px', '2px', '10px'] } : { height: '4px' }}
                                transition={{ duration: 0.48, repeat: Infinity, ease: 'easeInOut' }}
                              />
                            </div>

                            {/* App / Stream Name / Song Title */}
                            <div className="flex flex-col min-w-0 leading-none">
                              <span
                                className="text-[11px] font-semibold text-white/95 truncate tracking-tight max-w-[125px] group-hover/audio:text-emerald-300 transition-colors"
                                title={audioStatus.title || audioStatus.activeApp || 'Music'}
                              >
                                {audioStatus.title || audioStatus.activeApp || 'Music'}
                              </span>
                              <span className="text-[8.5px] font-mono text-emerald-400/80 truncate mt-0.5">
                                {audioStatus.isStreamingToMobile
                                  ? '📱 To Phone'
                                  : audioStatus.isPlaying
                                  ? (audioStatus.title ? `♫ ${audioStatus.activeApp || 'Playing'}` : '♫ Now Playing')
                                  : '⏸ Paused'}
                              </span>
                            </div>
                          </div>

                          {/* Center: Playback Transport Controls (Prev, Play/Pause, Next) */}
                          <div className="flex items-center gap-0.5 shrink-0 bg-white/[0.06] border border-white/[0.08] px-1 py-0.5 rounded-full">
                            <button
                              data-no-drag="true"
                              onClick={(e) => {
                                e.stopPropagation();
                                connectionService.controlAudio('prev');
                              }}
                              className="p-1 rounded-full text-white/70 hover:text-white hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
                              title="Previous Track"
                            >
                              <SkipBack size={10} className="fill-current" />
                            </button>

                            <button
                              data-no-drag="true"
                              onClick={(e) => {
                                e.stopPropagation();
                                connectionService.controlAudio('play-pause');
                              }}
                              className="p-1 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black active:scale-90 transition-all cursor-pointer shadow-[0_0_8px_rgba(52,211,153,0.35)]"
                              title={audioStatus.isPlaying ? 'Pause' : 'Play'}
                            >
                              {audioStatus.isPlaying ? (
                                <Pause size={10} className="fill-current stroke-[2.5]" />
                              ) : (
                                <Play size={10} className="fill-current stroke-[2.5] ml-[0.5px]" />
                              )}
                            </button>

                            <button
                              data-no-drag="true"
                              onClick={(e) => {
                                e.stopPropagation();
                                connectionService.controlAudio('next');
                              }}
                              className="p-1 rounded-full text-white/70 hover:text-white hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
                              title="Next Track"
                            >
                              <SkipForward size={10} className="fill-current" />
                            </button>
                          </div>

                          {/* Right: Speaker Mute / Unmute Toggle */}
                          <div className="flex items-center shrink-0">
                            <button
                              data-no-drag="true"
                              onClick={(e) => {
                                e.stopPropagation();
                                connectionService.toggleSpeakerMute();
                              }}
                              className={`flex items-center gap-1 px-1.5 py-[3px] rounded-full text-[9.5px] font-mono font-medium transition-all active:scale-95 border cursor-pointer ${
                                audioStatus.isSpeakerMuted
                                  ? 'bg-rose-500/15 border-rose-500/35 text-rose-300 shadow-[0_0_8px_rgba(244,63,94,0.25)]'
                                  : 'bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10'
                              }`}
                              title={
                                audioStatus.isSpeakerMuted
                                  ? 'PC Speaker Muted • Click to Unmute'
                                  : audioStatus.isStreamingToMobile
                                  ? 'Mute PC Speaker (Audio plays on Phone)'
                                  : 'Mute PC Speaker'
                              }
                            >
                              {audioStatus.isSpeakerMuted ? (
                                <>
                                  <VolumeX size={11} className="text-rose-400 shrink-0" />
                                  <span>Muted</span>
                                </>
                              ) : (
                                <>
                                  <Volume2 size={11} className="text-emerald-400 shrink-0" />
                                  <span>Mute</span>
                                </>
                              )}
                            </button>
                          </div>
                        </motion.div>
                      ) : currentSession && currentSession.agent && currentSession.status === 'completed' ? (
                        <motion.div
                          key={`done-${currentSession.sessionId || currentSession.agent}-${currentSession.workspaceName || agentStatus?.workspaceName || ''}`}
                          initial={{ opacity: 0, y: 2 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -2 }}
                          transition={{ duration: 0.18, ease: 'easeOut' }}
                          className="w-full flex flex-col justify-center min-w-0"
                        >
                          {/* Header Row: Agent Name + Project Badge */}
                          <div className="flex items-center justify-between gap-1.5 w-full min-w-0 leading-none h-[18px]">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-[10px] font-semibold text-emerald-400 tracking-wide uppercase shrink-0 flex items-center gap-1">
                                <Check size={9} className="stroke-[3]" />
                                <span>{currentSession.name || 'Agent'}</span>
                              </span>

                              {(() => {
                                const wsName = currentSession.workspaceName ||
                                  (currentSession.workspace ? currentSession.workspace.split('/').filter(Boolean).pop() : '') ||
                                  agentStatus?.workspaceName ||
                                  'soko';
                                const wsPath = currentSession.workspace || agentStatus?.workspace || wsName;
                                return wsName && currentSessionTheme ? (
                                  <span
                                    className={`text-[9px] font-mono font-medium px-1.5 py-[1px] rounded border shrink-0 truncate max-w-[120px] transition-colors ${currentSessionTheme.bg} ${currentSessionTheme.text} ${currentSessionTheme.border}`}
                                    title={`Project: ${wsName}\nPath: ${wsPath}`}
                                  >
                                    📁 {wsName}
                                  </span>
                                ) : null;
                              })()}
                            </div>

                            <span className="text-[9.5px] font-mono text-emerald-400/90 font-medium shrink-0">Done ✓</span>
                          </div>

                          {/* Message Row */}
                          <div className="flex items-center gap-1.5 w-full min-w-0 mt-0.5 h-[18px] overflow-hidden">
                            <span
                              className="text-[12px] text-white/95 font-medium tracking-tight truncate min-w-0 flex-1"
                              title={currentSession.message || currentSession.taskSummary || currentSession.detail || 'Task completed successfully'}
                            >
                              {currentSession.message || currentSession.taskSummary || currentSession.detail || 'Task completed successfully'}
                            </span>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="default-status-pill"
                          initial={{ opacity: 0, y: 2 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -2 }}
                          transition={{ duration: 0.18, ease: 'easeOut' }}
                          className="w-full flex items-center justify-center"
                        >
                          <span className="text-[12px] text-linear-text-primary font-medium tracking-tight whitespace-nowrap truncate max-w-[280px] transition-colors duration-150">
                            {dynamicStatusText}
                          </span>
                        </motion.div>
                      )}
                    </AnimatePresence>
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
            onSendFile={handleTriggerSendFile}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
