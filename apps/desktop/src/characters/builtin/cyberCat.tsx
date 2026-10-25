import React from 'react';
import { motion } from 'framer-motion';
import { CharacterDefinition, CharacterStateProps } from '../types.ts';

interface CyberCatInternalProps extends CharacterStateProps {
  explicitState?: string;
}

/**
 * Resolves the active state for Cyber Neko following the Soko priority hierarchy.
 */
function resolveNekoState(props: CyberCatInternalProps): string {
  if (props.explicitState && props.explicitState !== 'root' && props.explicitState !== 'idle') return props.explicitState;
  if (props.isOnline === false || props.connectionStatus === 'disconnected') return 'offline';
  if (props.mood === 'alert') return 'alert';
  if (props.isDragging) return 'dragging';
  if (props.gitAction === 'push') return 'git_push';
  if (props.gitAction === 'commit') return 'git_commit';
  if (props.mood === 'working') return 'working';
  if (props.mood === 'thinking') return 'thinking';
  if (props.isMusicPlaying) return 'music';
  if (props.mood === 'happy') return 'happy';
  if (props.isCharging) return 'charging';
  if (props.isMultiSession) return 'multi_session';
  if (props.isHovered) return 'hover';
  if (props.isIdleMascotOnly) return 'sleeping';
  return 'idle';
}

/**
 * Resolves dynamic glow and accent color based on state, mood, and active AI agent.
 */
function resolveGlowColor(state: string, props: CyberCatInternalProps): string {
  if (state === 'offline' || state === 'alert') return '#EF4444'; // Red alert / disconnected / offline
  if (state === 'git_push') return '#A855F7'; // Git Push Purple
  if (state === 'git_commit') return '#2DD4BF'; // Git Commit Cyber Teal
  if (state === 'charging') return '#FBBF24'; // Charging Amber / Lightning Gold
  if (state === 'dragging') return '#FB923C'; // Dragging Neon Orange
  if (state === 'multi_session') return '#6366F1'; // Multi-Session Neon Indigo
  if (state === 'online') return '#34D399'; // Online Emerald
  if (state === 'music') return '#C084FC'; // Synthwave Violet Music
  if (state === 'happy') return '#34D399'; // Emerald Happy
  if (state === 'hover') return '#7DD3FC'; // Soft Cyan Hover
  if (state === 'thinking') return '#818CF8'; // Cognitive Indigo Thinking
  if (state === 'working') {
    if (props.activeAgent === 'codex') return '#10A37F'; // Cyber Mint
    if (props.activeAgent === 'claude') return '#F59E0B'; // Sunset Amber
    return '#38BDF8'; // Electric Cyan
  }
  if (props.activeAgent === 'antigravity') return '#38BDF8';
  if (props.activeAgent === 'codex') return '#10A37F';
  if (props.activeAgent === 'claude') return '#F59E0B';
  return '#38BDF8'; // Default electric sky cyan
}

/**
 * Cyber Neko Vector Face Renderer
 * Complete with expressive feline ocular animations, reactive ears,
 * responsive whiskers, and state-specific cybernetic particles for ALL states.
 */
