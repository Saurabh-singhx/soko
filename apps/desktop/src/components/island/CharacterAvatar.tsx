import React, { useEffect, useState, useRef, useId } from 'react';
import { motion } from 'framer-motion';
import { MascotMood, ConnectionStatus, CliAgentId, AgentActivityStatus } from '../../types/index.ts';

interface CharacterAvatarProps {
  mood: MascotMood;
  size?: number;
  notificationKey?: string | number;
  isMusicPlaying?: boolean;
  isIdleMascotOnly?: boolean;
  enableCursorTracking?: boolean;
  connectionStatus?: ConnectionStatus;
  activeAgent?: CliAgentId;
  agentStatus?: AgentActivityStatus | null;
  isDragging?: boolean;
  isHovered?: boolean;
  isCharging?: boolean;
  isOnline?: boolean;
  isMultiSession?: boolean;
  gitAction?: 'commit' | 'push' | null;
}

/**
 * High-precision Gaze and Ocular Target State for Grok Bot.
 */
interface GazeTarget {
  name: string;
  // Eye group translation (gaze vector)
  gazeX: number;
  gazeY: number;

  // Left Eye Morph Parameters
  leftTopY: number;      // 16.0 = neutral open, 21.5 = squint, 26.8 = blink
  leftHeight: number;    // Anchored at BASE_BOTTOM (28.0)
  leftScaleX: number;    // 3D perspective distortion (0.90 to 1.04)
  leftTilt: number;      // Rotation in degrees around eye base

  // Right Eye Morph Parameters
  rightTopY: number;
  rightHeight: number;
  rightScaleX: number;
  rightTilt: number;

  // Head Pose (deliberate pose angle, NOT bouncing)
  headTilt: number;
}

// Global geometric constants for SVG (viewBox 0 0 44 44)
// Visor center is (22, 22). With BASE_BOTTOM = 28.0 and neutral top = 16.0,
// the eye center is (16 + 28)/2 = 22.0, aligning dead-center in the visor dome.
const BASE_BOTTOM = 28.0;
const LEFT_EYE_X = 12.5;   // Width 7.0 -> spans 12.5 to 19.5, center at 16.0
const RIGHT_EYE_X = 24.5;  // Width 7.0 -> spans 24.5 to 31.5, center at 28.0
const EYE_WIDTH = 7.0;
const EYE_RX = 3.5;        // Full pill capsule radius

/**
 * Neutral baseline gaze state.
 */
const NEUTRAL_TARGET: GazeTarget = {
  name: 'forward_focus',
  gazeX: 0,
  gazeY: 0,
  leftTopY: 16.0,
  leftHeight: 12.0,
  leftScaleX: 1.0,
  leftTilt: 0,
  rightTopY: 16.0,
  rightHeight: 12.0,
  rightScaleX: 1.0,
  rightTilt: 0,
  headTilt: 0,
};

/**
 * Library of realistic, organic Grok Bot eye states.
 */
const GAZE_VARIETIES: GazeTarget[] = [
  // 1. Forward Alert Focus
  {
    name: 'forward_focus',
    gazeX: 0,
    gazeY: 0,
    leftTopY: 16.0,
    leftHeight: 12.0,
    leftScaleX: 1.0,
    leftTilt: 0,
    rightTopY: 16.0,
    rightHeight: 12.0,
    rightScaleX: 1.0,
    rightTilt: 0,
    headTilt: 0,
  },
  // 2. Glance Left (Eyes shift left, 3D visor curvature compresses left eye)
  {
    name: 'glance_left',
    gazeX: -2.5,
    gazeY: -0.2,
    leftTopY: 16.0,
    leftHeight: 12.0,
    leftScaleX: 0.90,
    leftTilt: 0,
    rightTopY: 16.0,
    rightHeight: 12.0,
    rightScaleX: 1.03,
    rightTilt: 0,
    headTilt: 0,
  },
  // 3. Glance Right (Eyes shift right toward island body)
  {
    name: 'glance_right',
    gazeX: 2.8,
    gazeY: -0.2,
    leftTopY: 16.0,
    leftHeight: 12.0,
    leftScaleX: 1.03,
    leftTilt: 0,
    rightTopY: 16.0,
    rightHeight: 12.0,
    rightScaleX: 0.90,
    rightTilt: 0,
    headTilt: 0,
  },
  // 4. Inquisitive Smirk (Right eye half-closed strictly from TOP down, curious tilt)
  {
    name: 'inquisitive_right',
    gazeX: 1.4,
    gazeY: -0.3,
    leftTopY: 15.6,
    leftHeight: 12.4,
    leftScaleX: 1.02,
    leftTilt: 0,
    rightTopY: 21.5,
    rightHeight: 6.5,
    rightScaleX: 0.96,
    rightTilt: -5.5,
    headTilt: 2.5,
  },
  // 5. Inquisitive Left (Left eye half-closed strictly from TOP down)
  {
    name: 'inquisitive_left',
    gazeX: -1.4,
    gazeY: -0.3,
    leftTopY: 21.5,
    leftHeight: 6.5,
    leftScaleX: 0.96,
    leftTilt: 5.5,
    rightTopY: 15.6,
    rightHeight: 12.4,
    rightScaleX: 1.02,
    rightTilt: 0,
    headTilt: -2.5,
  },
  // 6. Thinking / Cognitive Search (Gaze up and slightly left, eyelids widen)
  {
    name: 'thinking_up',
    gazeX: -0.8,
    gazeY: -1.4,
    leftTopY: 15.0,
    leftHeight: 13.0,
    leftScaleX: 1.0,
    leftTilt: 0,
    rightTopY: 15.0,
    rightHeight: 13.0,
    rightScaleX: 1.0,
    rightTilt: 0,
    headTilt: -0.8,
  },
  // 7. Concentrated Squint (Both eyelids narrow slightly from top)
  {
    name: 'concentrated_squint',
    gazeX: 0,
    gazeY: 0.2,
    leftTopY: 19.5,
    leftHeight: 8.5,
    leftScaleX: 1.0,
    leftTilt: 0,
    rightTopY: 19.5,
    rightHeight: 8.5,
    rightScaleX: 1.0,
    rightTilt: 0,
    headTilt: 0,
  },
  // 8. Wide Alert / Perk (Discovery micro-expression)
  {
    name: 'wide_perk',
    gazeX: 0,
    gazeY: -0.4,
    leftTopY: 14.8,
    leftHeight: 13.2,
    leftScaleX: 1.05,
    leftTilt: 0,
    rightTopY: 14.8,
    rightHeight: 13.2,
    rightScaleX: 1.05,
    rightTilt: 0,
    headTilt: 0,
  },
  // 9. Relaxed / Chill (Both upper lids descend slightly)
  {
    name: 'relaxed_chill',
    gazeX: 0,
    gazeY: 0.4,
    leftTopY: 18.2,
    leftHeight: 9.8,
    leftScaleX: 1.0,
    leftTilt: 0,
    rightTopY: 18.2,
    rightHeight: 9.8,
    rightScaleX: 1.0,
    rightTilt: 0,
    headTilt: 0,
  },
];

/**
 * Realistic Ocular Engine for Grok-Bot.
 *
 * Core Features:
 * 1. Hard Screen Clipping: SVG clipPath (#grok-visor-screen) strictly bounds the visor screen.
 * 2. Optical Center Alignment: Baseline at (22, 22) with direct SVG attributes to guarantee visibility.
 * 3. Notification Varieties: Spin effects (360° roll), watching left-right at notification text, curious winks.
 * 4. Grounded Physical Stance: No whole-head rubber bouncing; intentional head poses only.
 * 5. Top-Down Eyelid Closure: Base bottom anchor remains fixed at BASE_BOTTOM (28.0) while the upper lid drops down.
 * 6. Ballistic Saccades & Rich Varieties: Instantaneous gaze shifts, horizontal scanning sweeps, and asymmetric curiosities.
 * 7. Autonomous Ear-Fin Kinematics: Fast micro-twitches that don't shake the head.
 */
