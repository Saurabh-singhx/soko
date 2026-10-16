import React from 'react';
import { motion } from 'framer-motion';
import { CharacterDefinition, CharacterStateProps } from '../types.ts';

/**
 * Cyber Neko Vector Face Renderer
 * Demonstrates a completely different character style with animated ears,
 * whisker pulses, and expressive cat eyes for all required states.
 */
const CyberCatState: React.FC<CharacterStateProps> = ({
  mood,
  size = 32,
  isMusicPlaying,
  isIdleMascotOnly,
  activeAgent,
  connectionStatus,
  isDragging,
  isHovered,
  isCharging,
  isOnline,
  isMultiSession,
  gitAction,
}) => {
  const isEnlarged = isIdleMascotOnly;
  const renderSize = isEnlarged ? 56 : size;

  // Agent accent color & connection status eye/visor glow
  let glowColor = '#38BDF8';
  if (isOnline === false || connectionStatus === 'disconnected' || mood === 'alert') {
    glowColor = '#EF4444'; // Red alert / disconnected / offline
  } else if (gitAction === 'push') {
    glowColor = '#A855F7'; // Git Push Purple
  } else if (gitAction === 'commit') {
    glowColor = '#2DD4BF'; // Git Commit Cyber Teal
  } else if (isCharging) {
    glowColor = '#FBBF24'; // Charging Amber / Lightning Gold
  } else if (isDragging) {
    glowColor = '#FB923C'; // Dragging Neon Orange
  } else if (isMultiSession) {
    glowColor = '#6366F1'; // Multi-Session Neon Indigo
  } else if (activeAgent === 'antigravity') {
    glowColor = '#38BDF8'; // Electric Cyan Google Antigravity
  } else if (activeAgent === 'codex') {
    glowColor = '#10A37F'; // Cyber Mint OpenAI Codex
  } else if (activeAgent === 'claude') {
    glowColor = '#F59E0B'; // Sunset Amber Anthropic Claude
  } else if (isMusicPlaying) {
    glowColor = '#C084FC'; // Synthwave Violet Music
  } else if (mood === 'happy') {
    glowColor = '#34D399'; // Emerald Happy
  } else if (isHovered) {
    glowColor = '#7DD3FC'; // Soft Cyan Hover
  } else if (mood === 'thinking') {
    glowColor = '#818CF8'; // Cognitive Indigo Thinking
  }

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
            <stop offset="0%" stopColor={glowColor} stopOpacity="0.35" />
            <stop offset="100%" stopColor={glowColor} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ambient Back Glow */}
        <circle cx="22" cy="22" r="18" fill="url(#neko-glow)" />

        {/* Outer Circular Head Visor */}
        <circle
          cx="22"
          cy="22"
          r="16.5"
          fill="#0D1117"
          stroke={glowColor}
          strokeWidth="1.2"
          strokeOpacity="0.6"
        />

        {/* Cat Ears */}
        {/* Left Ear */}
        <motion.path
          d="M 10 13 L 6 3 L 17 8 Z"
          fill="#161B22"
          stroke={glowColor}
          strokeWidth="1"
          strokeLinejoin="round"
          animate={{
            rotate: isMusicPlaying ? [-3, 4, -3] : [0, 2, 0],
          }}
          transition={{
            repeat: Infinity,
            duration: isMusicPlaying ? 0.6 : 3.5,
            ease: 'easeInOut',
          }}
          style={{ originX: '12px', originY: '10px' }}
        />
        {/* Right Ear */}
        <motion.path
          d="M 34 13 L 38 3 L 27 8 Z"
          fill="#161B22"
          stroke={glowColor}
          strokeWidth="1"
          strokeLinejoin="round"
          animate={{
            rotate: isMusicPlaying ? [3, -4, 3] : [0, -2, 0],
          }}
          transition={{
            repeat: Infinity,
            duration: isMusicPlaying ? 0.6 : 3.5,
            ease: 'easeInOut',
          }}
          style={{ originX: '32px', originY: '10px' }}
        />

        {/* Whiskers Left */}
        <line x1="4" y1="23" x2="11" y2="22" stroke={glowColor} strokeWidth="0.8" strokeOpacity="0.4" />
        <line x1="4" y1="27" x2="11" y2="25" stroke={glowColor} strokeWidth="0.8" strokeOpacity="0.4" />

        {/* Whiskers Right */}
        <line x1="40" y1="23" x2="33" y2="22" stroke={glowColor} strokeWidth="0.8" strokeOpacity="0.4" />
        <line x1="40" y1="27" x2="33" y2="25" stroke={glowColor} strokeWidth="0.8" strokeOpacity="0.4" />

        {/* Ocular Screen Area */}
        {isMusicPlaying ? (
          // MUSIC STATE: Equalizer / Soundwaves Eyes
          <g>
            <motion.rect
              x="13"
              y="17"
              width="3"
              height="10"
              rx="1.5"
              fill={glowColor}
              animate={{ height: [4, 12, 6, 14, 4], y: [22, 16, 20, 15, 22] }}
              transition={{ repeat: Infinity, duration: 0.8, ease: 'easeInOut' }}
            />
            <motion.rect
              x="18"
              y="16"
              width="3"
              height="12"
              rx="1.5"
              fill={glowColor}
              animate={{ height: [12, 6, 14, 4, 12], y: [16, 20, 15, 22, 16] }}
              transition={{ repeat: Infinity, duration: 0.7, ease: 'easeInOut' }}
            />
            <motion.rect
              x="23"
              y="16"
              width="3"
              height="12"
              rx="1.5"
              fill={glowColor}
              animate={{ height: [6, 14, 4, 12, 6], y: [20, 15, 22, 16, 20] }}
              transition={{ repeat: Infinity, duration: 0.75, ease: 'easeInOut' }}
            />
            <motion.rect
              x="28"
              y="17"
              width="3"
              height="10"
              rx="1.5"
              fill={glowColor}
              animate={{ height: [14, 4, 12, 6, 14], y: [15, 22, 16, 20, 15] }}
              transition={{ repeat: Infinity, duration: 0.85, ease: 'easeInOut' }}
            />
          </g>
        ) : mood === 'thinking' ? (
          // THINKING STATE: Inquisitive upward gaze with slit pupils
          <g>
            <motion.ellipse
              cx="16"
              cy="18"
              rx="3.5"
              ry="4"
              fill={glowColor}
              animate={{ cy: [18, 17, 18], ry: [4, 4.5, 4] }}
              transition={{ repeat: Infinity, duration: 2.5 }}
            />
            <motion.ellipse
              cx="28"
              cy="18"
              rx="3.5"
              ry="4"
              fill={glowColor}
              animate={{ cy: [18, 17, 18], ry: [4, 4.5, 4] }}
              transition={{ repeat: Infinity, duration: 2.5 }}
            />
            {/* Slit pupils */}
            <line x1="16" y1="15" x2="16" y2="21" stroke="#0D1117" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="28" y1="15" x2="28" y2="21" stroke="#0D1117" strokeWidth="1.2" strokeLinecap="round" />
          </g>
        ) : mood === 'happy' ? (
          // HAPPY STATE: Joyful inverted arcs (^ ^)
          <g>
            <path
              d="M 12 21 Q 16 15 20 21"
              fill="none"
              stroke={glowColor}
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <path
              d="M 24 21 Q 28 15 32 21"
              fill="none"
              stroke={glowColor}
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </g>
        ) : (
          // IDLE STATE: Sleek glowing feline eyes with natural blinking
          <g>
            <motion.ellipse
              cx="16"
              cy="21"
              rx="3.6"
              ry="4.8"
              fill={glowColor}
              animate={{
                scaleY: [1, 1, 0.1, 1, 1],
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
                scaleY: [1, 1, 0.1, 1, 1],
              }}
              transition={{
                repeat: Infinity,
                duration: 4.2,
                times: [0, 0.45, 0.5, 0.55, 1],
              }}
              style={{ originY: '21px' }}
            />
            {/* Tiny cute nose */}
            <polygon points="21,26 23,26 22,27.5" fill={glowColor} opacity="0.7" />
          </g>
        )}
      </svg>
    </div>
  );
};

export const cyberCatCharacter: CharacterDefinition = {
  id: 'cyber-cat',
  name: 'Cyber Neko',
  version: '1.0.0',
  author: 'Soko Design Lab',
  description: 'Futuristic feline AI with glowing cyber whiskers, animated ears, and dynamic audio equalizer states.',
  format: 'native',
  isBuiltin: true,

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

  states: {
    idle: CyberCatState,
    thinking: CyberCatState,
    music: CyberCatState,
    happy: CyberCatState,
    working: CyberCatState,
    alert: CyberCatState,
    dragging: CyberCatState,
    hover: CyberCatState,
    charging: CyberCatState,
    online: CyberCatState,
    offline: CyberCatState,
    git_commit: CyberCatState,
    git_push: CyberCatState,
    multi_session: CyberCatState,
  },

  capabilities: {
    supportsCursorTracking: false,
    supportsMusicEqualizer: true,
    supportsAgentColors: true,
  },
};