const CyberCatState: React.FC<CyberCatInternalProps> = (props) => {
  const {
    size = 32,
    isIdleMascotOnly,
  } = props;

  const isEnlarged = isIdleMascotOnly;
  const renderSize = isEnlarged ? 56 : size;

  const state = resolveNekoState(props);
  const glowColor = resolveGlowColor(state, props);

  // Left Ear motion config based on active state
  const getLeftEarAnimation = () => {
    switch (state) {
      case 'music':
        return {
          animate: { rotate: [-7, 7, -7], y: [0, -1, 0] },
          transition: { repeat: Infinity, duration: 0.5, ease: 'easeInOut' as const },
        };
      case 'happy':
        return {
          animate: { rotate: [-6, 8, -4, 6, 0], y: [0, -1.5, 0] },
          transition: { repeat: Infinity, duration: 1.2, ease: 'easeInOut' as const },
        };
      case 'alert':
        return {
          animate: { rotate: [-18, -13, -18], scale: [1, 0.94, 1] },
          transition: { repeat: Infinity, duration: 0.35, ease: 'easeInOut' as const },
        };
      case 'thinking':
        return {
          animate: { rotate: [-6, -2, -6] },
          transition: { repeat: Infinity, duration: 2.2, ease: 'easeInOut' as const },
        };
      case 'working':
        return {
          animate: { rotate: [1, -2, 1] },
          transition: { repeat: Infinity, duration: 1.4, ease: 'easeInOut' as const },
        };
      case 'dragging':
        return {
          animate: { rotate: [-24, -19, -24] },
          transition: { repeat: Infinity, duration: 0.8, ease: 'easeInOut' as const },
        };
      case 'hover':
        return {
          animate: { rotate: [-3, 5, -1, 0] },
          transition: { repeat: Infinity, duration: 2.4, ease: 'easeInOut' as const },
        };
      case 'sleeping':
        return {
          animate: { rotate: [7, 4, 7] },
          transition: { repeat: Infinity, duration: 3.8, ease: 'easeInOut' as const },
        };
      case 'charging':
        return {
          animate: { rotate: [-5, 3, -5], scale: [1, 1.06, 1] },
          transition: { repeat: Infinity, duration: 0.6, ease: 'easeInOut' as const },
        };
      case 'git_push':
        return {
          animate: { rotate: [-15, -10, -15] },
          transition: { repeat: Infinity, duration: 0.5, ease: 'easeInOut' as const },
        };
      case 'offline':
        return {
          animate: { rotate: [9, 6, 9] },
          transition: { repeat: Infinity, duration: 3.0, ease: 'easeInOut' as const },
        };
      case 'online':
        return {
          animate: { rotate: [-4, 6, 0] },
          transition: { repeat: Infinity, duration: 1.8, ease: 'easeOut' as const },
        };
      case 'multi_session':
        return {
          animate: { rotate: [-5, 1, -5] },
          transition: { repeat: Infinity, duration: 1.0, ease: 'easeInOut' as const },
        };
      default: // idle
        return {
          animate: { rotate: [0, 2.5, -1, 0] },
          transition: { repeat: Infinity, duration: 4.2, ease: 'easeInOut' as const },
        };
    }
  };

  // Right Ear motion config based on active state
  const getRightEarAnimation = () => {
    switch (state) {
      case 'music':
        return {
          animate: { rotate: [7, -7, 7], y: [0, -1, 0] },
          transition: { repeat: Infinity, duration: 0.5, ease: 'easeInOut' as const },
        };
      case 'happy':
        return {
          animate: { rotate: [6, -8, 4, -6, 0], y: [0, -1.5, 0] },
          transition: { repeat: Infinity, duration: 1.2, ease: 'easeInOut' as const },
        };
      case 'alert':
        return {
          animate: { rotate: [18, 13, 18], scale: [1, 0.94, 1] },
          transition: { repeat: Infinity, duration: 0.35, ease: 'easeInOut' as const },
        };
      case 'thinking':
        return {
          animate: { rotate: [6, 2, 6] },
          transition: { repeat: Infinity, duration: 2.2, ease: 'easeInOut' as const },
        };
      case 'working':
        return {
          animate: { rotate: [-1, 2, -1] },
          transition: { repeat: Infinity, duration: 1.4, ease: 'easeInOut' as const },
        };
      case 'dragging':
        return {
          animate: { rotate: [24, 19, 24] },
          transition: { repeat: Infinity, duration: 0.8, ease: 'easeInOut' as const },
        };
      case 'hover':
        return {
          animate: { rotate: [3, -5, 1, 0] },
          transition: { repeat: Infinity, duration: 2.4, ease: 'easeInOut' as const },
        };
      case 'sleeping':
        return {
          animate: { rotate: [-7, -4, -7] },
          transition: { repeat: Infinity, duration: 3.8, ease: 'easeInOut' as const },
        };
      case 'charging':
        return {
          animate: { rotate: [5, -3, 5], scale: [1, 1.06, 1] },
          transition: { repeat: Infinity, duration: 0.6, ease: 'easeInOut' as const },
        };
      case 'git_push':
        return {
          animate: { rotate: [15, 10, 15] },
          transition: { repeat: Infinity, duration: 0.5, ease: 'easeInOut' as const },
        };
      case 'offline':
        return {
          animate: { rotate: [-9, -6, -9] },
          transition: { repeat: Infinity, duration: 3.0, ease: 'easeInOut' as const },
        };
      case 'online':
        return {
          animate: { rotate: [4, -6, 0] },
          transition: { repeat: Infinity, duration: 1.8, ease: 'easeOut' as const },
        };
      case 'multi_session':
        return {
          animate: { rotate: [1, -5, 1] },
          transition: { repeat: Infinity, duration: 1.0, ease: 'easeInOut' as const },
        };
      default: // idle
        return {
          animate: { rotate: [0, -2.5, 1, 0] },
          transition: { repeat: Infinity, duration: 4.2, ease: 'easeInOut' as const },
        };
    }
  };

  // Whisker animations based on active state
  const getWhiskerAnimation = () => {
    switch (state) {
      case 'music':
        return {
          animate: { opacity: [0.4, 0.95, 0.4], scaleY: [1, 1.25, 1] },
          transition: { repeat: Infinity, duration: 0.5, ease: 'easeInOut' as const },
        };
      case 'alert':
        return {
          animate: { x: [-0.8, 0.8, -0.8], opacity: [0.6, 1, 0.6] },
          transition: { repeat: Infinity, duration: 0.12, ease: 'linear' as const },
        };
      case 'charging':
        return {
          animate: { opacity: [0.35, 1, 0.35] },
          transition: { repeat: Infinity, duration: 0.35, ease: 'easeInOut' as const },
        };
      case 'dragging':
        return {
          animate: { x: -1.2, opacity: 0.75 },
          transition: { duration: 0.2 },
        };
      case 'sleeping':
        return {
          animate: { opacity: [0.2, 0.38, 0.2] },
          transition: { repeat: Infinity, duration: 3.8, ease: 'easeInOut' as const },
        };
      case 'working':
        return {
          animate: { opacity: [0.4, 0.85, 0.4] },
          transition: { repeat: Infinity, duration: 1.2, ease: 'easeInOut' as const },
        };
      case 'offline':
        return {
          animate: { opacity: 0.22, y: 0.8 },
          transition: { duration: 0.4 },
        };
      default:
        return {
          animate: { opacity: [0.4, 0.65, 0.4] },
          transition: { repeat: Infinity, duration: 4.0, ease: 'easeInOut' as const },
        };
    }
  };

  // Head/Visor posture animation
  const getHeadAnimation = () => {
    switch (state) {
      case 'sleeping':
        return {
          animate: { scale: [1, 1.04, 1], y: [0, -0.5, 0] },
          transition: { repeat: Infinity, duration: 3.8, ease: 'easeInOut' as const },
        };
      case 'dragging':
        return {
          animate: { scaleX: [1, 1.12, 1], scaleY: [1, 0.9, 1], rotate: [-2, 2, -2] },
          transition: { repeat: Infinity, duration: 0.8, ease: 'easeInOut' as const },
        };
      case 'happy':
        return {
          animate: { y: [0, -1.8, 0], rotate: [-1, 1, -1] },
          transition: { repeat: Infinity, duration: 1.2, ease: 'easeInOut' as const },
        };
      case 'alert':
        return {
          animate: { x: [-0.8, 0.8, -0.8], y: [-0.4, 0.4, -0.4] },
          transition: { repeat: Infinity, duration: 0.12, ease: 'linear' as const },
        };
      case 'music':
        return {
          animate: { y: [0, -1.2, 0] },
          transition: { repeat: Infinity, duration: 0.5, ease: 'easeInOut' as const },
        };
      case 'git_push':
        return {
          animate: { y: [0, -2.5, 0] },
          transition: { repeat: Infinity, duration: 0.5, ease: 'easeInOut' as const },
        };
      case 'hover':
        return {
          animate: { scale: [1, 1.03, 1], y: [0, -0.8, 0] },
          transition: { repeat: Infinity, duration: 2.2, ease: 'easeInOut' as const },
        };
      default:
        return {
          animate: { y: [0, -0.6, 0] },
          transition: { repeat: Infinity, duration: 4.0, ease: 'easeInOut' as const },
        };
    }
  };

  const leftEarMotion = getLeftEarAnimation();
  const rightEarMotion = getRightEarAnimation();
  const whiskerMotion = getWhiskerAnimation();
  const headMotion = getHeadAnimation();

  return (
    <div
      style={{ width: renderSize, height: renderSize }}
      className="relative flex items-center justify-center select-none"
    >
      <svg
        viewBox="0 0 44 44"
        width={renderSize}
        height={renderSize}
        className="overflow-visible"
      >
        <defs>
          <radialGradient id="neko-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={glowColor} stopOpacity="0.38" />
            <stop offset="100%" stopColor={glowColor} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="neko-visor-metal" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#131922" />
            <stop offset="100%" stopColor="#080B10" />
          </linearGradient>
        </defs>

        {/* Ambient Back Glow */}
        <circle cx="22" cy="22" r="18" fill="url(#neko-glow)" />

        {/* Dynamic Head Group with physical motion */}
        <motion.g
          animate={headMotion.animate}
          transition={headMotion.transition}
          style={{ originX: '22px', originY: '22px' }}
        >
          {/* Outer Circular Head Visor */}
          <circle
            cx="22"
            cy="22"
            r="16.5"
            fill="url(#neko-visor-metal)"
            stroke={glowColor}
            strokeWidth="1.2"
            strokeOpacity={state === 'alert' ? 0.9 : 0.6}
          />

          {/* Alert Warning Strobe Ring */}
          {state === 'alert' && (
            <motion.circle
              cx="22"
              cy="22"
              r="17.2"
              fill="none"
              stroke="#EF4444"
              strokeWidth="1.5"
              animate={{ opacity: [0.2, 0.9, 0.2], scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 0.35 }}
              style={{ originX: '22px', originY: '22px' }}
            />
          )}

          {/* Cat Ears */}
          {/* Left Ear */}
          <motion.path
            d="M 10 13 L 6 3 L 17 8 Z"
            fill="#161B22"
            stroke={glowColor}
            strokeWidth="1"
            strokeLinejoin="round"
            animate={leftEarMotion.animate}
            transition={leftEarMotion.transition}
            style={{ originX: '12px', originY: '10px' }}
          />
          {/* Right Ear */}
          <motion.path
            d="M 34 13 L 38 3 L 27 8 Z"
            fill="#161B22"
            stroke={glowColor}
            strokeWidth="1"
            strokeLinejoin="round"
            animate={rightEarMotion.animate}
            transition={rightEarMotion.transition}
            style={{ originX: '32px', originY: '10px' }}
          />

          {/* Electric Ear Sparks for Charging State */}
          {state === 'charging' && (
            <g>
              <motion.path
                d="M 5 2 L 7 -1 L 9 2"
                stroke="#FBBF24"
                strokeWidth="1.3"
                strokeLinecap="round"
                fill="none"
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ repeat: Infinity, duration: 0.25 }}
              />
              <motion.path
                d="M 39 2 L 37 -1 L 35 2"
                stroke="#FBBF24"
                strokeWidth="1.3"
                strokeLinecap="round"
                fill="none"
                animate={{ opacity: [1, 0.2, 1] }}
                transition={{ repeat: Infinity, duration: 0.25 }}
              />
            </g>
          )}

          {/* Whiskers Left */}
          <motion.g animate={whiskerMotion.animate} transition={whiskerMotion.transition}>
            <line x1="4" y1="23" x2="11" y2="22" stroke={glowColor} strokeWidth="0.85" strokeOpacity="0.45" />
            <line x1="4" y1="27" x2="11" y2="25" stroke={glowColor} strokeWidth="0.85" strokeOpacity="0.45" />
          </motion.g>

          {/* Whiskers Right */}
          <motion.g animate={whiskerMotion.animate} transition={whiskerMotion.transition}>
            <line x1="40" y1="23" x2="33" y2="22" stroke={glowColor} strokeWidth="0.85" strokeOpacity="0.45" />
            <line x1="40" y1="27" x2="33" y2="25" stroke={glowColor} strokeWidth="0.85" strokeOpacity="0.45" />
          </motion.g>

          {/* ======================================================== */}
          {/* OCULAR SCREEN AREA: STATE-SPECIFIC ANIMATIONS            */}
          {/* ======================================================== */}

          {state === 'music' ? (
            // 1. MUSIC STATE: Dynamic 4-Column Equalizer Audio Spectrum
            <g>
              <motion.rect
                x="13"
                y="17"
                width="3"
                height="10"
                rx="1.5"
                fill={glowColor}
                animate={{ height: [4, 13, 6, 14, 4], y: [22, 15, 20, 14, 22] }}
                transition={{ repeat: Infinity, duration: 0.75, ease: 'easeInOut' }}
              />
              <motion.rect
                x="18"
                y="16"
                width="3"
                height="12"
                rx="1.5"
                fill={glowColor}
                animate={{ height: [13, 5, 14, 4, 13], y: [15, 21, 14, 22, 15] }}
                transition={{ repeat: Infinity, duration: 0.65, ease: 'easeInOut' }}
              />
              <motion.rect
                x="23"
                y="16"
                width="3"
                height="12"
                rx="1.5"
                fill={glowColor}
                animate={{ height: [6, 14, 4, 12, 6], y: [20, 14, 22, 16, 20] }}
                transition={{ repeat: Infinity, duration: 0.7, ease: 'easeInOut' }}
              />
              <motion.rect
                x="28"
                y="17"
                width="3"
                height="10"
                rx="1.5"
                fill={glowColor}
                animate={{ height: [14, 4, 12, 6, 14], y: [14, 22, 16, 20, 14] }}
                transition={{ repeat: Infinity, duration: 0.8, ease: 'easeInOut' }}
              />
              {/* Outer Soundwave Ripples */}
              <motion.path
                d="M 3 22 Q 1 18 3 14"
                stroke={glowColor}
                strokeWidth="1.2"
                strokeLinecap="round"
                fill="none"
                animate={{ opacity: [0, 0.75, 0], scale: [0.9, 1.25, 0.9] }}
                transition={{ repeat: Infinity, duration: 0.75 }}
                style={{ originX: '4px', originY: '18px' }}
              />
              <motion.path
                d="M 41 22 Q 43 18 41 14"
                stroke={glowColor}
                strokeWidth="1.2"
                strokeLinecap="round"
                fill="none"
                animate={{ opacity: [0, 0.75, 0], scale: [0.9, 1.25, 0.9] }}
                transition={{ repeat: Infinity, duration: 0.75 }}
                style={{ originX: '40px', originY: '18px' }}
              />
            </g>
          ) : state === 'thinking' ? (
            // 2. THINKING STATE: Inquisitive upward gaze + scanning slit pupils + orbital cognitive HUD
            <g>
              <motion.ellipse
                cx="16"
                cy="18"
                rx="3.5"
                ry="4"
                fill={glowColor}
                animate={{ cy: [18, 17, 18], ry: [4, 4.4, 4] }}
                transition={{ repeat: Infinity, duration: 2.2 }}
              />
              <motion.ellipse
                cx="28"
                cy="18"
                rx="3.5"
                ry="4"
                fill={glowColor}
                animate={{ cy: [18, 17, 18], ry: [4, 4.4, 4] }}
                transition={{ repeat: Infinity, duration: 2.2 }}
              />
              {/* Calculating pupil scan line */}
              <motion.line
                x1="16"
                y1="15"
                x2="16"
                y2="21"
                stroke="#0D1117"
                strokeWidth="1.2"
                strokeLinecap="round"
                animate={{ x: [-1.4, 1.4, -1.4] }}
                transition={{ repeat: Infinity, duration: 2.0, ease: 'easeInOut' }}
              />
              <motion.line
                x1="28"
                y1="15"
                x2="28"
                y2="21"
                stroke="#0D1117"
                strokeWidth="1.2"
                strokeLinecap="round"
                animate={{ x: [-1.4, 1.4, -1.4] }}
                transition={{ repeat: Infinity, duration: 2.0, ease: 'easeInOut' }}
              />
              {/* Forehead Orbital HUD Arc */}
              <motion.circle
                cx="22"
                cy="22"
                r="14"
                fill="none"
                stroke={glowColor}
                strokeWidth="0.9"
                strokeDasharray="5 15"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 3.5, ease: 'linear' }}
                style={{ originX: '22px', originY: '22px' }}
              />
            </g>
          ) : state === 'happy' ? (
            // 3. HAPPY STATE: Joyful inverted arcs (^ ^) + kawaii cheeks + smiling mouth + sparkle
            <g>
              <motion.path
                d="M 12 21 Q 16 14 20 21"
                fill="none"
                stroke={glowColor}
                strokeWidth="2.5"
                strokeLinecap="round"
                animate={{ y: [0, -1.2, 0] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
              />
              <motion.path
                d="M 24 21 Q 28 14 32 21"
                fill="none"
                stroke={glowColor}
                strokeWidth="2.5"
                strokeLinecap="round"
                animate={{ y: [0, -1.2, 0] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
              />
              {/* Kawaii LED blush dots */}
              <circle cx="11" cy="24" r="1.6" fill="#F43F5E" opacity="0.8" />
              <circle cx="33" cy="24" r="1.6" fill="#F43F5E" opacity="0.8" />
              {/* Cat smile curve */}
              <path
                d="M 19 27.5 Q 20.5 29.5 22 27.5 Q 23.5 29.5 25 27.5"
                fill="none"
                stroke={glowColor}
                strokeWidth="1.2"
                strokeLinecap="round"
              />
              {/* Sparkle star */}
              <motion.polygon
                points="33,14 34,16 36,17 34,18 33,20 32,18 30,17 32,16"
                fill={glowColor}
                animate={{ scale: [0.8, 1.3, 0.8], opacity: [0.3, 1, 0.3], rotate: [0, 90, 0] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                style={{ originX: '33px', originY: '17px' }}
              />
            </g>
          ) : state === 'working' ? (
            // 4. WORKING STATE: Cyber HUD Visor with horizontal laser sweep + corner reticles
            <g>
              <rect x="12" y="19" width="8" height="4.5" rx="2" fill={glowColor} opacity="0.88" />
              <rect x="24" y="19" width="8" height="4.5" rx="2" fill={glowColor} opacity="0.88" />
              {/* Laser code scan line */}
              <motion.line
                y1="17"
                y2="25"
                stroke="#FFFFFF"
                strokeWidth="1.5"
                animate={{ x: [11, 33, 11] }}
                transition={{ repeat: Infinity, duration: 1.3, ease: 'easeInOut' }}
              />
              {/* Corner HUD targeting brackets */}
              <path d="M 9 17 L 9 14 L 12 14" stroke={glowColor} strokeWidth="1" fill="none" opacity="0.75" />
              <path d="M 35 17 L 35 14 L 32 14" stroke={glowColor} strokeWidth="1" fill="none" opacity="0.75" />
              <path d="M 9 27 L 9 30 L 12 30" stroke={glowColor} strokeWidth="1" fill="none" opacity="0.75" />
              <path d="M 35 27 L 35 30 L 32 30" stroke={glowColor} strokeWidth="1" fill="none" opacity="0.75" />
            </g>
          ) : state === 'alert' ? (
            // 5. ALERT STATE: Alarmed glowing red circular pupils with exclamation marks
            <g>
              <motion.circle
                cx="16"
                cy="21"
                r="5"
                fill="#EF4444"
                animate={{ scale: [1, 1.25, 1], opacity: [1, 0.7, 1] }}
                transition={{ repeat: Infinity, duration: 0.35 }}
                style={{ originX: '16px', originY: '21px' }}
              />
              <motion.circle
                cx="28"
                cy="21"
                r="5"
                fill="#EF4444"
                animate={{ scale: [1, 1.25, 1], opacity: [1, 0.7, 1] }}
                transition={{ repeat: Infinity, duration: 0.35 }}
                style={{ originX: '28px', originY: '21px' }}
              />
              {/* Exclamation marks inside eyes */}
              <line x1="16" y1="18.5" x2="16" y2="21.5" stroke="#0D1117" strokeWidth="1.4" strokeLinecap="round" />
              <circle cx="16" cy="23.5" r="0.7" fill="#0D1117" />
              <line x1="28" y1="18.5" x2="28" y2="21.5" stroke="#0D1117" strokeWidth="1.4" strokeLinecap="round" />
              <circle cx="28" cy="23.5" r="0.7" fill="#0D1117" />
            </g>
          ) : state === 'sleeping' ? (
            // 6. SLEEPING STATE: Downward curved resting eyelids + floating glowing Zzz particles
            <g>
              <motion.path
                d="M 13 22 Q 16 25 19 22"
                fill="none"
                stroke={glowColor}
                strokeWidth="2.2"
                strokeLinecap="round"
                animate={{ y: [0, 0.5, 0] }}
                transition={{ repeat: Infinity, duration: 3.8, ease: 'easeInOut' }}
              />
              <motion.path
                d="M 25 22 Q 28 25 31 22"
                fill="none"
                stroke={glowColor}
                strokeWidth="2.2"
                strokeLinecap="round"
                animate={{ y: [0, 0.5, 0] }}
                transition={{ repeat: Infinity, duration: 3.8, ease: 'easeInOut' }}
              />
              {/* Floating neon Z particles */}
              <motion.text
                x="32"
                y="12"
                fill={glowColor}
                fontSize="6"
                fontWeight="bold"
                opacity="0.8"
                animate={{ y: [12, 4], x: [32, 35], opacity: [0, 0.9, 0] }}
                transition={{ repeat: Infinity, duration: 2.6, ease: 'easeOut' }}
              >
                Z
              </motion.text>
              <motion.text
                x="28"
                y="16"
                fill={glowColor}
                fontSize="4.5"
                fontWeight="bold"
                opacity="0.6"
                animate={{ y: [16, 9], x: [28, 30], opacity: [0, 0.75, 0] }}
                transition={{ repeat: Infinity, duration: 2.6, delay: 0.9, ease: 'easeOut' }}
              >
                z
              </motion.text>
            </g>
          ) : state === 'dragging' ? (
            // 7. DRAGGING STATE: Startled swirling concentric rings / dizzy spiral reticles
            <g>
              <motion.circle
                cx="16"
                cy="21"
                r="4.8"
                fill="none"
                stroke={glowColor}
                strokeWidth="1.8"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
                style={{ originX: '16px', originY: '21px' }}
              />
              <circle cx="16" cy="21" r="2.2" fill={glowColor} />
              <motion.circle
                cx="28"
                cy="21"
                r="4.8"
                fill="none"
                stroke={glowColor}
                strokeWidth="1.8"
                animate={{ rotate: -360 }}
                transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
                style={{ originX: '28px', originY: '21px' }}
              />
              <circle cx="28" cy="21" r="2.2" fill={glowColor} />
            </g>
          ) : state === 'hover' ? (
            // 8. HOVER STATE: Enormous curious dilated kitten pupils with sparkling reflections
            <g>
              <ellipse cx="16" cy="20.5" rx="4.5" ry="5.5" fill={glowColor} />
              <circle cx="17.5" cy="18.5" r="1.8" fill="#FFFFFF" />
              <circle cx="14.5" cy="22" r="0.9" fill="#FFFFFF" opacity="0.8" />
              <ellipse cx="28" cy="20.5" rx="4.5" ry="5.5" fill={glowColor} />
              <circle cx="29.5" cy="18.5" r="1.8" fill="#FFFFFF" />
              <circle cx="26.5" cy="22" r="0.9" fill="#FFFFFF" opacity="0.8" />
            </g>
          ) : state === 'charging' ? (
            // 9. CHARGING STATE: High-voltage electric lightning bolt eyes
            <g>
              <motion.path
                d="M 17 16 L 14 21 L 17 21 L 15 26 L 19 20 L 16 20 Z"
                fill={glowColor}
                animate={{ scale: [1, 1.15, 1], opacity: [0.8, 1, 0.8] }}
                transition={{ repeat: Infinity, duration: 0.7 }}
                style={{ originX: '16.5px', originY: '21px' }}
              />
              <motion.path
                d="M 29 16 L 26 21 L 29 21 L 27 26 L 31 20 L 28 20 Z"
                fill={glowColor}
                animate={{ scale: [1, 1.15, 1], opacity: [0.8, 1, 0.8] }}
                transition={{ repeat: Infinity, duration: 0.7 }}
                style={{ originX: '28.5px', originY: '21px' }}
              />
            </g>
          ) : state === 'online' ? (
            // 10. ONLINE STATE: Confident feline wink on left + verified checkmark radar on right
            <g>
              {/* Left wink */}
              <path d="M 12 21 Q 16 16 20 21" fill="none" stroke={glowColor} strokeWidth="2.4" strokeLinecap="round" />
              {/* Right eye with checkmark */}
              <ellipse cx="28" cy="21" rx="3.6" ry="4.8" fill={glowColor} />
              <motion.path
                d="M 26 21 L 27.5 22.5 L 30 19.5"
                stroke="#0D1117"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                animate={{ pathLength: [0, 1] }}
                transition={{ repeat: Infinity, duration: 1.8, repeatDelay: 1 }}
              />
              {/* Forehead radar beacon pulse */}
              <motion.circle
                cx="22"
                cy="14"
                r="2"
                stroke={glowColor}
                strokeWidth="1"
                fill="none"
                animate={{ r: [2, 6, 2], opacity: [0.85, 0, 0.85] }}
                transition={{ repeat: Infinity, duration: 1.6 }}
              />
            </g>
          ) : state === 'offline' ? (
            // 11. OFFLINE STATE: Glitched cyber crosses with intermittent digital flicker
            <motion.g
              animate={{ opacity: [1, 0.35, 1, 0.5, 1] }}
              transition={{ repeat: Infinity, duration: 2.2 }}
            >
              <line x1="13" y1="18" x2="19" y2="24" stroke={glowColor} strokeWidth="2.2" strokeLinecap="round" />
              <line x1="19" y1="18" x2="13" y2="24" stroke={glowColor} strokeWidth="2.2" strokeLinecap="round" />
              <line x1="25" y1="18" x2="31" y2="24" stroke={glowColor} strokeWidth="2.2" strokeLinecap="round" />
              <line x1="31" y1="18" x2="25" y2="24" stroke={glowColor} strokeWidth="2.2" strokeLinecap="round" />
              {/* Static scanline */}
              <motion.line
                x1="8"
                y1="21"
                x2="36"
                y2="21"
                stroke={glowColor}
                strokeWidth="0.8"
                opacity="0.35"
                animate={{ y1: [16, 26, 16], y2: [16, 26, 16] }}
                transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
              />
            </motion.g>
          ) : state === 'git_commit' ? (
            // 12. GIT COMMIT STATE: Commit branch nodes with expanding pulses
            <g>
              <circle cx="16" cy="21" r="3.4" fill={glowColor} />
              <circle cx="16" cy="21" r="1.5" fill="#0D1117" />
              <circle cx="28" cy="21" r="3.4" fill={glowColor} />
              <circle cx="28" cy="21" r="1.5" fill="#0D1117" />
              {/* Branch connecting line */}
              <motion.line
                x1="19.4"
                y1="21"
                x2="24.6"
                y2="21"
                stroke={glowColor}
                strokeWidth="1.6"
                strokeDasharray="2 2"
                animate={{ strokeDashoffset: [0, -8] }}
                transition={{ repeat: Infinity, duration: 1.0, ease: 'linear' }}
              />
              <motion.circle
                cx="16"
                cy="21"
                r="3.4"
                fill="none"
                stroke={glowColor}
                strokeWidth="1"
                animate={{ r: [3.4, 6.5, 3.4], opacity: [0.8, 0, 0.8] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              />
              <motion.circle
                cx="28"
                cy="21"
                r="3.4"
                fill="none"
                stroke={glowColor}
                strokeWidth="1"
                animate={{ r: [3.4, 6.5, 3.4], opacity: [0.8, 0, 0.8] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              />
            </g>
          ) : state === 'git_push' ? (
            // 13. GIT PUSH STATE: Dual supersonic rocket boost chevrons with speed exhaust lines
            <g>
              <motion.path
                d="M 16 16 L 12 23 L 15 23 L 16 21 L 17 23 L 20 23 Z"
                fill={glowColor}
                animate={{ y: [1.5, -2, 1.5] }}
                transition={{ repeat: Infinity, duration: 0.5, ease: 'easeInOut' }}
              />
              <motion.path
                d="M 28 16 L 24 23 L 27 23 L 28 21 L 29 23 L 32 23 Z"
                fill={glowColor}
                animate={{ y: [1.5, -2, 1.5] }}
                transition={{ repeat: Infinity, duration: 0.5, ease: 'easeInOut' }}
              />
              {/* Downward speed lines */}
              <motion.line
                x1="16"
                y1="34"
                x2="16"
                y2="40"
                stroke={glowColor}
                strokeWidth="1.2"
                strokeLinecap="round"
                animate={{ y1: [34, 38], y2: [38, 43], opacity: [0.8, 0] }}
                transition={{ repeat: Infinity, duration: 0.4 }}
              />
              <motion.line
                x1="28"
                y1="34"
                x2="28"
                y2="40"
                stroke={glowColor}
                strokeWidth="1.2"
                strokeLinecap="round"
                animate={{ y1: [34, 38], y2: [38, 43], opacity: [0.8, 0] }}
                transition={{ repeat: Infinity, duration: 0.4, delay: 0.2 }}
              />
            </g>
          ) : state === 'multi_session' ? (
            // 14. MULTI-SESSION STATE: Quad-core neural processor matrix
            <g>
              {/* Left eye 4-core grid */}
              <motion.circle cx="14.5" cy="19.5" r="1.3" fill={glowColor} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 0.6 }} />
              <motion.circle cx="17.5" cy="19.5" r="1.3" fill={glowColor} animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 0.6 }} />
              <motion.circle cx="14.5" cy="22.5" r="1.3" fill={glowColor} animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 0.6 }} />
              <motion.circle cx="17.5" cy="22.5" r="1.3" fill={glowColor} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 0.6 }} />
              {/* Right eye 4-core grid */}
              <motion.circle cx="26.5" cy="19.5" r="1.3" fill={glowColor} animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 0.6 }} />
              <motion.circle cx="29.5" cy="19.5" r="1.3" fill={glowColor} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 0.6 }} />
              <motion.circle cx="26.5" cy="22.5" r="1.3" fill={glowColor} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 0.6 }} />
              <motion.circle cx="29.5" cy="22.5" r="1.3" fill={glowColor} animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 0.6 }} />
              {/* Synaptic data bridge */}
              <motion.path
                d="M 19 21 Q 22 19 25 21"
                stroke={glowColor}
                strokeWidth="1"
                fill="none"
                strokeDasharray="2 2"
                animate={{ strokeDashoffset: [0, -8] }}
                transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
              />
            </g>
          ) : (
            // 15. IDLE STATE: Sleek glowing feline eyes with natural organic blinking
            <g>
              <motion.ellipse
                cx="16"
                cy="21"
                rx="3.6"
                ry="4.8"
                fill={glowColor}
                animate={{
                  scaleY: [1, 1, 0.08, 1, 1],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 4.2,
                  times: [0, 0.45, 0.5, 0.55, 1],
                }}
                style={{ originY: '21px' }}
              />
              <motion.ellipse
                cx="28"
                cy="21"
                rx="3.6"
                ry="4.8"
                fill={glowColor}
                animate={{
                  scaleY: [1, 1, 0.08, 1, 1],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 4.2,
                  times: [0, 0.45, 0.5, 0.55, 1],
                }}
                style={{ originY: '21px' }}
              />
              {/* Organic vertical slit pupils */}
              <motion.line
                x1="16"
                y1="18.5"
                x2="16"
                y2="23.5"
                stroke="#0D1117"
                strokeWidth="1.2"
                strokeLinecap="round"
                animate={{ scaleX: [1, 0.8, 1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 4.2 }}
              />
              <motion.line
                x1="28"
                y1="18.5"
                x2="28"
                y2="23.5"
                stroke="#0D1117"
                strokeWidth="1.2"
                strokeLinecap="round"
                animate={{ scaleX: [1, 0.8, 1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 4.2 }}
              />
              {/* Tiny cute nose */}
              <polygon points="21,26 23,26 22,27.5" fill={glowColor} opacity="0.75" />
            </g>
          )}
        </motion.g>
      </svg>
    </div>
  );
};

