import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MascotMood } from '../../types/index.ts';

interface CharacterAvatarProps {
  mood: MascotMood;
  size?: number;
}

/**
 * "Nova" - The Colorful Cyber-Critter Mascot.
 *
 * Features:
 * - Dynamic aerodynamic audio ear-fins that perk and tilt with emotion.
 * - Multi-spectrum Aurora neon gradients (Cyan, Neon Violet, Sunset Coral, Emerald).
 * - Dual-layer glowing visor with specular glass reflections.
 * - Expressive neon pupils with chromatic blush pads.
 */
export const CharacterAvatar: React.FC<CharacterAvatarProps> = ({
  mood,
  size = 32,
}) => {
  const [isBlinking, setIsBlinking] = useState(false);

  // Gentle autonomous blinking loop during idle
  useEffect(() => {
    if (mood !== 'idle') return;

    const interval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 180);
    }, 3600);

    return () => clearInterval(interval);
  }, [mood]);

  // Dynamic theme colors based on state
  const getThemePalette = () => {
    switch (mood) {
      case 'alert':
        return {
          coreGlow: '#FF3366',
          gradientStart: '#FF3366',
          gradientEnd: '#FF9900',
          eyeColor: '#FFF176',
          finColor: '#FF3366',
          blush: 'rgba(255, 51, 102, 0.45)',
        };
      case 'working':
        return {
          coreGlow: '#00F0FF',
          gradientStart: '#8B5CF6',
          gradientEnd: '#00F0FF',
          eyeColor: '#00F0FF',
          finColor: '#A855F7',
          blush: 'rgba(0, 240, 255, 0.35)',
        };
      case 'happy':
        return {
          coreGlow: '#10B981',
          gradientStart: '#10B981',
          gradientEnd: '#06B6D4',
          eyeColor: '#FFFFFF',
          finColor: '#10B981',
          blush: 'rgba(16, 185, 129, 0.4)',
        };
      case 'error':
        return {
          coreGlow: '#EF4444',
          gradientStart: '#EF4444',
          gradientEnd: '#991B1B',
          eyeColor: '#FFA4A4',
          finColor: '#EF4444',
          blush: 'rgba(239, 68, 68, 0.4)',
        };
      case 'searching':
        return {
          coreGlow: '#6366F1',
          gradientStart: '#6366F1',
          gradientEnd: '#3B82F6',
          eyeColor: '#93C5FD',
          finColor: '#6366F1',
          blush: 'rgba(99, 102, 241, 0.3)',
        };
      case 'idle':
      default:
        return {
          coreGlow: '#00F0FF',
          gradientStart: '#A855F7', // Neon Violet
          gradientEnd: '#00F0FF',   // Cyber Cyan
          eyeColor: '#FFFFFF',
          finColor: '#00F0FF',
          blush: 'rgba(168, 85, 247, 0.35)',
        };
    }
  };

  const palette = getThemePalette();

  return (
    <motion.div
      className="relative flex items-center justify-center select-none"
      style={{ width: size, height: size }}
      animate={
        mood === 'alert'
          ? { y: [0, -4, 0], scale: [1, 1.12, 1] }
          : mood === 'working'
          ? { rotate: [-2, 2, -2] }
          : mood === 'searching'
          ? { x: [-3, 3, -3] }
          : { y: [0, -1.5, 0] }
      }
      transition={{
        repeat: Infinity,
        duration: mood === 'alert' ? 0.5 : mood === 'working' ? 0.9 : 2.8,
        ease: 'easeInOut',
      }}
    >
      {/* Ambient Radial Aura Glow */}
      <div
        className="absolute inset-0 rounded-full blur-md opacity-40 pointer-events-none transition-colors duration-500"
        style={{ background: palette.coreGlow }}
      />

      <svg
        viewBox="0 0 44 44"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full relative z-10 drop-shadow-lg"
      >
        <defs>
          {/* Vibrant Aurora Face Gradient */}
          <linearGradient id="nova-face-grad" x1="6" y1="6" x2="38" y2="38" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1E192D" />
            <stop offset="0.6" stopColor="#101018" />
            <stop offset="1" stopColor="#0A0A0F" />
          </linearGradient>

          {/* Glowing Iridescent Perimeter Stroke */}
          <linearGradient id="nova-rim-grad" x1="4" y1="8" x2="40" y2="36" gradientUnits="userSpaceOnUse">
            <stop stopColor={palette.gradientStart} />
            <stop offset="1" stopColor={palette.gradientEnd} />
          </linearGradient>

          {/* Ear-Fin Accent Gradient */}
          <linearGradient id="nova-fin-grad" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor={palette.finColor} />
            <stop offset="1" stopColor="#0F172A" />
          </linearGradient>

          {/* Glass Visor Specular Reflection */}
          <linearGradient id="visor-sheen" x1="12" y1="10" x2="30" y2="24" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFFFFF" stopOpacity="0.25" />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* 1. Left Ear-Fin (Aerodynamic Antenna) */}
        <motion.path
          d="M7 17C4 13 4 8 8 10C9 13 8 18 7 17Z"
          fill="url(#nova-fin-grad)"
          stroke={palette.finColor}
          strokeWidth="1.2"
          animate={
            mood === 'alert'
              ? { rotate: [-10, -25, -10], y: -2 }
              : mood === 'working'
              ? { rotate: [-5, 5, -5] }
              : { rotate: 0, y: 0 }
          }
          style={{ originX: '8px', originY: '17px' }}
          transition={{ repeat: Infinity, duration: 1.2 }}
        />

        {/* 2. Right Ear-Fin (Aerodynamic Antenna) */}
        <motion.path
          d="M37 17C40 13 40 8 36 10C35 13 36 18 37 17Z"
          fill="url(#nova-fin-grad)"
          stroke={palette.finColor}
          strokeWidth="1.2"
          animate={
            mood === 'alert'
              ? { rotate: [10, 25, 10], y: -2 }
              : mood === 'working'
              ? { rotate: [5, -5, 5] }
              : { rotate: 0, y: 0 }
          }
          style={{ originX: '36px', originY: '17px' }}
          transition={{ repeat: Infinity, duration: 1.2 }}
        />

        {/* 3. Main Head Silhouette (Obsidian Visor) */}
        <circle
          cx="22"
          cy="22"
          r="16.5"
          fill="url(#nova-face-grad)"
          stroke="url(#nova-rim-grad)"
          strokeWidth="1.8"
        />

        {/* 4. Glass Visor Specular Highlight (Curved light reflection) */}
        <path
          d="M12 14C15 9.5 28 9.5 32 14C27 12 17 12 12 14Z"
          fill="url(#visor-sheen)"
        />

        {/* 5. Glowing Chromatic Cheeks (Blush) */}
        <circle cx="12" cy="25" r="2.8" fill={palette.blush} />
        <circle cx="32" cy="25" r="2.8" fill={palette.blush} />

        {/* 6. Dynamic Eyes */}
        {mood === 'happy' ? (
          // Joyful Sparkle Arcs
          <>
            <path
              d="M14 19C14 16.5 17.5 15.5 19.5 18"
              stroke={palette.eyeColor}
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <path
              d="M24.5 18C26.5 15.5 30 16.5 30 19"
              stroke={palette.eyeColor}
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </>
        ) : mood === 'working' ? (
          // Terminal Goggles / Focus Visors with Neon Cyan Crosshairs
          <>
            <rect x="13" y="16" width="7" height="6.5" rx="2" fill="#00F0FF" fillOpacity="0.85" />
            <rect x="24" y="16" width="7" height="6.5" rx="2" fill="#00F0FF" fillOpacity="0.85" />
            {/* Miniature visor bridge */}
            <line x1="20" y1="19" x2="24" y2="19" stroke="#00F0FF" strokeWidth="1.5" />
            {/* Glowing focus dots */}
            <circle cx="16.5" cy="19" r="1.2" fill="#FFFFFF" />
            <circle cx="27.5" cy="19" r="1.2" fill="#FFFFFF" />
          </>
        ) : mood === 'alert' ? (
          // Wide Luminous Rings
          <>
            <circle cx="16" cy="19" r="3.4" fill={palette.eyeColor} />
            <circle cx="28" cy="19" r="3.4" fill={palette.eyeColor} />
            <circle cx="16" cy="19" r="1.2" fill="#0A0A0F" />
            <circle cx="28" cy="19" r="1.2" fill="#0A0A0F" />
          </>
        ) : mood === 'error' ? (
          // Glitch / Dizzy Crossed Eyes
          <>
            <path d="M14 17L18 21M18 17L14 21" stroke="#FF4D4D" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M26 17L30 21M30 17L26 21" stroke="#FF4D4D" strokeWidth="2.2" strokeLinecap="round" />
          </>
        ) : mood === 'searching' ? (
          // Sideways Radar Gaze
          <>
            <circle cx="18" cy="19" r="2.6" fill={palette.eyeColor} />
            <circle cx="30" cy="19" r="2.6" fill={palette.eyeColor} />
            <circle cx="19" cy="18.5" r="0.8" fill="#0A0A0F" />
            <circle cx="31" cy="18.5" r="0.8" fill="#0A0A0F" />
          </>
        ) : isBlinking ? (
          // Smooth Slit Blink
          <>
            <line x1="14" y1="20" x2="19" y2="20" stroke={palette.eyeColor} strokeWidth="2" strokeLinecap="round" />
            <line x1="25" y1="20" x2="30" y2="20" stroke={palette.eyeColor} strokeWidth="2" strokeLinecap="round" />
          </>
        ) : (
          // Default Luminous Pupils with Specular Star Sparkle
          <>
            <circle cx="16.5" cy="19.5" r="2.8" fill={palette.eyeColor} />
            <circle cx="27.5" cy="19.5" r="2.8" fill={palette.eyeColor} />
            {/* Primary Catchlight Dot */}
            <circle cx="17.5" cy="18.5" r="1" fill="#00F0FF" />
            <circle cx="28.5" cy="18.5" r="1" fill="#00F0FF" />
            {/* Secondary Highlight */}
            <circle cx="15.8" cy="20.2" r="0.6" fill="#FFFFFF" />
            <circle cx="26.8" cy="20.2" r="0.6" fill="#FFFFFF" />
          </>
        )}

        {/* 7. Expressive Mouth */}
        {mood === 'happy' ? (
          <path
            d="M17 25C18.5 28 25.5 28 27 25"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
          />
        ) : mood === 'alert' ? (
          <ellipse cx="22" cy="26" rx="2.2" ry="2.6" fill={palette.eyeColor} />
        ) : mood === 'working' ? (
          // Determined Tech Wave
          <path d="M18 26H26" stroke="#00F0FF" strokeWidth="1.8" strokeLinecap="round" />
        ) : mood === 'error' ? (
          <path d="M17 27Q20 24.5 22 27T27 26" stroke="#FF4D4D" strokeWidth="1.8" strokeLinecap="round" />
        ) : (
          // Gentle Content Half-Smile
          <path
            d="M18 25.5C19.5 27.2 24.5 27.2 26 25.5"
            stroke="#FFFFFF"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        )}
      </svg>
    </motion.div>
  );
};
