import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MascotMood } from '../../types/index.ts';

interface CharacterAvatarProps {
  mood: MascotMood;
  size?: number;
}

/**
 * "Nova Grok-Bot" - Fluid, Jelly-Physics Cyber Mascot.
 *
 * Grokbot-Inspired Animation Highlights:
 * 1. Squash & Stretch Jelly Physics: Smooth organic mass deformation on bob & bounce.
 * 2. Asymmetric Quirky Head Tilt: Playful angle cocking (like a curious cyber-pet).
 * 3. Secondary Ear-Fin Kinematics: Independent spring dampening with playful ear twitches.
 * 4. Micro-Saccade Gaze: Eyes subtly scan their surroundings during idle.
 * 5. Interactive Spring Reaction: Squishes playfully on hover and tap.
 */
export const CharacterAvatar: React.FC<CharacterAvatarProps> = ({
  mood,
  size = 32,
}) => {
  const [isBlinking, setIsBlinking] = useState(false);
  const [earTwitch, setEarTwitch] = useState(false);

  // Autonomous elastic blinking loop
  useEffect(() => {
    if (mood !== 'idle') return;

    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 160);
    }, 3400);

    // Occasional quirky ear twitch
    const twitchInterval = setInterval(() => {
      setEarTwitch(true);
      setTimeout(() => setEarTwitch(false), 450);
    }, 5800);

    return () => {
      clearInterval(blinkInterval);
      clearInterval(twitchInterval);
    };
  }, [mood]);

  // Colorways matching system state
  const getThemePalette = () => {
    switch (mood) {
      case 'alert':
        return {
          coreGlow: '#FF3366',
          gradientStart: '#FF3366',
          gradientEnd: '#FF9900',
          eyeColor: '#FFF176',
          finColor: '#FF3366',
          blush: 'rgba(255, 51, 102, 0.5)',
        };
      case 'working':
        return {
          coreGlow: '#00F0FF',
          gradientStart: '#8B5CF6',
          gradientEnd: '#00F0FF',
          eyeColor: '#00F0FF',
          finColor: '#A855F7',
          blush: 'rgba(0, 240, 255, 0.4)',
        };
      case 'happy':
        return {
          coreGlow: '#10B981',
          gradientStart: '#10B981',
          gradientEnd: '#06B6D4',
          eyeColor: '#FFFFFF',
          finColor: '#10B981',
          blush: 'rgba(16, 185, 129, 0.45)',
        };
      case 'error':
        return {
          coreGlow: '#EF4444',
          gradientStart: '#EF4444',
          gradientEnd: '#991B1B',
          eyeColor: '#FFA4A4',
          finColor: '#EF4444',
          blush: 'rgba(239, 68, 68, 0.45)',
        };
      case 'searching':
        return {
          coreGlow: '#6366F1',
          gradientStart: '#6366F1',
          gradientEnd: '#3B82F6',
          eyeColor: '#93C5FD',
          finColor: '#6366F1',
          blush: 'rgba(99, 102, 241, 0.35)',
        };
      case 'idle':
      default:
        return {
          coreGlow: '#00F0FF',
          gradientStart: '#A855F7',
          gradientEnd: '#00F0FF',
          eyeColor: '#FFFFFF',
          finColor: '#00F0FF',
          blush: 'rgba(168, 85, 247, 0.4)',
        };
    }
  };

  const palette = getThemePalette();

  return (
    <motion.div
      className="relative flex items-center justify-center select-none cursor-pointer"
      style={{ width: size, height: size }}
      whileHover={{ scale: 1.12, rotate: -3 }}
      whileTap={{ scale: 0.9, rotate: 4 }}
      // Grok-style fluid squash & stretch + curious head tilt
      animate={
        mood === 'alert'
          ? {
              y: [0, -6, 0, -2, 0],
              scaleX: [1, 0.92, 1.08, 0.98, 1],
              scaleY: [1, 1.14, 0.94, 1.04, 1],
              rotate: [0, -5, 6, -2, 0],
            }
          : mood === 'working'
          ? {
              y: [0, -1.5, 0],
              rotate: [-3, 3, -3],
              scaleX: [1, 1.03, 1],
              scaleY: [1, 0.97, 1],
            }
          : mood === 'searching'
          ? {
              x: [-4, 4, -4],
              rotate: [-6, 6, -6],
            }
          : {
              // Idle Organic Breathing with Asymmetric Grok Tilt
              y: [0, -2.5, 0, -0.8, 0],
              rotate: [0, 3.5, 0, -2.5, 0],
              scaleX: [1, 1.04, 0.98, 1.02, 1],
              scaleY: [1, 0.96, 1.03, 0.98, 1],
            }
      }
      transition={{
        repeat: Infinity,
        duration: mood === 'alert' ? 0.7 : mood === 'working' ? 1.0 : 3.6,
        ease: 'easeInOut',
      }}
    >
      {/* Ambient Breathing Aura Glow */}
      <motion.div
        className="absolute inset-0 rounded-full blur-md opacity-45 pointer-events-none"
        style={{ background: palette.coreGlow }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.35, 0.55, 0.35] }}
        transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut' }}
      />

      <svg
        viewBox="0 0 44 44"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full relative z-10 drop-shadow-xl"
      >
        <defs>
          <linearGradient id="grok-face-grad" x1="6" y1="6" x2="38" y2="38" gradientUnits="userSpaceOnUse">
            <stop stopColor="#211A36" />
            <stop offset="0.6" stopColor="#12121D" />
            <stop offset="1" stopColor="#08080C" />
          </linearGradient>

          <linearGradient id="grok-rim-grad" x1="4" y1="8" x2="40" y2="36" gradientUnits="userSpaceOnUse">
            <stop stopColor={palette.gradientStart} />
            <stop offset="1" stopColor={palette.gradientEnd} />
          </linearGradient>

          <linearGradient id="grok-fin-grad" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor={palette.finColor} />
            <stop offset="1" stopColor="#0A0F1D" />
          </linearGradient>

          <linearGradient id="grok-sheen" x1="12" y1="10" x2="30" y2="24" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFFFFF" stopOpacity="0.32" />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* 1. Left Kinetic Ear-Fin (with twitch & lag) */}
        <motion.path
          d="M7 17C4 13 4 8 8 10C9 13 8 18 7 17Z"
          fill="url(#grok-fin-grad)"
          stroke={palette.finColor}
          strokeWidth="1.3"
          animate={
            earTwitch
              ? { rotate: [-20, 15, -10, 0] }
              : mood === 'alert'
              ? { rotate: [-15, -30, -15], scale: [1, 1.2, 1] }
              : mood === 'working'
              ? { rotate: [-8, 8, -8] }
              : { rotate: [-2, 4, -2] }
          }
          style={{ originX: '8px', originY: '17px' }}
          transition={{
            repeat: earTwitch ? 0 : Infinity,
            duration: earTwitch ? 0.35 : 2.2,
            ease: 'easeInOut',
          }}
        />

        {/* 2. Right Kinetic Ear-Fin (asymmetric secondary delay) */}
        <motion.path
          d="M37 17C40 13 40 8 36 10C35 13 36 18 37 17Z"
          fill="url(#grok-fin-grad)"
          stroke={palette.finColor}
          strokeWidth="1.3"
          animate={
            earTwitch
              ? { rotate: [10, -20, 12, 0] }
              : mood === 'alert'
              ? { rotate: [15, 30, 15], scale: [1, 1.2, 1] }
              : mood === 'working'
              ? { rotate: [8, -8, 8] }
              : { rotate: [3, -3, 3] }
          }
          style={{ originX: '36px', originY: '17px' }}
          transition={{
            repeat: earTwitch ? 0 : Infinity,
            duration: earTwitch ? 0.35 : 2.4,
            ease: 'easeInOut',
          }}
        />

        {/* 3. Obsidian Visor Dome */}
        <circle
          cx="22"
          cy="22"
          r="16.5"
          fill="url(#grok-face-grad)"
          stroke="url(#grok-rim-grad)"
          strokeWidth="1.8"
        />

        {/* 4. Visor Light Sheen */}
        <path
          d="M12 14C15 9.5 28 9.5 32 14C27 12 17 12 12 14Z"
          fill="url(#grok-sheen)"
        />

        {/* 5. Glowing Chromatic Blush */}
        <circle cx="12" cy="25" r="2.8" fill={palette.blush} />
        <circle cx="32" cy="25" r="2.8" fill={palette.blush} />

        {/* 6. Dynamic Morphing Eyes */}
        {mood === 'happy' ? (
          // Playful Joyful Arcs
          <>
            <path
              d="M14 19C14 16 17.5 15 19.5 18"
              stroke={palette.eyeColor}
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <path
              d="M24.5 18C26.5 15 30 16 30 19"
              stroke={palette.eyeColor}
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </>
        ) : mood === 'working' ? (
          // Cyberpunk Focus Goggles with Active Scanning Crossbars
          <>
            <rect x="13" y="16" width="7" height="6.5" rx="2" fill="#00F0FF" fillOpacity="0.85" />
            <rect x="24" y="16" width="7" height="6.5" rx="2" fill="#00F0FF" fillOpacity="0.85" />
            <line x1="20" y1="19" x2="24" y2="19" stroke="#00F0FF" strokeWidth="1.5" />
            <circle cx="16.5" cy="19" r="1.3" fill="#FFFFFF" />
            <circle cx="27.5" cy="19" r="1.3" fill="#FFFFFF" />
          </>
        ) : mood === 'alert' ? (
          // Wide Elastic Spring Rings
          <>
            <circle cx="16" cy="19" r="3.6" fill={palette.eyeColor} />
            <circle cx="28" cy="19" r="3.6" fill={palette.eyeColor} />
            <circle cx="16" cy="19" r="1.3" fill="#08080C" />
            <circle cx="28" cy="19" r="1.3" fill="#08080C" />
          </>
        ) : mood === 'error' ? (
          // Glitchy Red Crossed Eyes
          <>
            <path d="M14 17L18 21M18 17L14 21" stroke="#FF4D4D" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M26 17L30 21M30 17L26 21" stroke="#FF4D4D" strokeWidth="2.2" strokeLinecap="round" />
          </>
        ) : mood === 'searching' ? (
          // Darting Sideways Radar Gaze
          <>
            <circle cx="18" cy="19" r="2.8" fill={palette.eyeColor} />
            <circle cx="30" cy="19" r="2.8" fill={palette.eyeColor} />
            <circle cx="19" cy="18.5" r="0.9" fill="#08080C" />
            <circle cx="31" cy="18.5" r="0.9" fill="#08080C" />
          </>
        ) : isBlinking ? (
          // Fluid Elastic Blink Slits
          <>
            <line x1="13.5" y1="20" x2="19.5" y2="20" stroke={palette.eyeColor} strokeWidth="2.2" strokeLinecap="round" />
            <line x1="24.5" y1="20" x2="30.5" y2="20" stroke={palette.eyeColor} strokeWidth="2.2" strokeLinecap="round" />
          </>
        ) : (
          // Grok-style Expressive Pupils with Curious Micro-Saccade Shift
          <motion.g
            animate={{
              x: [0, 1.2, 0, -1, 0],
              y: [0, -0.8, 0, 0.6, 0],
            }}
            transition={{ repeat: Infinity, duration: 4.2, ease: 'easeInOut' }}
          >
            {/* Left Eye */}
            <circle cx="16.5" cy="19.5" r="2.9" fill={palette.eyeColor} />
            <circle cx="17.6" cy="18.4" r="1.1" fill="#00F0FF" />
            <circle cx="15.8" cy="20.2" r="0.6" fill="#FFFFFF" />

            {/* Right Eye */}
            <circle cx="27.5" cy="19.5" r="2.9" fill={palette.eyeColor} />
            <circle cx="28.6" cy="18.4" r="1.1" fill="#00F0FF" />
            <circle cx="26.8" cy="20.2" r="0.6" fill="#FFFFFF" />
          </motion.g>
        )}

        {/* 7. Expressive Kinetic Mouth */}
        {mood === 'happy' ? (
          <path
            d="M17 25C18.5 28.5 25.5 28.5 27 25"
            stroke="#FFFFFF"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        ) : mood === 'alert' ? (
          <ellipse cx="22" cy="26" rx="2.2" ry="2.8" fill={palette.eyeColor} />
        ) : mood === 'working' ? (
          <path d="M18 26H26" stroke="#00F0FF" strokeWidth="1.8" strokeLinecap="round" />
        ) : mood === 'error' ? (
          <path d="M17 27Q20 24.5 22 27T27 26" stroke="#FF4D4D" strokeWidth="1.8" strokeLinecap="round" />
        ) : (
          // Quirky Asymmetric Grok Half-Smile
          <path
            d="M18 25.5C19.5 27 24.5 27.5 26.5 25"
            stroke="#FFFFFF"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        )}
      </svg>
    </motion.div>
  );
};