export const CharacterAvatar: React.FC<CharacterAvatarProps> = ({
  mood,
  size = 32,
  notificationKey,
  isMusicPlaying = false,
  isIdleMascotOnly = false,
  enableCursorTracking,
  connectionStatus = 'disconnected',
  activeAgent,
  agentStatus,
  isDragging = false,
  isHovered = false,
  isCharging = false,
  isOnline = true,
  isMultiSession = false,
  gitAction = null,
}) => {
  const [currentTarget, setCurrentTarget] = useState<GazeTarget>(NEUTRAL_TARGET);
  const [isBlinking, setIsBlinking] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [leftEarTwitch, setLeftEarTwitch] = useState(false);
  const [rightEarTwitch, setRightEarTwitch] = useState(false);
  const [spinAngle, setSpinAngle] = useState(0);
  const [isSleeping, setIsSleeping] = useState(false);
  const [microSaccade, setMicroSaccade] = useState({ x: 0, y: 0 });

  const microSaccadeRafRef = useRef<number | null>(null);

  // Unique SVG def IDs (prevents collision when multiple instances render)
  const svgIdPrefix = useId();
  const visorClipId = `${svgIdPrefix}-visor-screen`;
  const visorGradientId = `${svgIdPrefix}-visor-black`;
  const rimGradientId = `${svgIdPrefix}-rim-mono`;
  const finGradientId = `${svgIdPrefix}-fin-mono`;
  const eyeBloomId = `${svgIdPrefix}-eye-bloom`;
  const musicGradientId = `${svgIdPrefix}-music-eq`;

  // Dynamic Connection Eye Color State Machine:
  // Disconnected -> #EF4444 (red)
  // Just connected -> #10B981 (green) for 4.5s -> #FFFFFF (normal white)
  const [eyeColor, setEyeColor] = useState<string>(() => {
    return connectionStatus === 'connected' ? '#FFFFFF' : '#EF4444';
  });

  // Agent-driven eye color & animation state
  const isAgentActive = Boolean(
    activeAgent &&
    agentStatus &&
    (agentStatus.status === 'working' || agentStatus.status === 'thinking' || agentStatus.status === 'waiting' || agentStatus.status === 'completed')
  );

  const agentColor = activeAgent === 'antigravity'
    ? '#38BDF8' // Electric Sky Cyan for Google Antigravity
    : activeAgent === 'codex'
    ? '#10A37F' // Cyber Emerald for OpenAI Codex
    : activeAgent === 'claude'
    ? '#F59E0B' // Sunset Amber for Anthropic Claude
    : null;

  // Resolve effective eye color across all system triggers
  let computedColor = eyeColor;
  if (isOnline === false || connectionStatus === 'disconnected' || mood === 'alert') {
    computedColor = '#EF4444';
  } else if (isDragging) {
    computedColor = '#FB923C';
  } else if (gitAction === 'push') {
    computedColor = '#A855F7';
  } else if (gitAction === 'commit') {
    computedColor = '#2DD4BF';
  } else if (isAgentActive && agentColor) {
    computedColor = agentColor;
  } else if (mood === 'working') {
    computedColor = '#38BDF8';
  } else if (mood === 'thinking') {
    computedColor = '#818CF8';
  } else if (isMusicPlaying) {
    computedColor = '#C084FC';
  } else if (mood === 'happy') {
    computedColor = '#34D399';
  } else if (isCharging) {
    computedColor = '#FBBF24';
  } else if (isMultiSession) {
    computedColor = '#6366F1';
  } else if (isHovered) {
    computedColor = '#7DD3FC';
  }

  const effectiveEyeColor = computedColor;

  const prevStatusRef = useRef<ConnectionStatus>(connectionStatus);
  const greenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connEarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (greenTimerRef.current) {
      clearTimeout(greenTimerRef.current);
      greenTimerRef.current = null;
    }
    if (connEarTimerRef.current) {
      clearTimeout(connEarTimerRef.current);
      connEarTimerRef.current = null;
    }

    if (connectionStatus === 'connected') {
      if (prevStatusRef.current !== 'connected') {
        // Transitioned from disconnected/connecting to connected -> turn GREEN for 4.5 seconds!
        setEyeColor('#10B981');
        // Full connection celebration choreography
        setSpinAngle(prev => prev + 360);
        setCurrentTarget({
          name: 'connection_celebration',
          gazeX: 0,
          gazeY: -0.5,
          leftTopY: 14.5,
          leftHeight: 13.5,
          leftScaleX: 1.06,
          leftTilt: 0,
          rightTopY: 14.5,
          rightHeight: 13.5,
          rightScaleX: 1.06,
          rightTilt: 0,
          headTilt: 0,
        });
        setLeftEarTwitch(true);
        setRightEarTwitch(true);
        connEarTimerRef.current = setTimeout(() => {
          setLeftEarTwitch(false);
          setRightEarTwitch(false);
        }, 500);
        greenTimerRef.current = setTimeout(() => {
          setEyeColor('#FFFFFF');
        }, 4500);
      } else {
        // Already connected
        setEyeColor((prev) => (prev === '#EF4444' ? '#FFFFFF' : prev));
      }
    } else if (connectionStatus === 'discovered') {
      // Discovered available nearby Wi-Fi device awaiting pairing -> turn Electric Cyan!
      setEyeColor('#38BDF8');
    } else {
      // Disconnected, scanning, or connecting -> turn RED!
      setEyeColor('#EF4444');
    }

    prevStatusRef.current = connectionStatus;

    return () => {
      if (greenTimerRef.current) clearTimeout(greenTimerRef.current);
      if (connEarTimerRef.current) clearTimeout(connEarTimerRef.current);
    };
  }, [connectionStatus]);

  // Local interactive cursor tracking state
  const [cursorTrackingActive, setCursorTrackingActive] = useState<boolean>(() => {
    if (enableCursorTracking !== undefined) return enableCursorTracking;
    try {
      return localStorage.getItem('soko_cursor_tracking') !== 'false';
    } catch {
      return true;
    }
  });
  const [isTrackingMouse, setIsTrackingMouse] = useState(false);

  const isTrackingMouseRef = useRef(false);
  const avatarContainerRef = useRef<HTMLDivElement>(null);
  const pointerRafRef = useRef<number | null>(null);
  const pointerIdleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saccadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notificationTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scanTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Listen for dynamic settings toggle from SettingsView
  useEffect(() => {
    if (enableCursorTracking !== undefined) {
      setCursorTrackingActive(enableCursorTracking);
      return;
    }
    const handleSettingChange = () => {
      try {
        setCursorTrackingActive(localStorage.getItem('soko_cursor_tracking') !== 'false');
      } catch {}
    };
    window.addEventListener('soko:cursor-tracking-changed', handleSettingChange);
    return () => window.removeEventListener('soko:cursor-tracking-changed', handleSettingChange);
  }, [enableCursorTracking]);

  // Local Island Cursor Tracking: Soko organically follows cursor with eyes & head tilt
  useEffect(() => {
    if (!cursorTrackingActive || mood !== 'idle' || isMusicPlaying) {
      if (isTrackingMouseRef.current) {
        isTrackingMouseRef.current = false;
        setIsTrackingMouse(false);
        setCurrentTarget(NEUTRAL_TARGET);
      }
      return;
    }

    const onPointerMove = (e: PointerEvent) => {
      if (pointerRafRef.current !== null) {
        cancelAnimationFrame(pointerRafRef.current);
      }

      pointerRafRef.current = requestAnimationFrame(() => {
        const avatarEl = avatarContainerRef.current;
        if (!avatarEl) return;

        const rect = avatarEl.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const dx = e.clientX - centerX;
        const dy = e.clientY - centerY;
        const dist = Math.hypot(dx, dy);

        // Smooth non-linear gaze mapping
        // dx saturation around 90px (spans the dynamic island body)
        // dy saturation around 40px
        const normalizedX = Math.tanh(dx / 90);
        const normalizedY = Math.tanh(dy / 40);

        const targetGazeX = normalizedX * 3.4;
        const targetGazeY = normalizedY * 1.9;

        // Subtle 3D perspective distortion (matching visor dome curvature)
        const leftScaleX = 1.0 + normalizedX * 0.04;
        const rightScaleX = 1.0 - normalizedX * 0.06;

        // Subtle organic head tilt towards cursor
        const headTilt = Math.tanh(dx / 110) * 3.2;

        // Proximity micro-morph: alert curious perk when cursor is directly over or near Soko
        const proximityFactor = Math.max(0, 1 - dist / 36);
        const topYOffset = proximityFactor * 0.9;

        isTrackingMouseRef.current = true;
        setIsTrackingMouse(true);

        setCurrentTarget({
          name: 'mouse_tracking',
          gazeX: Number(targetGazeX.toFixed(2)),
          gazeY: Number(targetGazeY.toFixed(2)),
          leftTopY: 16.0 - topYOffset,
          leftHeight: 12.0 + topYOffset,
          leftScaleX: Number(leftScaleX.toFixed(2)),
          leftTilt: 0,
          rightTopY: 16.0 - topYOffset,
          rightHeight: 12.0 + topYOffset,
          rightScaleX: Number(rightScaleX.toFixed(2)),
          rightTilt: 0,
          headTilt: Number(headTilt.toFixed(2)),
        });

        // Reset inactivity decay timer
        if (pointerIdleTimeoutRef.current !== null) {
          clearTimeout(pointerIdleTimeoutRef.current);
        }

        // If mouse rests stationary for > 3.0s, disengage and return to autonomous saccades
        pointerIdleTimeoutRef.current = setTimeout(() => {
          isTrackingMouseRef.current = false;
          setIsTrackingMouse(false);
          setCurrentTarget(NEUTRAL_TARGET);
        }, 3000);
      });
    };

    const onPointerExit = () => {
      if (pointerRafRef.current !== null) {
        cancelAnimationFrame(pointerRafRef.current);
        pointerRafRef.current = null;
      }
      if (pointerIdleTimeoutRef.current !== null) {
        clearTimeout(pointerIdleTimeoutRef.current);
        pointerIdleTimeoutRef.current = null;
      }
      if (isTrackingMouseRef.current) {
        isTrackingMouseRef.current = false;
        setIsTrackingMouse(false);
        setCurrentTarget(NEUTRAL_TARGET);
      }
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerleave', onPointerExit, { passive: true });
    document.addEventListener('mouseleave', onPointerExit, { passive: true });
    window.addEventListener('blur', onPointerExit, { passive: true });

    return () => {
      if (pointerRafRef.current !== null) cancelAnimationFrame(pointerRafRef.current);
      if (pointerIdleTimeoutRef.current !== null) clearTimeout(pointerIdleTimeoutRef.current);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerExit);
      document.removeEventListener('mouseleave', onPointerExit);
      window.removeEventListener('blur', onPointerExit);
    };
  }, [cursorTrackingActive, mood, isMusicPlaying]);

  const clearNotificationTimers = () => {
    notificationTimersRef.current.forEach((t) => clearTimeout(t));
    notificationTimersRef.current = [];
  };

  // 1. Notification Event Choreography: Spin Effect, Watch Right/Left, Curious Smirks
  useEffect(() => {
    if (mood !== 'alert') {
      clearNotificationTimers();
      return;
    }

    clearNotificationTimers();

    // Pick 1 of 4 distinct notification reaction choreographies
    const variant = Math.floor(Math.random() * 4);

    if (variant === 0) {
      // VARIETY A: 360 Spin Roll -> Snap Watch Right (reading text) -> Check Left -> Settle
      setSpinAngle((prev) => prev + 360);
      setLeftEarTwitch(true);
      setRightEarTwitch(true);

      const t1 = setTimeout(() => {
        // Eyes immediately dart right towards the notification body!
        setCurrentTarget({
          name: 'watch_notif_right',
          gazeX: 3.4,
          gazeY: -0.2,
          leftTopY: 15.2,
          leftHeight: 12.8,
          leftScaleX: 1.04,
          leftTilt: 0,
          rightTopY: 15.2,
          rightHeight: 12.8,
          rightScaleX: 0.94,
          rightTilt: 0,
          headTilt: 2.5,
        });
        setLeftEarTwitch(false);
        setRightEarTwitch(false);
      }, 350);

      const t2 = setTimeout(() => {
        // Turn eyes left to check surroundings / user
        setCurrentTarget({
          name: 'glance_left',
          gazeX: -2.6,
          gazeY: 0,
          leftTopY: 16.0,
          leftHeight: 12.0,
          leftScaleX: 0.90,
          leftTilt: 0,
          rightTopY: 16.0,
          rightHeight: 12.0,
          rightScaleX: 1.02,
          rightTilt: 0,
          headTilt: -1.5,
        });
      }, 1400);

      const t3 = setTimeout(() => {
        // Look back right at the notification with an inquisitive squint!
        setCurrentTarget({
          name: 'inquisitive_right',
          gazeX: 3.0,
          gazeY: -0.3,
          leftTopY: 15.6,
          leftHeight: 12.4,
          leftScaleX: 1.02,
          leftTilt: 0,
          rightTopY: 21.5,
          rightHeight: 6.5,
          rightScaleX: 0.96,
          rightTilt: -5.5,
          headTilt: 3.2,
        });
        triggerBlink();
      }, 2600);

      notificationTimersRef.current.push(t1, t2, t3);
    } else if (variant === 1) {
      // VARIETY B: Observant Scanner: Smooth scan sweep across text lines
      setCurrentTarget({
        name: 'scan_sweep_start',
        gazeX: -2.8,
        gazeY: -0.2,
        leftTopY: 16.2,
        leftHeight: 11.8,
        leftScaleX: 0.95,
        leftTilt: 0,
        rightTopY: 16.2,
        rightHeight: 11.8,
        rightScaleX: 0.95,
        rightTilt: 0,
        headTilt: -2.0,
      });

      const t1 = setTimeout(() => {
        // Smoothly scan all the way across to the right!
        setIsScanning(true);
        setCurrentTarget((prev) => ({
          ...prev,
          gazeX: 3.4,
          headTilt: 3.0,
        }));
      }, 300);

      const t2 = setTimeout(() => {
        setIsScanning(false);
        // Perk up with curious wink
        triggerBlink();
        setRightEarTwitch(true);
        const t2b = setTimeout(() => setRightEarTwitch(false), 300);
        notificationTimersRef.current.push(t2b);
      }, 1600);

      const t3 = setTimeout(() => {
        // Fix gaze right at the text with alert focus
        setCurrentTarget({
          name: 'alert_inspect',
          gazeX: 3.2,
          gazeY: 0,
          leftTopY: 15.0,
          leftHeight: 13.0,
          leftScaleX: 1.04,
          leftTilt: 0,
          rightTopY: 15.0,
          rightHeight: 13.0,
          rightScaleX: 0.94,
          rightTilt: 0,
          headTilt: 2.0,
        });
      }, 2400);

      notificationTimersRef.current.push(t1, t2, t3);
    } else if (variant === 2) {
      // VARIETY C: Double-Take: Snap right -> surprise blink -> 360 Spin!
      setCurrentTarget({
        name: 'watch_right_alert',
        gazeX: 3.5,
        gazeY: -0.4,
        leftTopY: 14.8,
        leftHeight: 13.2,
        leftScaleX: 1.05,
        leftTilt: 0,
        rightTopY: 14.8,
        rightHeight: 13.2,
        rightScaleX: 0.95,
        rightTilt: 0,
        headTilt: 4.0,
      });

      const t1 = setTimeout(() => {
        triggerBlink();
      }, 600);

      const t2 = setTimeout(() => {
        // Acrobatic flip on surprise!
        setSpinAngle((prev) => prev + 360);
      }, 1000);

      const t3 = setTimeout(() => {
        // Settles into inquisitive gaze looking at notification
        setCurrentTarget({
          name: 'inquisitive_right',
          gazeX: 2.8,
          gazeY: -0.2,
          leftTopY: 15.6,
          leftHeight: 12.4,
          leftScaleX: 1.02,
          leftTilt: 0,
          rightTopY: 21.5,
          rightHeight: 6.5,
          rightScaleX: 0.96,
          rightTilt: -5.5,
          headTilt: 2.8,
        });
      }, 1500);

      notificationTimersRef.current.push(t1, t2, t3);
    } else {
      // VARIETY D: Radar Perk: Ear-fin high vibration perk, wide eyes, glances left & right
      setLeftEarTwitch(true);
      setRightEarTwitch(true);
      const tEar = setTimeout(() => {
        setLeftEarTwitch(false);
        setRightEarTwitch(false);
      }, 400);
      notificationTimersRef.current.push(tEar);

      setCurrentTarget({
        name: 'wide_radar',
        gazeX: 3.2,
        gazeY: -0.2,
        leftTopY: 14.6,
        leftHeight: 13.4,
        leftScaleX: 1.06,
        leftTilt: 0,
        rightTopY: 14.6,
        rightHeight: 13.4,
        rightScaleX: 0.94,
        rightTilt: 0,
        headTilt: 2.2,
      });

      const t1 = setTimeout(() => {
        // Quick glance left
        setCurrentTarget((prev) => ({
          ...prev,
          gazeX: -2.8,
          headTilt: -2.2,
        }));
      }, 1200);

      const t2 = setTimeout(() => {
        // Snap back right to read
        setCurrentTarget((prev) => ({
          ...prev,
          gazeX: 3.2,
          headTilt: 2.5,
        }));
        triggerBlink();
      }, 2200);

      notificationTimersRef.current.push(t1, t2);
    }

    return () => {
      clearNotificationTimers();
    };
  }, [mood, notificationKey]);

  // 2. Biological Saccade & Variety Controller for Idle State
  useEffect(() => {
    if (mood !== 'idle' || isAgentActive) {
      setIsScanning(false);
      return;
    }

    const performSaccade = () => {
      // While mouse tracking is active, don't interrupt with random autonomous glances;
      // check back in 1.2s
      if (isTrackingMouseRef.current) {
        saccadeTimerRef.current = setTimeout(performSaccade, 1200);
        return;
      }

      const roll = Math.random();

      // 12% chance to execute an active horizontal scan sweep
      if (roll < 0.12) {
        setIsScanning(true);
        setCurrentTarget({
          name: 'scan_sweep',
          gazeX: -2.5,
          gazeY: 0,
          leftTopY: 17.0,
          leftHeight: 11.0,
          leftScaleX: 0.95,
          leftTilt: 0,
          rightTopY: 17.0,
          rightHeight: 11.0,
          rightScaleX: 0.95,
          rightTilt: 0,
          headTilt: 0,
        });

        // Scan across to the right after 450ms
        const st1 = setTimeout(() => {
          setCurrentTarget((prev) => ({
            ...prev,
            gazeX: 2.5,
          }));
        }, 450);

        // End scan sweep after 1300ms
        const st2 = setTimeout(() => {
          setIsScanning(false);
          setCurrentTarget(NEUTRAL_TARGET);
        }, 1300);
        scanTimersRef.current.push(st1, st2);

        saccadeTimerRef.current = setTimeout(performSaccade, 2000);
        return;
      }

      // Pick next target with weighted probability
      let nextTarget: GazeTarget;
      if (roll < 0.35) {
        // Forward neutral
        nextTarget = GAZE_VARIETIES[0];
      } else if (roll < 0.52) {
        // Glance Left
        nextTarget = GAZE_VARIETIES[1];
      } else if (roll < 0.68) {
        // Glance Right
        nextTarget = GAZE_VARIETIES[2];
      } else if (roll < 0.80) {
        // Inquisitive Smirk (Right eye top-down squint)
        nextTarget = GAZE_VARIETIES[3];
      } else if (roll < 0.88) {
        // Inquisitive Left
        nextTarget = GAZE_VARIETIES[4];
      } else if (roll < 0.94) {
        // Thinking Up
        nextTarget = GAZE_VARIETIES[5];
      } else {
        // Concentrated / Relaxed
        nextTarget = Math.random() > 0.5 ? GAZE_VARIETIES[6] : GAZE_VARIETIES[8];
      }

      setCurrentTarget(nextTarget);

      // Natural saccadic micro-blink (18% chance during gaze jump)
      if (Math.random() < 0.18) {
        triggerBlink();
      }

      // Responsive saccade duration: 1.0s to 2.2s (lively and active!)
      const nextDuration = 1000 + Math.random() * 1200;
      saccadeTimerRef.current = setTimeout(performSaccade, nextDuration);
    };

    performSaccade();

    return () => {
      if (saccadeTimerRef.current) clearTimeout(saccadeTimerRef.current);
      scanTimersRef.current.forEach(t => clearTimeout(t));
      scanTimersRef.current = [];
    };
  }, [mood, isAgentActive]);

  // 2c. Searching / Radar Scan Animation Controller
  useEffect(() => {
    if (mood !== 'searching') return;

    let step = 0;
    const radarInterval = setInterval(() => {
      step = (step + 1) % 4;
      if (step === 0) {
        // Sweep left
        setIsScanning(true);
        setCurrentTarget({
          name: 'search_sweep_left',
          gazeX: -3.2,
          gazeY: 0,
          leftTopY: 18.0,
          leftHeight: 10.0,
          leftScaleX: 0.92,
          leftTilt: 0,
          rightTopY: 18.0,
          rightHeight: 10.0,
          rightScaleX: 1.02,
          rightTilt: 0,
          headTilt: -2.5,
        });
      } else if (step === 1) {
        // Sweep right
        setCurrentTarget(prev => ({
          ...prev,
          name: 'search_sweep_right',
          gazeX: 3.2,
          headTilt: 2.5,
          leftScaleX: 1.02,
          rightScaleX: 0.92,
        }));
      } else if (step === 2) {
        setIsScanning(false);
        // Concentrated center check
        setCurrentTarget({
          name: 'search_center_check',
          gazeX: 0,
          gazeY: -0.6,
          leftTopY: 17.5,
          leftHeight: 10.5,
          leftScaleX: 1.0,
          leftTilt: 0,
          rightTopY: 17.5,
          rightHeight: 10.5,
          rightScaleX: 1.0,
          rightTilt: 0,
          headTilt: 0,
        });
        triggerBlink();
      } else {
        // Ear perk + wide alert
        setLeftEarTwitch(true);
        setRightEarTwitch(true);
        setTimeout(() => {
          setLeftEarTwitch(false);
          setRightEarTwitch(false);
        }, 350);
        setCurrentTarget({
          name: 'search_perk',
          gazeX: 0,
          gazeY: -0.8,
          leftTopY: 15.5,
          leftHeight: 12.5,
          leftScaleX: 1.03,
          leftTilt: 0,
          rightTopY: 15.5,
          rightHeight: 12.5,
          rightScaleX: 1.03,
          rightTilt: 0,
          headTilt: 0,
        });
      }
    }, 1100);

    return () => clearInterval(radarInterval);
  }, [mood]);

  // 2b. Agent Task Watcher Ocular Animation Controller
  useEffect(() => {
    if (!isAgentActive || !activeAgent || agentStatus?.status === 'idle') {
      return;
    }

    let intervalId: any = null;
    let step = 0;

    if (agentStatus?.status === 'completed') {
      setCurrentTarget({
        name: 'agent_completed',
        gazeX: 0,
        gazeY: -0.5,
        leftTopY: 15.0,
        leftHeight: 13.0,
        leftScaleX: 1.05,
        leftTilt: 0,
        rightTopY: 15.0,
        rightHeight: 13.0,
        rightScaleX: 1.05,
        rightTilt: 0,
        headTilt: 0,
      });
      setLeftEarTwitch(true);
      setRightEarTwitch(true);
      const t = setTimeout(() => {
        setLeftEarTwitch(false);
        setRightEarTwitch(false);
      }, 500);
      return () => clearTimeout(t);
    }

    if (agentStatus?.status === 'waiting') {
      // AGENT WAITING / SCHEDULED TASK CONTROLLER:
      // Patient, observant watch: eyes glance attentively with steady calm focus and micro-blinks
      intervalId = setInterval(() => {
        step = (step + 1) % 4;
        if (step === 0) {
          // Attentive observant glance toward the task
          setCurrentTarget({
            name: 'agent_waiting_attentive',
            gazeX: 1.8,
            gazeY: -0.6,
            leftTopY: 15.6,
            leftHeight: 12.4,
            leftScaleX: 1.02,
            leftTilt: 0,
            rightTopY: 15.6,
            rightHeight: 12.4,
            rightScaleX: 0.98,
            rightTilt: 0,
            headTilt: 1.5,
          });
        } else if (step === 1) {
          // Soft micro-blink while waiting
          triggerBlink();
        } else if (step === 2) {
          // Centered calm focus
          setCurrentTarget({
            name: 'agent_waiting_center',
            gazeX: 0,
            gazeY: -0.4,
            leftTopY: 16.0,
            leftHeight: 12.0,
            leftScaleX: 1.0,
            leftTilt: 0,
            rightTopY: 16.0,
            rightHeight: 12.0,
            rightScaleX: 1.0,
            rightTilt: 0,
            headTilt: 0,
          });
        } else {
          // Slight inquisitive curiosity perk
          setCurrentTarget({
            name: 'agent_waiting_perk',
            gazeX: -1.0,
            gazeY: -0.8,
            leftTopY: 15.2,
            leftHeight: 12.8,
            leftScaleX: 0.98,
            leftTilt: 0,
            rightTopY: 15.2,
            rightHeight: 12.8,
            rightScaleX: 1.02,
            rightTilt: 0,
            headTilt: -1.0,
          });
        }
      }, 1600);
      return () => {
        if (intervalId) clearInterval(intervalId);
      };
    }

    if (activeAgent === 'antigravity') {
      // GOOGLE ANTIGRAVITY ANIMATION:
      // High-speed cognitive analysis & tool execution:
      // Eyes rapidly sweep horizontally with analytical squints, reflecting code reasoning & tool execution!
      intervalId = setInterval(() => {
        step = (step + 1) % 4;
        if (step === 0) {
          setCurrentTarget({
            name: 'antigravity_inspect_left',
            gazeX: -2.6,
            gazeY: -0.3,
            leftTopY: 16.5,
            leftHeight: 11.5,
            leftScaleX: 0.94,
            leftTilt: 0,
            rightTopY: 16.5,
            rightHeight: 11.5,
            rightScaleX: 1.04,
            rightTilt: 0,
            headTilt: -1.5,
          });
        } else if (step === 1) {
          setIsScanning(true);
          setCurrentTarget({
            name: 'antigravity_scan_right',
            gazeX: 2.8,
            gazeY: -0.2,
            leftTopY: 15.8,
            leftHeight: 12.2,
            leftScaleX: 1.03,
            leftTilt: 0,
            rightTopY: 15.8,
            rightHeight: 12.2,
            rightScaleX: 0.93,
            rightTilt: 0,
            headTilt: 2.0,
          });
          setRightEarTwitch(true);
          setTimeout(() => setRightEarTwitch(false), 200);
        } else if (step === 2) {
          setIsScanning(false);
          setCurrentTarget({
            name: 'antigravity_squint',
            gazeX: 0,
            gazeY: 0.4,
            leftTopY: 18.2,
            leftHeight: 9.8,
            leftScaleX: 1.0,
            leftTilt: 0,
            rightTopY: 18.2,
            rightHeight: 9.8,
            rightScaleX: 1.0,
            rightTilt: 0,
            headTilt: 0,
          });
        } else {
          setCurrentTarget({
            name: 'antigravity_perk',
            gazeX: 0,
            gazeY: -0.8,
            leftTopY: 14.8,
            leftHeight: 13.2,
            leftScaleX: 1.05,
            leftTilt: 0,
            rightTopY: 14.8,
            rightHeight: 13.2,
            rightScaleX: 1.05,
            rightTilt: 0,
            headTilt: -0.5,
          });
        }
      }, 950);
    } else if (activeAgent === 'codex') {
      // OPENAI CODEX ANIMATION:
      // Rhythmic Matrix / Terminal Code-Stream Cadence:
      // Laser-focused forward gaze with synchronized, sharp code-pulse micro-blinks!
      intervalId = setInterval(() => {
        step = (step + 1) % 3;
        if (step === 0) {
          setCurrentTarget({
            name: 'codex_laser_focus',
            gazeX: 0,
            gazeY: 0,
            leftTopY: 16.0,
            leftHeight: 12.0,
            leftScaleX: 1.0,
            leftTilt: 0,
            rightTopY: 16.0,
            rightHeight: 12.0,
            rightScaleX: 1.0,
            rightTilt: 0,
            headTilt: 0,
          });
        } else if (step === 1) {
          triggerBlink();
          setLeftEarTwitch(true);
          setTimeout(() => setLeftEarTwitch(false), 150);
        } else {
          setCurrentTarget({
            name: 'codex_concentrated',
            gazeX: 0.8,
            gazeY: 0.2,
            leftTopY: 17.5,
            leftHeight: 10.5,
            leftScaleX: 1.0,
            leftTilt: 0,
            rightTopY: 17.5,
            rightHeight: 10.5,
            rightScaleX: 1.0,
            rightTilt: 0,
            headTilt: 1.0,
          });
        }
      }, 750);
    } else if (activeAgent === 'claude') {
      // ANTHROPIC CLAUDE ANIMATION:
      // Calm, deep philosophical contemplation & reasoning:
      // Smooth, wide reflective gaze with slow warm breathing pulses and gentle curious tilts!
      intervalId = setInterval(() => {
        step = (step + 1) % 2;
        if (step === 0) {
          setCurrentTarget({
            name: 'claude_thinking_up',
            gazeX: -1.0,
            gazeY: -1.2,
            leftTopY: 15.0,
            leftHeight: 13.0,
            leftScaleX: 1.02,
            leftTilt: 0,
            rightTopY: 15.0,
            rightHeight: 13.0,
            rightScaleX: 1.02,
            rightTilt: 0,
            headTilt: -2.0,
          });
        } else {
          setCurrentTarget({
            name: 'claude_contemplation',
            gazeX: 1.2,
            gazeY: -0.4,
            leftTopY: 15.5,
            leftHeight: 12.5,
            leftScaleX: 1.0,
            leftTilt: 0,
            rightTopY: 15.5,
            rightHeight: 12.5,
            rightScaleX: 1.0,
            rightTilt: 0,
            headTilt: 1.5,
          });
        }
      }, 1800);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isAgentActive, activeAgent, agentStatus?.status]);

  // 3. Realistic Eyelid Blink Engine (Ballistic Descent, Spring Reopen & Double-Blink)
  const triggerBlink = () => {
    setIsBlinking(true);

    // Fast eyelid close (45ms), then reopen (85ms)
    setTimeout(() => {
      setIsBlinking(false);

      // 14% chance of organic double-blink
      if (Math.random() < 0.14) {
        setTimeout(() => {
          setIsBlinking(true);
          setTimeout(() => setIsBlinking(false), 55);
        }, 100);
      }
    }, 85);
  };

  useEffect(() => {
    const scheduleBlink = () => {
      // Gamma-like distribution: natural blink clustering with occasional long pauses
      const u1 = Math.random();
      const u2 = Math.random();
      const gamma = -Math.log(u1) * 1200; // Exponential component for clustering
      const base = mood === 'alert' ? 1800 : 2200;
      const interval = base + Math.min(gamma + u2 * 800, 5000); // Cap at 5s max pause
      blinkTimerRef.current = setTimeout(() => {
        triggerBlink();
        scheduleBlink();
      }, interval);
    };

    scheduleBlink();

    return () => {
      if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current);
    };
  }, [mood]);

  // 4. Independent Ear-Fin Antenna Twitch Routine
  useEffect(() => {
    const scheduleTwitch = () => {
      const delay = (mood === 'alert' ? 2500 : 3800) + Math.random() * 2600;
      const timer = setTimeout(() => {
        if (Math.random() > 0.5) {
          setLeftEarTwitch(true);
          setTimeout(() => setLeftEarTwitch(false), 260);
        } else {
          setRightEarTwitch(true);
          setTimeout(() => setRightEarTwitch(false), 260);
        }
        scheduleTwitch();
      }, delay);
      return timer;
    };

    const timer = scheduleTwitch();
    return () => clearTimeout(timer);
  }, [mood]);

  // 5. Organic Micro-Saccade Tremor (continuous subtle eye jitter for lifelike feel)
  useEffect(() => {
    if (isSleeping) {
      setMicroSaccade({ x: 0, y: 0 });
      return;
    }

    let lastUpdate = 0;
    const JITTER_INTERVAL = 50; // ~20Hz update rate

    const jitterLoop = (timestamp: number) => {
      if (timestamp - lastUpdate > JITTER_INTERVAL) {
        lastUpdate = timestamp;
        setMicroSaccade({
          x: (Math.random() - 0.5) * 0.3,
          y: (Math.random() - 0.5) * 0.2,
        });
      }
      microSaccadeRafRef.current = requestAnimationFrame(jitterLoop);
    };

    microSaccadeRafRef.current = requestAnimationFrame(jitterLoop);

    return () => {
      if (microSaccadeRafRef.current !== null) {
        cancelAnimationFrame(microSaccadeRafRef.current);
      }
    };
  }, [isSleeping]);

  // 6. Sleep Mode Controller (activates after 5 minutes of idle)
  useEffect(() => {
    if (mood !== 'idle' || isMusicPlaying || isAgentActive || isTrackingMouse) {
      setIsSleeping(false);
      return;
    }

    const sleepTimer = setTimeout(() => {
      setIsSleeping(true);
      setCurrentTarget({
        name: 'sleeping',
        gazeX: 0,
        gazeY: 0.6,
        leftTopY: 22.5,
        leftHeight: 5.5,
        leftScaleX: 1.0,
        leftTilt: 0,
        rightTopY: 22.5,
        rightHeight: 5.5,
        rightScaleX: 1.0,
        rightTilt: 0,
        headTilt: 3.0,
      });
    }, 300000); // 5 minutes

    return () => clearTimeout(sleepTimer);
  }, [mood, isMusicPlaying, isAgentActive, isTrackingMouse]);

  // Sleep mode wake-up on any interaction
  useEffect(() => {
    if (!isSleeping) return;

    const wakeUp = () => {
      setIsSleeping(false);
      // Wake-up stretch animation
      setCurrentTarget({
        name: 'wake_stretch',
        gazeX: 0,
        gazeY: -0.8,
        leftTopY: 14.5,
        leftHeight: 13.5,
        leftScaleX: 1.06,
        leftTilt: 0,
        rightTopY: 14.5,
        rightHeight: 13.5,
        rightScaleX: 1.06,
        rightTilt: 0,
        headTilt: 0,
      });
      setLeftEarTwitch(true);
      setRightEarTwitch(true);
      setTimeout(() => {
        setLeftEarTwitch(false);
        setRightEarTwitch(false);
        setCurrentTarget(NEUTRAL_TARGET);
      }, 800);
    };

    window.addEventListener('mousemove', wakeUp, { once: true });
    window.addEventListener('click', wakeUp, { once: true });
    window.addEventListener('keydown', wakeUp, { once: true });

    return () => {
      window.removeEventListener('mousemove', wakeUp);
      window.removeEventListener('click', wakeUp);
      window.removeEventListener('keydown', wakeUp);
    };
  }, [isSleeping]);

  // High-performance spring configs
  const saccadeSpring = {
    type: 'spring',
    stiffness: 920,
    damping: 44,
    mass: 0.38,
  };

  const trackingSpring = {
    type: 'spring',
    stiffness: 520,
    damping: 38,
    mass: 0.32,
  };

  const scanSpring = {
    type: 'spring',
    stiffness: 180,
    damping: 24,
  };

  const lidSpring = {
    type: 'spring',
    stiffness: 580,
    damping: 38,
    mass: 0.45,
  };

  const blinkSpring = {
    type: 'spring',
    stiffness: 1200,
    damping: 48,
    mass: 0.28,
  };

  const headSpring = {
    type: 'spring',
    stiffness: 350,
    damping: 22,
    mass: 0.7,
  };

  // Compute live animated parameters
  const currentLeftTopY = isBlinking ? 26.8 : currentTarget.leftTopY;
  const currentLeftHeight = isBlinking ? 1.2 : currentTarget.leftHeight;
  const currentRightTopY = isBlinking ? 26.8 : currentTarget.rightTopY;
  const currentRightHeight = isBlinking ? 1.2 : currentTarget.rightHeight;
  const currentRightRx = currentTarget.name.includes('inquisitive') ? 3.0 : EYE_RX;
  const activeGazeX = (isMusicPlaying || isSleeping ? 0 : currentTarget.gazeX) + (isSleeping ? 0 : microSaccade.x);
  const activeGazeY = (isMusicPlaying || isSleeping ? 0 : currentTarget.gazeY) + (isSleeping ? 0 : microSaccade.y);

  // Handle direct click spin reaction
  const handleAvatarClick = () => {
    setSpinAngle((prev) => prev + 360);
    triggerBlink();
    setLeftEarTwitch(true);
    setRightEarTwitch(true);
    setTimeout(() => {
      setLeftEarTwitch(false);
      setRightEarTwitch(false);
    }, 320);
  };

  return (
    <motion.div
      ref={avatarContainerRef}
      className="relative flex items-center justify-center select-none cursor-pointer shrink-0 aspect-square"
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        maxWidth: size,
        maxHeight: size,
      }}
      animate={{
        width: size,
        height: size,
      }}
      transition={{
        width: { type: 'spring', stiffness: 280, damping: 26, mass: 0.7 },
        height: { type: 'spring', stiffness: 280, damping: 26, mass: 0.7 },
      }}
      onClick={handleAvatarClick}
    >
      {/* 
        BOT HEAD CONTAINER:
        Executes crisp spring spins on notification arrival or click, 
        and holds stable, deliberate micro-tilts when inquisitive.
      */}
      <motion.div
        className="w-full h-full aspect-square relative flex items-center justify-center"
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        animate={{
          rotate: currentTarget.headTilt + spinAngle,
        }}
        transition={headSpring}
      >
        {/* Subtle OLED Ambient Halo (Zero vertical bob) - dynamic glow matching eye color & active CLI agent */}
        {!isIdleMascotOnly && (
          <div
            className={`absolute inset-0 rounded-full blur-md pointer-events-none transition-colors duration-500 ${
              isAgentActive && activeAgent === 'antigravity'
                ? 'bg-sky-400/35 shadow-[0_0_24px_rgba(56,189,248,0.5)]'
                : isAgentActive && activeAgent === 'codex'
                ? 'bg-emerald-500/35 shadow-[0_0_24px_rgba(16,163,127,0.5)]'
                : isAgentActive && activeAgent === 'claude'
                ? 'bg-amber-500/35 shadow-[0_0_24px_rgba(245,158,11,0.5)]'
                : effectiveEyeColor === '#EF4444'
                ? 'bg-red-500/20'
                : effectiveEyeColor === '#10B981'
                ? 'bg-emerald-500/25'
                : 'bg-white/10'
            }`}
          />
        )}

        <svg
          viewBox="0 0 44 44"
          preserveAspectRatio="xMidYMid meet"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`w-full h-full aspect-square relative z-10 ${isIdleMascotOnly ? '' : 'drop-shadow-md'}`}
        >
          <defs>
            {/* 
              HARD SCREEN CLIP:
              Guarantees 100% mathematically that NO pixel of the eyes 
              can ever bleed outside the circular black visor dome.
            */}
            <clipPath id={visorClipId}>
              <circle cx="22" cy="22" r="15" />
            </clipPath>

            {/* Deep OLED Black Gradient */}
            <radialGradient id={visorGradientId} cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#141418" />
              <stop offset="70%" stopColor="#050507" />
              <stop offset="100%" stopColor="#000000" />
            </radialGradient>

            {/* Crisp Titanium Rim Stroke */}
            <linearGradient id={rimGradientId} x1="4" y1="4" x2="40" y2="40" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFFFFF" stopOpacity="0.45" />
              <stop offset="50%" stopColor="#888892" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.35" />
            </linearGradient>

            {/* Graphite Ear-Fin Gradient */}
            <linearGradient id={finGradientId} x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#22222A" />
              <stop offset="100%" stopColor="#0A0A0E" />
            </linearGradient>

            {/* OLED High-Definition Bloom Filter */}
            <filter id={eyeBloomId} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="0.65" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Vibrant Music Equalizer Spectrum Gradient */}
            <linearGradient id={musicGradientId} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="50%" stopColor="#34D399" />
              <stop offset="100%" stopColor="#60A5FA" />
            </linearGradient>
          </defs>

          {/* 1. Left Ear-Fin Antenna (Fast autonomous spring twitch, sleep droop, & music rhythm bounce) */}
          <motion.path
            d="M7 17C4 13 4 8 8 10C9 13 8 18 7 17Z"
            fill={`url(#${finGradientId})`}
            stroke="#FFFFFF"
            strokeOpacity={mood === 'alert' ? 0.9 : 0.45}
            strokeWidth="1.2"
            animate={
              leftEarTwitch
                ? { rotate: [-18, 14, -8, 0] }
                : isSleeping
                ? { rotate: 12 }
                : isMusicPlaying
                ? { rotate: [-6, 6, -6] }
                : mood === 'alert'
                ? { rotate: -24, scale: 1.12 }
                : mood === 'searching'
                ? { rotate: [-12, 6, -12] }
                : { rotate: 0 }
            }
            style={{ originX: '8px', originY: '17px' }}
            transition={
              isMusicPlaying || mood === 'searching'
                ? { duration: 0.65, repeat: Infinity, ease: 'easeInOut' }
                : {
                    type: 'spring',
                    stiffness: 600,
                    damping: 24,
                  }
            }
          />

          {/* 2. Right Ear-Fin Antenna (Music rhythm bounce, sleep droop) */}
          <motion.path
            d="M37 17C40 13 40 8 36 10C35 13 36 18 37 17Z"
            fill={`url(#${finGradientId})`}
            stroke="#FFFFFF"
            strokeOpacity={mood === 'alert' ? 0.9 : 0.45}
            strokeWidth="1.2"
            animate={
              rightEarTwitch
                ? { rotate: [18, -14, 8, 0] }
                : isSleeping
                ? { rotate: -12 }
                : isMusicPlaying
                ? { rotate: [6, -6, 6] }
                : mood === 'alert'
                ? { rotate: 24, scale: 1.12 }
                : mood === 'searching'
                ? { rotate: [12, -6, 12] }
                : { rotate: 0 }
            }
            style={{ originX: '36px', originY: '17px' }}
            transition={
              isMusicPlaying || mood === 'searching'
                ? { duration: 0.65, repeat: Infinity, ease: 'easeInOut' }
                : {
                    type: 'spring',
                    stiffness: 600,
                    damping: 24,
                  }
            }
          />

          {/* 3. Deep Black Visor Dome */}
          <circle
            cx="22"
            cy="22"
            r="16"
            fill={`url(#${visorGradientId})`}
            stroke={`url(#${rimGradientId})`}
            strokeWidth="1.5"
          />

          {/* 
            4. GROK BOT OCULAR SCREEN ASSEMBLY:
            Enclosed completely within visor clip path.
          */}
          <g clipPath={`url(#${visorClipId})`}>
            <motion.g
              filter={`url(#${eyeBloomId})`}
              transform={`translate(${activeGazeX}, ${activeGazeY})`}
              animate={{
                x: activeGazeX,
                y: activeGazeY,
              }}
              transition={isScanning ? scanSpring : isTrackingMouse ? trackingSpring : saccadeSpring}
            >
              {isMusicPlaying && (isIdleMascotOnly || mood === 'idle') ? (
                // Musical Equalizer Dancing Spectrum Eyes (Replaces eyes during music idle mode)
                <motion.g
                  key="music-equalizer-eyes"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* Left Eye Equalizer Cluster (Grounded at baseline y = 27.5, matching normal eye bottom) */}
                  <rect x="12.5" y="18.5" width="1.5" height="9" rx="0.75" fill={`url(#${musicGradientId})`}>
                    <animate attributeName="y" values="22.5;17.5;23.5;16.5;22.5" dur="0.62s" repeatCount="indefinite" />
                    <animate attributeName="height" values="5;10;4;11;5" dur="0.62s" repeatCount="indefinite" />
                  </rect>
                  <rect x="14.3" y="16.5" width="1.5" height="11" rx="0.75" fill={`url(#${musicGradientId})`}>
                    <animate attributeName="y" values="16.5;21.5;15.5;20.5;16.5" dur="0.52s" repeatCount="indefinite" />
                    <animate attributeName="height" values="11;6;12;7;11" dur="0.52s" repeatCount="indefinite" />
                  </rect>
                  <rect x="16.1" y="20.5" width="1.5" height="7" rx="0.75" fill={`url(#${musicGradientId})`}>
                    <animate attributeName="y" values="20.5;15.5;22.5;16.5;20.5" dur="0.74s" repeatCount="indefinite" />
                    <animate attributeName="height" values="7;12;5;11;7" dur="0.74s" repeatCount="indefinite" />
                  </rect>
                  <rect x="17.9" y="23.5" width="1.5" height="4" rx="0.75" fill={`url(#${musicGradientId})`}>
                    <animate attributeName="y" values="23.5;19.5;24.5;20.5;23.5" dur="0.45s" repeatCount="indefinite" />
                    <animate attributeName="height" values="4;8;3;7;4" dur="0.45s" repeatCount="indefinite" />
                  </rect>

                  {/* Right Eye Equalizer Cluster (Grounded at baseline y = 27.5, matching normal eye bottom) */}
                  <rect x="24.6" y="23.5" width="1.5" height="4" rx="0.75" fill={`url(#${musicGradientId})`}>
                    <animate attributeName="y" values="23.5;20.5;24.5;19.5;23.5" dur="0.48s" repeatCount="indefinite" />
                    <animate attributeName="height" values="4;7;3;8;4" dur="0.48s" repeatCount="indefinite" />
                  </rect>
                  <rect x="26.4" y="20.5" width="1.5" height="7" rx="0.75" fill={`url(#${musicGradientId})`}>
                    <animate attributeName="y" values="20.5;16.5;22.5;15.5;20.5" dur="0.70s" repeatCount="indefinite" />
                    <animate attributeName="height" values="7;11;5;12;7" dur="0.70s" repeatCount="indefinite" />
                  </rect>
                  <rect x="28.2" y="16.5" width="1.5" height="11" rx="0.75" fill={`url(#${musicGradientId})`}>
                    <animate attributeName="y" values="16.5;20.5;15.5;21.5;16.5" dur="0.55s" repeatCount="indefinite" />
                    <animate attributeName="height" values="11;7;12;6;11" dur="0.55s" repeatCount="indefinite" />
                  </rect>
                  <rect x="30.0" y="21.5" width="1.5" height="6" rx="0.75" fill={`url(#${musicGradientId})`}>
                    <animate attributeName="y" values="21.5;16.5;23.5;17.5;21.5" dur="0.65s" repeatCount="indefinite" />
                    <animate attributeName="height" values="6;11;4;10;6" dur="0.65s" repeatCount="indefinite" />
                  </rect>

                  {/* Micro Floating Music Note Centered at Eye Horizon cy = 22 */}
                  <text
                    x="22"
                    y="22"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="4"
                    fill="#34D399"
                    opacity="0.85"
                  >
                    <animate
                      attributeName="y"
                      values="22.5;20.5;22.5"
                      dur="1.4s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.45;0.95;0.45"
                      dur="1.4s"
                      repeatCount="indefinite"
                    />
                    ♪
                  </text>
                </motion.g>
              ) : mood === 'happy' || (isAgentActive && agentStatus?.status === 'completed') ? (
                // Joyful Upward Curved Arcs (^^)
                <>
                  <path
                    d="M13 22C13 18.5 16 17.5 19 21"
                    stroke={effectiveEyeColor}
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    style={{ transition: 'stroke 0.45s ease' }}
                  />
                  <path
                    d="M25 21C28 17.5 31 18.5 31 22"
                    stroke={effectiveEyeColor}
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    style={{ transition: 'stroke 0.45s ease' }}
                  />
                </>
              ) : isSleeping ? (
                // Sleeping Mode: Peaceful resting closed eyes with gentle breathing pulse
                <motion.g
                  key="sleeping-eyes"
                  animate={{
                    y: [0, -0.4, 0],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 3.6,
                    ease: 'easeInOut',
                  }}
                >
                  <path
                    d="M12.5 24C14.5 25.5 17.5 25.5 19.5 24"
                    stroke={effectiveEyeColor}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    opacity={0.75}
                  />
                  <path
                    d="M24.5 24C26.5 25.5 29.5 25.5 31.5 24"
                    stroke={effectiveEyeColor}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    opacity={0.75}
                  />
                  {/* Subtle Zzz micro indicator */}
                  <text
                    x="33"
                    y="14"
                    fontSize="3.2"
                    fill={effectiveEyeColor}
                    opacity="0.6"
                    fontFamily="sans-serif"
                    fontWeight="bold"
                  >
                    <animate attributeName="opacity" values="0.2;0.8;0.2" dur="2.4s" repeatCount="indefinite" />
                    <animate attributeName="y" values="15;12;15" dur="2.4s" repeatCount="indefinite" />
                    z
                  </text>
                </motion.g>
              ) : mood === 'thinking' && !isAgentActive ? (
                // Standalone Thinking Expression: Inquisitive upward gaze with asymmetric curiosity
                <motion.g
                  key="thinking-eyes"
                  animate={{
                    opacity: [0.92, 1, 0.92],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 2.2,
                    ease: 'easeInOut',
                  }}
                >
                  {/* Left Eye: Alert rounded pill looking up */}
                  <rect
                    x={LEFT_EYE_X}
                    y="14.8"
                    width={EYE_WIDTH}
                    height="12.8"
                    rx={EYE_RX}
                    fill={effectiveEyeColor}
                    style={{ transition: 'fill 0.45s ease' }}
                  />
                  {/* Right Eye: Curious squinted pill */}
                  <rect
                    x={RIGHT_EYE_X}
                    y="18.2"
                    width={EYE_WIDTH}
                    height="9.4"
                    rx="3.0"
                    fill={effectiveEyeColor}
                    style={{ transition: 'fill 0.45s ease' }}
                  />
                  {/* Inquisitive brow accent */}
                  <path
                    d="M24 15.5C26 14.2 29 14.8 31.5 16"
                    stroke={effectiveEyeColor}
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    opacity={0.6}
                  />
                </motion.g>
              ) : mood === 'working' && !isAgentActive ? (
                // Cybernetic Scanning Bars (Laser focus during CLI / APK building)
                <motion.g
                  animate={{
                    x: [-2.2, 2.2, -2.2],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 1.1,
                    ease: 'easeInOut',
                  }}
                >
                  <rect
                    x="11"
                    y="19.5"
                    width="8.8"
                    height="4.5"
                    rx="2.25"
                    fill={effectiveEyeColor}
                    style={{ transition: 'fill 0.45s ease' }}
                  />
                  <rect
                    x="24.2"
                    y="19.5"
                    width="8.8"
                    height="4.5"
                    rx="2.25"
                    fill={effectiveEyeColor}
                    style={{ transition: 'fill 0.45s ease' }}
                  />
                </motion.g>
              ) : mood === 'error' ? (
                // Error / Slanted Slits (/ \)
                <>
                  <line x1="12.5" y1="20" x2="19.5" y2="23.5" stroke={effectiveEyeColor} strokeWidth="2.4" strokeLinecap="round" style={{ transition: 'stroke 0.45s ease' }} />
                  <line x1="24.5" y1="23.5" x2="31.5" y2="20" stroke={effectiveEyeColor} strokeWidth="2.4" strokeLinecap="round" style={{ transition: 'stroke 0.45s ease' }} />
                </>
              ) : (
                // Realistic Grok Bot Morphing Eyes (Alert & Idle states with Top-Down Lid Kinematics)
                <>
                  {/* Left Eye Capsule */}
                  <motion.g
                    transform={`rotate(${currentTarget.leftTilt}, 16, 28)`}
                    style={{
                      transformOrigin: `16px ${BASE_BOTTOM}px`,
                      transition: 'transform 0.14s ease-out',
                    }}
                    animate={{ rotate: currentTarget.leftTilt }}
                    transition={lidSpring}
                  >
                    <motion.rect
                      x={LEFT_EYE_X}
                      y={currentLeftTopY}
                      rx={EYE_RX}
                      width={EYE_WIDTH}
                      height={currentLeftHeight}
                      fill={effectiveEyeColor}
                      style={{ transition: 'fill 0.45s ease' }}
                      animate={{
                        attrY: currentLeftTopY,
                        height: currentLeftHeight,
                        scaleX: currentTarget.leftScaleX,
                      }}
                      transition={isBlinking ? blinkSpring : lidSpring}
                    />
                    {/* Organic Left Pupil / Iris Core for Gaze Clarity */}
                    {!isBlinking && currentLeftHeight > 4.5 && (
                      <circle
                        cx={16.0 + activeGazeX * 0.28}
                        cy={currentLeftTopY + currentLeftHeight * 0.5 + activeGazeY * 0.22}
                        r={1.25}
                        fill="#050508"
                        opacity={0.38}
                        pointerEvents="none"
                      />
                    )}
                  </motion.g>

                  {/* Right Eye Capsule (Closes strictly from TOP down during inquisitive smirk) */}
                  <motion.g
                    transform={`rotate(${currentTarget.rightTilt}, 28, 28)`}
                    style={{
                      transformOrigin: `28px ${BASE_BOTTOM}px`,
                      transition: 'transform 0.14s ease-out',
                    }}
                    animate={{ rotate: currentTarget.rightTilt }}
                    transition={lidSpring}
                  >
                    <motion.rect
                      x={RIGHT_EYE_X}
                      y={currentRightTopY}
                      rx={currentRightRx}
                      width={EYE_WIDTH}
                      height={currentRightHeight}
                      fill={effectiveEyeColor}
                      style={{ transition: 'fill 0.45s ease' }}
                      animate={{
                        attrY: currentRightTopY,
                        height: currentRightHeight,
                        scaleX: currentTarget.rightScaleX,
                      }}
                      transition={isBlinking ? blinkSpring : lidSpring}
                    />
                    {/* Organic Right Pupil / Iris Core for Gaze Clarity */}
                    {!isBlinking && currentRightHeight > 4.5 && (
                      <circle
                        cx={28.0 + activeGazeX * 0.28}
                        cy={currentRightTopY + currentRightHeight * 0.5 + activeGazeY * 0.22}
                        r={1.25}
                        fill="#050508"
                        opacity={0.38}
                        pointerEvents="none"
                      />
                    )}
                  </motion.g>
                </>
              )}
            </motion.g>
          </g>
        </svg>
      </motion.div>
    </motion.div>
  );
};