/**
 * Higher-order component factory to generate dedicated state renderers
 * while retaining all shared vector physics and reactive capabilities.
 */
function createCyberCatState(stateKey: string): React.FC<CharacterStateProps> {
  const StateWrapper: React.FC<CharacterStateProps> = (props) => (
    <CyberCatState {...props} explicitState={stateKey} />
  );
  StateWrapper.displayName = `CyberCatState_${stateKey}`;
  return StateWrapper;
}

const CyberCatPreview: React.FC<{ size?: number }> = ({ size = 32 }) => {
  return (
    <div style={{ width: size, height: size }} className="flex items-center justify-center">
      <CyberCatState mood="idle" size={size} />
    </div>
  );
};

export const cyberCatCharacter: CharacterDefinition = {
  id: 'cyber-cat',
  name: 'Cyber Neko',
  version: '1.1.0',
  author: 'Soko Design Lab',
  description: 'Futuristic feline AI with glowing cyber whiskers, animated ears, and dynamic state-specific ocular animations.',
  format: 'native',
  isBuiltin: true,
  previewComponent: CyberCatPreview,

  // Character-controlled atmospheric state backgrounds
  backgrounds: {
    idle: '#0B0F19',
    thinking: 'linear-gradient(135deg, #0B0F19 30%, #1E1B4B 100%)',
    music: 'linear-gradient(135deg, #0F0926 20%, #2E1065 100%)',
    happy: 'linear-gradient(135deg, #06281E 30%, #064E3B 100%)',
    working: 'linear-gradient(135deg, #0F172A 30%, #1E293B 100%)',
    alert: 'linear-gradient(135deg, #2A0808 20%, #0F172A 80%)',
    sleeping: '#07090F',
    dragging: 'linear-gradient(135deg, #2D1402 30%, #431407 100%)',
    hover: 'linear-gradient(135deg, #0B0F19 30%, #1E293B 100%)',
    charging: 'linear-gradient(135deg, #2E1A05 30%, #1E1B4B 100%)',
    online: 'linear-gradient(135deg, #052E16 30%, #047857 100%)',
    offline: 'linear-gradient(135deg, #2A0808 20%, #0B0D14 100%)',
    git_commit: 'linear-gradient(135deg, #042F2E 30%, #134E4A 100%)',
    git_push: 'linear-gradient(135deg, #2E1065 30%, #3B0764 100%)',
    multi_session: 'linear-gradient(135deg, #1E1B4B 30%, #312E81 100%)',
    default: '#0B0F19',
  },

  // Dedicated animated state renderers for every single Soko state
  states: {
    idle: createCyberCatState('idle'),
    thinking: createCyberCatState('thinking'),
    music: createCyberCatState('music'),
    happy: createCyberCatState('happy'),
    working: createCyberCatState('working'),
    alert: createCyberCatState('alert'),
    sleeping: createCyberCatState('sleeping'),
    dragging: createCyberCatState('dragging'),
    hover: createCyberCatState('hover'),
    charging: createCyberCatState('charging'),
    online: createCyberCatState('online'),
    offline: createCyberCatState('offline'),
    git_commit: createCyberCatState('git_commit'),
    git_push: createCyberCatState('git_push'),
    multi_session: createCyberCatState('multi_session'),
  },

  capabilities: {
    supportsCursorTracking: false,
    supportsMusicEqualizer: true,
    supportsAgentColors: true,
  },
};
